import {Analyser, getContext, getDestination, Player, ToneAudioBuffer, ToneAudioNode} from "tone";
import {LinearValueConvertor} from "@/app/lib/utils/valueConvertor";

export class MusicPlayer {
    readonly #player: Player;

    constructor() {
        this.#player = new Player();
    }

    get sampleRate() : number {
        return 1 / this.#player.sampleTime;
    }

    play() {
        this.#player.start();
    }

    stop() {
        this.#player.stop();
    }

    set buffer(buffer: ToneAudioBuffer) {
        this.#player.buffer = buffer;
    }

    get node() : ToneAudioNode {
        return this.#player;
    }
}

export class MusicAnalyzer {
    readonly #waveformAnalyzerNode: Analyser;
    readonly #fftAnalyzerNode: Analyser;

    #waveformAnalysis: Float32Array = new Float32Array;
    #fftAnalysis: Float32Array = new Float32Array;

    constructor(fftResolution: number = 14) {
        this.#waveformAnalyzerNode = new Analyser({type: "waveform", size: 4096});
        this.#fftAnalyzerNode = new Analyser({type: "fft", size: 1 << fftResolution});
    }

    get waveformData() : Float32Array {
        return this.#waveformAnalysis
    }

    get fftData() : Float32Array  {
        return this.#fftAnalysis;
    }

    set fftResolution(resolution: number){
        if(resolution < 4 || resolution > 14) throw new Error('Invalid analyzer resolution');
        this.#fftAnalyzerNode.size = 1 << resolution;
    }

    get maxFrequency() {
        // The maximum frequency available is the Nyquist frequency, which is half the sample rate
        return getContext().sampleRate / 2;
    }

    get numBins() {
        return this.#fftAnalyzerNode.size;
    }

    get frequencyBinSize() {
        return this.maxFrequency / this.numBins;
    }

    get binIndexToFrequencyConvertor() {
        return new LinearValueConvertor(this.frequencyBinSize, 0);
    }

    getFrequencyStrengthDecibels(frequency: number){
        const binIndex = ~~this.binIndexToFrequencyConvertor.convertBackwards(frequency);
        if(binIndex >= this.numBins || binIndex < 0) return Number.NEGATIVE_INFINITY;
        return this.#fftAnalysis[binIndex];
    }

    reAnalyze() {
        const waveformData = this.#waveformAnalyzerNode.getValue();
        this.#waveformAnalysis = Array.isArray(waveformData) ? waveformData[0] : waveformData;
        const fftData = this.#fftAnalyzerNode.getValue();
        this.#fftAnalysis = Array.isArray(fftData) ? fftData[0] : fftData;
    }

    set source(node: ToneAudioNode) {
        node.fan(this.#waveformAnalyzerNode, this.#fftAnalyzerNode, getDestination());
    }
}