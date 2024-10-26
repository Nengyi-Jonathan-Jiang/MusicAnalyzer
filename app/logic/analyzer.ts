import {Analyser, getContext, ToneAudioBuffer} from "tone";
import {convertRangeBackwards, LinearValueConvertor} from "@/app/lib/utils/valueConvertor";
import {IntRange, NumberRange} from "@/app/lib/utils/numberRange";
import {MusicPlayer} from "@/app/logic/musicPlayer";
import webfft from "webfft";
import {createArray} from "@/app/lib/utils/util";
import {AudioFile} from "@/app/logic/audioFile";

function getWaveformData(audio: AudioFile, startTime: number): Readonly<Float32Array> {

    return audio.arr.subarray(startTime * audio.buffer.sampleRate);
}

const windowFunctionCache = new Map<number, Float32Array>;

function getFFT(audio: AudioFile, startTime: number, resolution: number): {
    mag: Float32Array;
    raw: Float32Array
} | null {
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
            return a0 - a1 * Math.cos(2 * Math.PI * x) + a2 * Math.cos(4 * Math.PI * x);
            // return Math.exp(-4 * Math.PI * (x - 0.5) ** 2) - Math.exp(-Math.PI);
        });

        windowFunctionCache.set(resolution, arr);
    }

    const window = windowFunctionCache.get(resolution) as Float32Array;
    for (let i = 0; i < data.length; ++i) {
        data[i] *= window[i];
    }

    // Do Blackman window


    try {
        const rawResult = fft.fft(data);


        const magResult = rawResult
            .map((_, i, arr) => Math.hypot(
                arr[i],
                arr[i + 1]
            ))
            .filter((_, i) => i % 2 == 0)
        ;
        fft.dispose();

        return {
            mag: magResult,
            raw: rawResult
        };
    } catch (e) {
        console.warn(e);
        return null;
    }
}

export class MusicAnalyzer {
    readonly #player: MusicPlayer;
    #analysisData: Float32Array = new Float32Array;
    #rawAnalysisData: Float32Array = new Float32Array;
    #resolution: number;
    #smoothing: number;

    constructor(player: MusicPlayer, fftResolution: number = 12, smoothing = 0.8) {
        this.#player = player;
        this.#resolution = fftResolution;
        this.#smoothing = smoothing;
    }

    get player() {
        return this.#player;
    }

    get analysisData(): Float32Array {
        return this.#analysisData;
    }

    get rawAnalysisData(): Float32Array {
        return this.#rawAnalysisData;
    }

    set smoothing(smoothing: number) {
        this.#smoothing = smoothing;
    }

    get smoothing() {
        return this.#smoothing;
    }

    // resolution should be an integer in the range [4, 14]
    set resolution(resolution: number) {
        if (resolution < 4 || resolution > 16) throw new Error('Invalid analyzer resolution');
        this.#resolution = resolution;
    }

    get resolution() {
        return this.#resolution;
    }

    get maxFrequency() {
        // The maximum frequency available is the Nyquist frequency, which is half the sample rate
        return getContext().sampleRate / 2;
    }

    get numBins() {
        return 1 << this.resolution;
    }

    get frequencyBinSize() {
        return this.maxFrequency / this.numBins;
    }

    get binIndexToFrequencyConvertor() {
        return new LinearValueConvertor(this.frequencyBinSize, 0);
    }

    getBinIndexRangeForFrequencies(frequencyRange: NumberRange) {
        return IntRange.smallestRangeContaining(
            convertRangeBackwards(this.binIndexToFrequencyConvertor, frequencyRange)
        ).trimmedToRange(new IntRange(0, this.numBins))
    }

    reAnalyze() {
        if (!this.player.isAudioLoaded) return;

        let result = getFFT(
            this.player.audio,
            this.player.position,
            this.resolution
        );
        if (result === null) return;

        const {mag: newData, raw} = result;

        this.#rawAnalysisData = raw;

        if (this.#analysisData.length !== newData.length) {
            this.#analysisData = newData;
        } else {
            this.#analysisData = new Float32Array(createArray(newData.length, i => {
                const oldValue = this.#analysisData[i];
                const newValue = newData[i];

                if (isNaN(oldValue) || !isFinite(oldValue)) return newValue;
                return oldValue * this.smoothing + newValue * (1 - this.smoothing);
            }));
        }
    }
}