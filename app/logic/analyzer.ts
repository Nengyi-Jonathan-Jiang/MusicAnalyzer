import {Analyser, getContext, ToneAudioBuffer} from "tone";
import {convertRangeBackwards, LinearValueConvertor} from "@/app/lib/utils/valueConvertor";
import {IntRange, NumberRange} from "@/app/lib/utils/numberRange";
import {MusicPlayer} from "@/app/logic/musicPlayer";
import webfft from "webfft";
import {createArray} from "@/app/lib/utils/util";


function toArray(arr: Float32Array | Float32Array[]) : Float32Array {
    return Array.isArray(arr) ? arr[0] : arr;
}

function getWaveformData(buffer: ToneAudioBuffer, startTime: number) : Float32Array {
    return toArray(buffer.slice(startTime).toArray());
}

const blackmanWindowCache = new Map<number, Float32Array>;

function getFFT(buffer: ToneAudioBuffer, startTime: number, resolution: number) {
    let size = 1 << resolution;
    const fft = new webfft(size);
    fft.setSubLibrary('kissWasm');

    let data: Float32Array;

    try {
        data = getWaveformData(buffer, startTime).slice(0, size * 2);
        if(data.length < size * 2) { // noinspection ExceptionCaughtLocallyJS
            throw new Error();
        }
    }
    catch {
        // Not enough data
        let arr = toArray(buffer.toArray());
        data = arr.slice(arr.length - size * 2, arr.length);
    }

    // Compute blackman window
    if(!blackmanWindowCache.has(resolution)) {
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

    constructor(player: MusicPlayer, fftResolution: number = 12, smoothing=0.8) {
        this.#player = player;
        this.#resolution = fftResolution;
        this.#analyzerNode = new Analyser({type: "fft",  smoothing, size: 1 << fftResolution});
        this.#player.node.connect(this.#analyzerNode);
        this.#smoothing = smoothing;
    }

    get player() {
        return this.#player;
    }

    get analysisData() : Float32Array  {
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
    set resolution(resolution: number){
        if(resolution < 4 || resolution > 14) throw new Error('Invalid analyzer resolution');
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
        if(!this.player.isBufferLoaded) return;

        const newData = getFFT(this.player.buffer, this.player.position, this.resolution);

        if(this.#analysisData.length !== newData.length) {
            this.#analysisData = newData;
        }
        else {
            this.#analysisData = new Float32Array(createArray(newData.length, i => {
                const prevValue = this.#analysisData[i];
                const newValue = newData[i];

                if(isNaN(prevValue) || !isFinite(prevValue)) return newValue;
                return prevValue * this.smoothing + newValue * (1 - this.smoothing);
            }));
        }
    }
}