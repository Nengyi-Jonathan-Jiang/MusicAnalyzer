import {useContext, useEffect, useRef, useState} from "react";
import {MusicAnalyzer} from "@/app/logic/analyzer";
import {AnalyzerContext} from "@/app/ui/music-analyzer/musicAnalyzerDisplay";
import {LinearValueConvertor, ValueConvertor} from "@/app/lib/utils/valueConvertor";
import {Range} from "@/app/lib/utils/range";
import {getContext, Oscillator} from "tone";
import {AudioContext} from "standardized-audio-context";
import {Canvas} from "@/app/lib/canvas";
import {useListenerOnWindow} from "@/app/lib/utils/util";

const MIN_FREQ = 27.5;
const MAX_FREQ = 4200;

const freqToMidiConvertor = ValueConvertor.logTransform.composedWith(
    LinearValueConvertor.fittingRangeTo(
        ValueConvertor.logTransform.convertRangeForwards(new Range(220, 440)),
        new Range(57, 69)
    )
);

const freqToDisplayFractionConvertor = ValueConvertor.logTransform.composedWith(
    LinearValueConvertor.fittingRangeTo(
        ValueConvertor.logTransform.convertRangeForwards(new Range(MIN_FREQ, MAX_FREQ)),
        new Range(0, 1)
    )
)

function midiNoteValueToString(n: number) {
    return n < 21 ? '?' : [
        'C', 'C#', 'D', 'Eb', 'E', 'F',
        'F#', 'G', 'Ab', 'A', 'Bb', 'B'
    ][n % 12] + ~~((n - 12) / 12);
}

function redrawCanvases(waveformCanvas: Canvas, fftCanvas: Canvas, analyzer: MusicAnalyzer) {
    waveformCanvas.fillColor = 'white';
    waveformCanvas.strokeColor = 'black';
    waveformCanvas.clearColor = 'white';
    fftCanvas.fillColor = 'white';
    fftCanvas.strokeColor = 'black';
    fftCanvas.clearColor = 'white';

    waveformCanvas.clear();
    fftCanvas.clear();

    const {waveformData, fftData} = analyzer;

    waveformCanvas.beginNewPath();
    waveformCanvas.beginSubPathAt(0, waveformData[0] * 150);

    for (let i = 1; i <= 1200; i++) {
        waveformCanvas.lineTo(i, 150 + waveformData[i] * 150);
    }

    waveformCanvas.stroke();

    let minDecibels = Number.POSITIVE_INFINITY;
    let maxDecibels = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < analyzer.numBins; i++) {
        const frequency = i * analyzer.frequencyBinSize;
        if (frequency < MIN_FREQ || frequency > MAX_FREQ) continue;

        const strength = analyzer.fftData[i];

        if (Number.isFinite(strength)) {
            minDecibels = Math.min(minDecibels, strength);
            maxDecibels = Math.max(maxDecibels, strength);
        }
    }

    fftCanvas.beginNewPath();
    fftCanvas.beginSubPathAt(0, 280);

    for (let i = 0; i < analyzer.numBins; i++) {
        const frequency = i * analyzer.frequencyBinSize;
        if (frequency < MIN_FREQ || frequency > MAX_FREQ) continue;

        const x = freqToDisplayFractionConvertor.convertForwards(frequency) * 1200;

        const val = analyzer.getFrequencyStrengthDecibels(frequency);

        fftCanvas.lineTo(x, 300 - 280 * (val - minDecibels) / (maxDecibels - minDecibels));
    }

    fftCanvas.stroke();

    fftCanvas.fillColor = "black";
    for (let midiNoteNumber = 21; midiNoteNumber < 108; midiNoteNumber++) {
        const freq = freqToMidiConvertor.convertBackwards(midiNoteNumber);
        const x = freqToDisplayFractionConvertor.convertForwards(freq) * 1200;

        if (midiNoteNumber % 12 == 0) {
            fftCanvas.immediateFillText(midiNoteValueToString(midiNoteNumber), x, 400);
        }
    }
}

export function AnalysisResultDisplay() {
    const analyzer = useContext(AnalyzerContext) as MusicAnalyzer;

    // @ts-ignore
    window.analyzer = analyzer;

    const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
    const fftCanvasRef = useRef<HTMLCanvasElement>(null);

    const [waveformCanvas] = useState(() => {
        const canvas = new Canvas(waveformCanvasRef);
        canvas.width = 1200;
        canvas.height = 300;
        return canvas;
    }), [fftCanvas] = useState(() => {
        const canvas = new Canvas(fftCanvasRef);
        canvas.width = 1200;
        canvas.height = 300;
        return canvas;
    });

    useEffect(() => {
        let frame: number;

        fftCanvas.font = '8px arial';

        frame = requestAnimationFrame(function f() {
            analyzer.reAnalyze();
            redrawCanvases(waveformCanvas, fftCanvas, analyzer);
            frame = requestAnimationFrame(f);
        })

        return () => cancelAnimationFrame(frame);
    }, []);

    return <div id="analysisResult">
        <canvas ref={waveformCanvasRef} width={1200} height={300}></canvas>
        <canvas ref={fftCanvasRef} width={1200} height={500}></canvas>
        <div id="guessedChords">

        </div>
    </div>
}