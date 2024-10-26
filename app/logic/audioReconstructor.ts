import {now, Oscillator, ToneOscillatorNode} from "tone";
import {createArray} from "@/app/lib/utils/util";
import {MusicAnalyzer} from "@/app/logic/analyzer";
import {freqToMidiConvertor} from "@/app/ui/music-analyzer/midiHelpers";
import {MaximumFinder} from "@/app/lib/utils/minMax";
import {IntRange} from "@/app/lib/utils/numberRange";

function filterFFTResult(
    analyzer: MusicAnalyzer,
    mag: Float32Array,
    real: Float32Array,
    imag: Float32Array,
    cutoff: number
): [Float32Array, Float32Array] {
    let data = mag.map(i => Math.log(i));

    let len = real.length;
    let range = new IntRange(0, len - 1);

    const res_real = new Float32Array(len);
    const res_imag = new Float32Array(len);

    for (const i of range) {
        const val = data[i];

        // Check for peaks
        if (i > 0 && i < len - 1) {
            if (val > data[i - 1] && val > data[i + 1]) {
                // Found a peak, check depth

                const maxDepth = new MaximumFinder(0);

                let pos: number;
                pos = i + 1;
                while (range.includes(pos)) {
                    if (data[pos] < data[pos - 1]) {
                        maxDepth.accept(val - data[pos]);
                        pos++;
                    } else break;
                }
                pos = i - 1;
                while (range.includes(pos)) {
                    if (data[pos] < data[pos + 1]) {
                        maxDepth.accept(val - data[pos]);
                        pos--;
                    } else break;
                }

                if (maxDepth.get() > cutoff) {
                    // Keep this peak
                    res_real[i] = real[i];
                    res_imag[i] = imag[i];
                }
            }
        }
    }

    return [
        res_real,
        res_imag
    ];
}

export class AudioReconstructor {
    private readonly oscillator: ToneOscillatorNode;

    constructor() {
        this.oscillator = new ToneOscillatorNode(1, "sine")
        this.oscillator.toDestination();
    }

    set_data(analyzer: MusicAnalyzer) {
        const fft_data = analyzer.rawAnalysisData;
        const real = analyzer.rawAnalysisData.filter((_, i) => i % 2 == 0);
        const imag = analyzer.rawAnalysisData.filter((_, i) => i % 2 == 1);
        const freq = analyzer.frequencyBinSize;
        this.oscillator.frequency.value = freq;
        this.oscillator.setPeriodicWave(this.oscillator.context.createPeriodicWave(
            ...filterFFTResult(analyzer, analyzer.analysisData, real, imag, 1.)
        ));

        console.log(fft_data, freq);
    }

    start(time: number = 0) {
        this.oscillator.start(time + now());
    }

    stop(time: number = 0) {
        this.oscillator.stop(time + now());
    }
}