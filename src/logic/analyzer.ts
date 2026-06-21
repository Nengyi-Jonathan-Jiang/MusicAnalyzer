import {
    convertRangeBackwards, LinearValueConvertor,
} from "@/lib/utils/valueConvertor";
import { IntRange, NumberRange } from "@/lib/utils/numberRange";
import { MusicPlayer } from "@/logic/musicPlayer";
import webfft from "webfft";
import { AudioFile } from "@/logic/audioFile";
import { now } from "tone";
import { ExternalSmoother, Smoother } from "@/lib/utils/smoother";
import { editArray } from "@/lib/utils/util";

const windowFunctionCache = new Map<number, Float32Array>;
let fftCache: [ webfft, number ] | null = null;

const { cos, hypot, log, exp } = Math;

function getFFT (
    audio: AudioFile, startTime: number, resolution: number,
    loop: boolean = false,
): Float32Array | null {
    const size: number = 1 << resolution;

    let fft: webfft;
    if (fftCache?.[1] !== size) {
        if (fftCache && fftCache[0]) {
            fftCache[0].dispose();
        }

        fft = new webfft(size);
        fft.setSubLibrary('kissWasm');
        fftCache = [ fft, size ];
    }
    else {
        fft = fftCache[0];
    }

    if (!windowFunctionCache.has(resolution)) {
        const arr = new Float32Array(size).map((_, i) => {
            const x = 2 * Math.PI * i / size;

            // Blackman window
            // const alpha = 0.16;
            // const a0 = 0.5 * (1 - alpha);
            // const a1 = 0.5;
            // const a2 = 0.5 * alpha;
            // return a0 - a1 * cos(x) + a2 * cos(2 * x);

            // Hann window
            return 0.5 - 0.5 * cos(x);
        });

        windowFunctionCache.set(resolution, arr);
    }

    // Apply window function and convert to complex
    const window = windowFunctionCache.get(resolution)!;
    const realData: Float32Array = audio.getData(startTime, size, loop);
    const complexData = new Float32Array(size * 2);
    for (let i = 0 ; i < size ; ++i) {
        complexData[2 * i] = realData[i] * window[i];
    }

    try {
        return fft.fft(complexData);
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

    static readonly smoother: ExternalSmoother<[ number ]> = new Smoother({
        func (_, elapsedTime, decayConstant) {
            return Math.exp(-elapsedTime / decayConstant);
        },
    });

    constructor (
        player: MusicPlayer, fftResolution: number = 13, smoothing = 0.6,
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
    get analysisData (): Readonly<Float32Array> {
        return this.#analysisData;
    }

    set smoothing (smoothing: number) {
        this.#smoothing = smoothing;
    }

    get smoothing () {
        return this.#smoothing;
    }

    public static readonly allowedResolutions: IntRange = new IntRange(11, 16);

    set resolution (resolution: number) {
        if (!MusicAnalyzer.allowedResolutions.includes(resolution))
            throw new Error('Invalid analyzer resolution');
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

    get fftSize () {
        return 1 << this.resolution;
    }

    get frequencyBinSize () {
        return this.maxFrequency / (this.fftSize / 2);
    }

    get binIndexToFrequencyConvertor () {
        return new LinearValueConvertor(this.frequencyBinSize, 0);
    }

    frequencyToBinIndexRange (frequencyRange: NumberRange) {
        return IntRange.smallestRangeContaining(
            convertRangeBackwards(
                this.binIndexToFrequencyConvertor, frequencyRange),
        ).trimmedToRange(new IntRange(0, this.fftSize));
    }

    reAnalyze () {
        if (!this.player.isAudioLoaded) return;

        // Figure out how much smoothing to use
        const adjustedDecayTime = Math.max(
            0.03, // This is a reasonable minimum decay time, from experiment
            this.#getAdjustedDecayTime(),
        );

        // Compute
        let result = getFFT(
            this.player.audio,
            this.player.position,
            this.resolution,
            this.player.doRepeat,
        );

        if (result === null) return;

        if (this.#analysisData.length !== this.fftSize) {
            this.#analysisData = editArray(
                new Float32Array(this.fftSize),
                (_, i) => log(hypot(result[2 * i], result[2 * i] + 1)),
            );
        }
        else {
            const currTime = now();
            editArray(this.#analysisData, (val, i) => {
                return MusicAnalyzer.smoother.calculate(
                    val, log(hypot(result[2 * i], result[2 * i] + 1)), currTime,
                    adjustedDecayTime,
                );
            });
            MusicAnalyzer.smoother.updateTime();
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
    return x * (1 + x * (-1 + x * (1.5 + x * -2.6666666666666666)));
}

function findRoot (
    a: number, b: number, f: (x: number) => number,
    numIterations: number,
) {
    // Binary search is good enough
    while (numIterations-- > 0) {
        const m = (a + b) / 2, fm = f(m);

        if (fm <= 0) { a = m; }
        else { b = m; }
    }
    return (a + b) / 2;
}