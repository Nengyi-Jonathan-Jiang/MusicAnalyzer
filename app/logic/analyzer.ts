import {Analyser, getContext, ToneAudioBuffer} from "tone";
import {convertRangeBackwards, LinearValueConvertor} from "@/app/lib/utils/valueConvertor";
import {IntRange, NumberRange} from "@/app/lib/utils/numberRange";
import {MusicPlayer} from "@/app/logic/musicPlayer";
import webfft from "webfft";
import {createArray} from "@/app/lib/utils/util";
import {AudioFile} from "@/app/logic/audioFIle";

function getWaveformData(audio: AudioFile, startTime: number): Readonly<Float32Array> {

    return audio.arr.subarray(startTime * audio.buffer.sampleRate);
}

const blackmanWindowCache = new Map<number, Float32Array>;

function getFFT(audio: AudioFile, startTime: number, resolution: number) {
    let size = 1 << resolution;

    let data: Float32Array;

    data = audio.getData(startTime, size);

    // try {
    //     data = getWaveformData(audio, startTime).slice(0, size * 2);
    //     if (data.length < size * 2) { // noinspection ExceptionCaughtLocallyJS
    //         throw new Error();
    //     }
    // } catch {
    //     // Not enough data, use the last few seconds.
    //     let arr = getWaveformData(audio, 0);
    //     data = arr.slice(arr.length - size * 2, arr.length);
    // }

    const fft = new webfft(size);
    fft.setSubLibrary('kissWasm');

    // Compute blackman window
    if (!blackmanWindowCache.has(resolution)) {
        const alpha = 0.16;
        const a0 = 0.5 * (1 - alpha);
        const a1 = 0.5;
        const a2 = 0.5 * alpha;

        const arr = new Float32Array(data.length).map((_, i) => {
            const x = i / data.length;
            return a0 - a1 * Math.cos(2 * Math.PI * x) + a2 * Math.cos(4 * Math.PI * x);
        });

        blackmanWindowCache.set(resolution, arr);
    }

    let window = blackmanWindowCache.get(resolution) as Float32Array;
    for (let i = 0; i < data.length; ++i) {
        data[i] *= window[i];
    }

    // Do Blackman window


    const fftResult = fft.fft(data);

    const out = fftResult
        .map((_, i, arr) => Math.hypot(
            arr[i],
            arr[i + 1]
        ))
        .filter((_, i) => i % 2 == 0)
        .map(i => 20 * Math.log(i))
    ;
    fft.dispose();

    return out;
}

export class MusicAnalyzer {
    readonly #analyzerNode: Analyser;
    readonly #player: MusicPlayer;
    #analysisData: Float32Array = new Float32Array;
    #resolution: number;
    #smoothing: number;

    constructor(player: MusicPlayer, fftResolution: number = 12, smoothing = 0.8) {
        this.#player = player;
        this.#resolution = fftResolution;
        this.#analyzerNode = new Analyser({type: "fft", smoothing, size: 1 << fftResolution});
        this.#player.node.connect(this.#analyzerNode);
        this.#smoothing = smoothing;
    }

    get player() {
        return this.#player;
    }

    get analysisData(): Float32Array {
        return this.#analysisData;
    }

    set smoothing(smoothing: number) {
        this.#smoothing = smoothing;
        this.#analyzerNode.smoothing = smoothing;
    }

    get smoothing() {
        return this.#smoothing;
    }

    // resolution should be an integer in the range [4, 14]
    set resolution(resolution: number) {
        if (resolution < 4 || resolution > 14) throw new Error('Invalid analyzer resolution');
        this.#resolution = resolution;
        this.#analyzerNode.size = 1 << resolution;
    }

    get resolution() {
        return this.#resolution;
    }

    get maxFrequency() {
        // The maximum frequency available is the Nyquist frequency, which is half the sample rate
        return getContext().sampleRate / 2;
    }

    get numBins() {
        return this.#analyzerNode.size;
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

        const newData = getFFT(
            this.player.audio,
            this.player.position,
            this.resolution
        );

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