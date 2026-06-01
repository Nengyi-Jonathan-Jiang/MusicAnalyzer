import {
    convertRangeBackwards, LinearValueConvertor,
} from "@/app/lib/utils/valueConvertor";
import { IntRange, NumberRange } from "@/app/lib/utils/numberRange";
import { MusicPlayer } from "@/app/logic/musicPlayer";
import webfft from "webfft";
import { createArray } from "@/app/lib/utils/util";
import { AudioFile } from "@/app/logic/audioFile";
import { now } from "tone";

const windowFunctionCache = new Map<number, Float32Array>;

const { cos, hypot, log, exp, max } = Math;

function getFFT (audio: AudioFile, startTime: number, resolution: number):
    { mag: Float32Array; raw: Float32Array } | null {
    const size: number = 1 << resolution;

    const data: Float32Array = audio.getData(startTime, size);

    const fft = new webfft(size);
    fft.setSubLibrary('kissWasm');

    // Compute blackman window
    if (!windowFunctionCache.has(resolution)) {
        const alpha = 0.16;
        const a0 = 0.5 * (1 - alpha);
        const a1 = 0.5;
        const a2 = 0.5 * alpha;

        const arr = new Float32Array(data.length).map((_, i) => {
            const x = i / data.length;
            return a0 - a1 * cos(2 * Math.PI * x) + a2 * cos(4 * Math.PI * x);
        });

        windowFunctionCache.set(resolution, arr);
    }

    const window = windowFunctionCache.get(resolution) as Float32Array;
    for (let i = 0 ; i < data.length ; ++i) {
        data[i] *= window[i];
    }

    // Do Blackman window


    try {
        const rawResult = fft.fft(data);


        const magResult = rawResult
            .map((_, i, arr) => hypot(arr[i], arr[i + 1]))
            .filter((_, i) => i % 2 == 0)
        ;
        fft.dispose();

        return {
            mag: magResult,
            raw: rawResult,
        };
    }
    catch (e) {
        console.warn(e);
        return null;
    }
}

export class MusicAnalyzer {
    readonly #player: MusicPlayer;
    #analysisData: Float32Array = new Float32Array;
    #resolution: number;
    #smoothing: number;

    constructor (
        player: MusicPlayer, fftResolution: number = 12, smoothing = 0.6,
    ) {
        this.#player = player;
        this.#resolution = fftResolution;
        this.#smoothing = smoothing;
    }

    get player () {
        return this.#player;
    }

    /**
     * Get the intensity (logarithmically scaled) of each frequency as an array
     */
    get analysisData (): Float32Array {
        return this.#analysisData;
    }

    set smoothing (smoothing: number) {
        this.#smoothing = smoothing;
    }

    get smoothing () {
        return this.#smoothing;
    }

    // resolution should be an integer in the range [4, 14]
    set resolution (resolution: number) {
        if (resolution < 4 || resolution > 16) throw new Error(
            'Invalid analyzer resolution');
        this.#resolution = resolution;
    }

    get resolution () {
        return this.#resolution;
    }

    get maxFrequency () {
        // The maximum frequency available is the Nyquist frequency, which is
        // half the sample rate
        return this.player.sampleRate / 2;
    }

    get numBins () {
        return 1 << this.resolution;
    }

    get frequencyBinSize () {
        return this.maxFrequency / this.numBins;
    }

    get binIndexToFrequencyConvertor () {
        return new LinearValueConvertor(this.frequencyBinSize, 0);
    }

    getBinIndexRangeForFrequencies (frequencyRange: NumberRange) {
        return IntRange.smallestRangeContaining(
            convertRangeBackwards(
                this.binIndexToFrequencyConvertor, frequencyRange),
        ).trimmedToRange(new IntRange(0, this.numBins));
    }

    #prevAnalysisTime = now();

    reAnalyze () {
        if (!this.player.isAudioLoaded) return;

        let result = getFFT(
            this.player.audio,
            this.player.position,
            this.resolution,
        );
        if (result === null) return;

        const { mag: newData } = result;

        const elapsedTime = now() - this.#prevAnalysisTime;
        this.#prevAnalysisTime += elapsedTime;

        // But make sure we don't have zero smoothing!
        const adjustedDecayTime = Math.max(
            0.1, // This is a reasonable minimum decay time from experimenting
            this.#getAdjustedDecayTime(),
        );

        if (this.#analysisData.length !== newData.length) {
            this.#analysisData = newData.map(i => log(i));
        }
        else {
            this.#analysisData = new Float32Array(
                createArray(newData.length, i => {
                    const oldValue = this.#analysisData[i];
                    const newValue = log(newData[i]);

                    if (isNaN(oldValue) || !isFinite(oldValue)) return newValue;

                    const a = exp(-elapsedTime / adjustedDecayTime);
                    return newValue + (oldValue - newValue) * a;
                }),
            );
        }
    }

    #getAdjustedDecayTime (): number {
        // Time constant.
        const lambda = this.smoothing ** 2 / 2;
        // Window size in seconds
        const L = (1 << this.resolution) / this.player.sampleRate;
        // Target decay amount for adjustment (bigger = less adjustment)
        const epsilon = 0.25;

        return getAdjustedDecayTime(lambda, L, epsilon);
    }
}

function getAdjustedDecayTime (
    lambda: number, L: number, epsilon: number,
): number {
    // See decay.md

    const log_epsilon = log(epsilon);
    const tau = -lambda * log_epsilon;
    if (L * (1 - epsilon) >= tau) {
        // We can't adjust for the full window, just do no smoothing.
        return 0;
    }
    else if (tau <= L) {
        // Nicer, exact method
        const c = 1 / (1 - L / tau * (1 - epsilon));
        const alpha = -(c + lambertW0(-c * exp(-c))) / log_epsilon;
        return lambda / alpha;
    }
    else {
        // Need to use root finding
        const alpha = findRoot(
            lambda, (exp(-1 / epsilon) - 1) / (epsilon * log_epsilon),
            alpha => {
                const one_over_rho = alpha * L / lambda;
                return 1
                    + one_over_rho * exp(log_epsilon * (1 - alpha))
                    - exp(one_over_rho);
            },
            8, // Experimentally, should be enough
        );
        return lambda / alpha;
    }
}

function lambertW0 (x: number): number {
    return x * (1 + x * (-1 + x * (1.5 + x * -2.666666666666666)));
}

function findRoot (
    a: number, b: number, f: (x: number) => number,
    numIterations: number,
) {
    // It turns out bisection method works well enough here
    while (numIterations-- > 0) {
        const m = (a + b) / 2, fm = f(m);

        if (fm <= 0) { a = m; }
        else { b = m; }
    }
    return (a + b) / 2;
}