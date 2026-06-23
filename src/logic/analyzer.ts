import {
    convertRangeBackwards, convertRangeForwards, LinearValueConvertor,
} from "@/lib/utils/valueConvertor";
import { IntRange, NumberRange } from "@/lib/utils/numberRange";
import { MusicPlayer } from "@/logic/musicPlayer";
import { now } from "tone";
import { ExternalSmoother, Smoother } from "@/lib/utils/smoother";
import { Cache } from "@/lib/utils/cache";
import { getFFT } from "@/logic/fft";
import CacheSingle = Cache.CacheSingle;

const { hypot, log, log10, exp } = Math;

// TODO: consider using constant q transform instead
//  https://gaborator.com/ or https://github.com/JorenSix/Gabber/tree/master
//  or https://mtg.github.io/essentia.js/
//  see https://doc.ml.tu-berlin.de/bbci/material/publications/Bla_constQ.pdf
//  for paper,
//  OR
//  using a multi-resolution fft (run fft at successively lower sizes with
//  downsampling), which won't require a separate library to be installed
//

export class MusicAnalyzer {
    readonly #player: MusicPlayer;
    #analysisData = new CacheSingle<Float32Array, [ number, IntRange ]>(
        (_, l) => {
            console.log('invalidated analysis data');
            return new Float32Array(l.numIntsInRange);
        },
    );
    #resolution: number;
    #smoothing: number;
    // These two will be correctly set in constructor
    #frequencyRange: NumberRange = null as any;
    #binIndexRange: IntRange = null as any;

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
        this.frequencyRange = null;
    }

    get player () {
        return this.#player;
    }

    /**
     * Get the intensity (logarithmically scaled) of each frequency as an array
     */
    get analysisData (): Readonly<Float32Array> {
        return this.#analysisData.get(this.fftSize, this.binIndexRange);
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

    get #binIndexToFrequencyConvertor () {
        return new LinearValueConvertor(this.frequencyBinSize, 0);
    }

    get frequencyRange (): NumberRange {
        return this.#frequencyRange;
    }

    set frequencyRange (value: NumberRange | null) {
        this.#frequencyRange = value ?? convertRangeForwards(
            this.#binIndexToFrequencyConvertor,
            new IntRange(0, this.fftSize - 1),
        );
        this.#binIndexRange = IntRange.smallestRangeContaining(
            convertRangeBackwards(
                this.#binIndexToFrequencyConvertor, this.frequencyRange,
            ),
        ).trimmedToRange(new IntRange(0, this.fftSize - 1));
    }

    get binIndexRange (): IntRange {
        return this.#binIndexRange;
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

        // For nicer visuals, don't let the volume be too low
        const minVolume: number = 0.32;
        const currTime = now();

        const data: Float32Array = this.analysisData;
        for (let i = 0 ; i < data.length ; i++) {
            const real: any = result[2 * (i + this.binIndexRange.start)];
            const imag: any = result[2 * (i + this.binIndexRange.start) + 1];

            let newVal = log10(hypot(real, imag) + minVolume);
            if (!isFinite(newVal)) newVal = 0;
            data[i] = MusicAnalyzer.smoother.calculate(
                data[i], newVal, currTime,
                adjustedDecayTime,
            );
        }
        MusicAnalyzer.smoother.updateTime();
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
