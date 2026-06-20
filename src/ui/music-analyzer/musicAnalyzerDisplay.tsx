"use client";

import { useMemo, useRef, useState } from "react";
import { now, start } from "tone";
import { MusicAnalyzer } from "@/logic/analyzer";
import { clamp, useManualRerender } from "@/lib/utils/util";

import "./musicAnalyzer.css";
import { MusicPlayer } from "@/logic/musicPlayer";
import {
    Listener, useListenerOnElement, useListenerOnWindow,
} from "@/lib/react-utils/hooks";
import { Canvas, TextAlignment } from "@/lib/canvas";
import { IntRange, NumberRange } from "@/lib/utils/numberRange";
import { LinearValueConvertor } from "@/lib/utils/valueConvertor";
import { SubarrayView } from "@/lib/utils/subarrayView";
import { MaximumFinder, MinMaxFinder } from "@/lib/utils/minMax";
import {
    freqToMidi, midiNoteValueToString,
} from "@/ui/music-analyzer/midiHelpers";
import { AnimatedCanvas } from "@/ui/music-analyzer/animatedCanvas";
import {
    Controls, handlePositionWheel,
} from "@/ui/music-analyzer/controls";
import { Smoother } from "@/lib/utils/smoother";

// Not exactly 27.5 - 4200 (A0 to C8) to leave space at ends
const frequencyRange = new NumberRange(25, 4320);

const midiRange = new IntRange(21, 108);
const midiToXFrac = LinearValueConvertor.fittingRangeTo(
    midiRange, new NumberRange(0.02, 0.993), // These values look nice
);

const volumeSmoother = new Smoother({
    initialValue: 2.5,
    func (err, elapsedTime) {
        err = Math.max(err * 2, -1.125);
        return Math.exp(-elapsedTime *
            err ** 6 * (1.5 + err) ** 2,
        );
    },
});

function normalizeAndProcessFFTData (data: SubarrayView<number>) {
    const decibelsRangeFinder = new MinMaxFinder();

    data.forEach(p => Number.isFinite(p) && decibelsRangeFinder.accept(p));

    volumeSmoother.update(
        Math.max(decibelsRangeFinder.get().end, 1) + 1.5, now());
    const max = volumeSmoother.value;
    const res = LinearValueConvertor.normalizing(new NumberRange(-2.5, max));
    data.modifyEach(res.convertForwards);
    return res;
}

function binPoints (p: [ number, number ][]): (readonly [ number, number ])[] {
    const bins: Map<number, [ number, number ][]> = new Map;
    for (let [ x, y ] of p) {
        x = Math.round(x * 4) / 4;
        if (!bins.has(x)) bins.set(x, []);
        bins.get(x)!.push([ x, y ]);
    }
    return [ ...bins.entries() ].map(
        ([ _, p ]) => {
            const [ px, py ] = [ 0, 1 ].map(i => p.map(j => j[i]));

            const py_total: number = py.reduce((a, b) => a + b ** 3, 0);
            return [
                px.reduce((a, b) => a + b, 0) / p.length,
                (py_total / p.length) ** 0.3333,
            ] as const;
        },
    ).sort((a, b) => a[0] - b[0]);
}

function redrawFFT (canvas: Canvas, analyzer: MusicAnalyzer) {
    if (!canvas.raw_ctx) return;

    canvas.raw_ctx!.globalCompositeOperation = "source-over";
    canvas.clear();

    const data = new Float32Array(analyzer.analysisData);
    const relevantBinIndexRange = analyzer.getBinIndexRangeForFrequencies(
        frequencyRange,
    );
    const normalizeIntensity = normalizeAndProcessFFTData(
        new SubarrayView<number>(data, relevantBinIndexRange),
    );

    // Calculate stuff
    const p: [ number, number ][] = [];

    const detectedPeaksText: {
        midi: number, yFrac: number, fontSize: number, text: string
    }[] = [];

    for (const i of relevantBinIndexRange) {
        const val = data[i];

        const frequency = i * analyzer.frequencyBinSize;
        const midi: number = freqToMidi.convertForwards(frequency);
        const y = Math.max(val, 0);

        p.push([ midi, y ]);
    }

    // Bin lines to reduce spline size.
    const binnedData = binPoints(p);
    const binIndices = IntRange.forIndicesOf(binnedData);
    const f = (i: number) => binnedData[i][1];
    for (const i of binIndices) {
        const midi: number = binnedData[i][0];
        const yFrac: number = binnedData[i][1];

        if (!(binIndices.includes(i - 1) && binIndices.includes(i + 1)))
            continue;
        if (yFrac <= f(i - 1) || yFrac <= f(i + 1))
            continue;

        const maxDepth = new MaximumFinder(0);
        let pos: number;
        pos = i + 1;
        while (binIndices.includes(pos)) {
            if (f(pos) < f(pos - 1)) {
                maxDepth.accept(yFrac - f(pos));
                pos++;
            }
            else break;
        }
        pos = i - 1;
        while (binIndices.includes(pos)) {
            if (f(pos) < f(pos + 1)) {
                maxDepth.accept(yFrac - f(pos));
                pos--;
            }
            else break;
        }

        if (maxDepth.get() > 0.1) {
            const fontSize: any = canvas.width * 0.006 * (
                Math.log10(maxDepth.get() * 10) ** 0.2
            );
            detectedPeaksText.push({
                midi,
                yFrac,
                fontSize,
                text: midiNoteValueToString(Math.round(midi)),
            });
        }
    }

    // Bin font sizes to reduce canvas ctx state changes, which can be quite
    // expensive
    const textBins: Map<number,
        Omit<(typeof detectedPeaksText)[number], "fontSize">[]
    > = new Map;
    for (const info of detectedPeaksText) {
        // "Exponential" rounding by the transformation x <-> 10 log(x + 1.11)
        // This results in ~25 bins for font sizes up to 40px
        const roundedFontSize = Math.exp(Math.round(
            10 * Math.log(info.fontSize + 4.1),
        ) / 10) - 4.1;
        // Skip tiny text
        if (roundedFontSize <= 1) continue;

        if (!textBins.has(roundedFontSize)) textBins.set(roundedFontSize, []);
        textBins.get(roundedFontSize)!.push(info);
    }

    // Draw grid
    canvas.strokeColor = "#ddd";
    for (let intensity = -2 ; intensity <= 10 ; intensity++) {
        const normalized = normalizeIntensity.convertForwards(intensity);
        if (normalized < 0 || normalized > 1) {
            continue;
        }
        const y = canvas.height * (1 - normalized);
        canvas.immediateLine(0, y, canvas.width, y);
    }
    canvas.strokeColor = "#aaa";
    for (const midi of midiRange) {
        const x = midiToXFrac.convertForwards(midi) * canvas.width;
        canvas.immediateLine(x, 0, x, canvas.height);
    }

    // Draw FFT
    canvas.strokeColor = '#000';
    canvas.immediateStrokeSpline([ 0, 0 ], ...binnedData.map(([ x, y ]) => [
        midiToXFrac.convertForwards(x) * canvas.width,
        (1 - y) * canvas.height,
    ] as const));
    for (const [ font_size, info ] of textBins) {
        canvas.font = `${ font_size }px sans-serif`;

        for (const { midi, yFrac, text } of info) {
            const x = midiToXFrac.convertForwards(midi) * canvas.width;
            const y = (1 - yFrac) * canvas.height;
            canvas.immediateFillCircle(x, y, 3);
            canvas.immediateFillText(text, x, y - canvas.height * 0.03);
        }
    }

    // Draw grid text
    canvas.fillColor = "#fff";
    canvas.immediateFillRect(0, 0, canvas.width * 0.016, canvas.height);
    canvas.fillColor = "#000";
    canvas.font = `${ canvas.width * 0.005 }px sans-serif`;
    for (let intensity = -2 ; intensity <= 10 ; intensity++) {
        const normalized = normalizeIntensity.convertForwards(intensity);
        if (normalized < 0 || normalized > 1) {
            continue;
        }
        const y = canvas.height * (1 - normalized);
        canvas.immediateFillText(
            `${ intensity >= 0 ? '+' : '' }${ intensity }dB`,
            canvas.width * 0.007, y,
        );
    }
    canvas.fillColor = "#fff";
    canvas.immediateFillRect(0, 0, canvas.width, canvas.height * 0.05);
    canvas.fillColor = "#000";
    for (const midi of midiRange) {
        const x = midiToXFrac.convertForwards(midi) * canvas.width;
        const noteName = midiNoteValueToString(midi);
        canvas.immediateFillText(noteName, x, canvas.height * .025);
    }
}

function redrawWaveform (canvas: Canvas, player: MusicPlayer): void {
    canvas.clear();

    canvas.strokeColor = '#aaa';
    canvas.strokeWidth = 1;

    if (!player.isAudioLoaded) {
        canvas.immediateLine(
            0, canvas.height / 2, canvas.width, canvas.height / 2);
        return;
    }

    const x = player.audio.arr;

    canvas.beginNewPath();
    canvas.beginSubPathAt(0, x[0] * canvas.height / 2);

    let m = 0.1;
    for (let i = 0 ; i < 1 ; i += 0.0005) {
        m = Math.max(m, Math.abs(x[~~(x.length * i)]));
    }

    for (let i = 0 ; i < 1 ; i += 0.0005) {
        const val = Math.abs(x[~~(x.length * i)]) / m * 0.8;

        canvas.lineTo(
            i * canvas.width, canvas.height * (1 + val) / 2);
        canvas.lineTo(
            i * canvas.width, canvas.height * (1 - val) / 2);
    }

    canvas.stroke();

    canvas.strokeColor = 'black';
    canvas.strokeWidth = 2;

    const playFraction = clamp(
        player.position / player.duration, 0, 1);
    canvas.immediateLine(
        playFraction * canvas.width, 0,
        playFraction * canvas.width, canvas.height,
    );

    canvas.stroke();
}

export function MusicAnalyzerDisplay () {
    const [ analyzer ] = useState(() => {
        return new MusicAnalyzer(new MusicPlayer());
    });
    const { player } = analyzer;

    const rerender = useManualRerender();

    player.onstart = player.onstop = () => rerender();

    useListenerOnWindow({
        listenerType: [
            "mousedown", "keypress",
        ], listener:  start,
    });

    const canvasRef = useRef<HTMLCanvasElement>(null);

    useListenerOnWindow({
        listenerType: 'keydown', listener: useMemo<Listener<KeyboardEvent>>(
            () => e => {
                if (e.key === ' ') {
                    e.preventDefault();
                    if (player.isPlaying) player.pause();
                    else player.play();
                }
                else if (e.key === 'LeftArrow') {
                    e.preventDefault();
                    player.position -= 5;
                }
            }, [ player ],
        ),
    });

    useListenerOnElement(canvasRef, {
        listenerType: 'wheel', listener: useMemo(
            () => (e: WheelEvent) => handlePositionWheel(e, player), [ player ],
        ),
        passive:      false,
    });

    return <div id="music-analyzer">
        <Controls analyzer={ analyzer }/>
        <div id="waveform">
            <AnimatedCanvas onClick={ (e) => {
                const bb = (e.target as HTMLCanvasElement).getBoundingClientRect();
                const clickFraction = (e.clientX - bb.left) / bb.width;
                player.position = clamp(clickFraction, 0, 1) * player.duration;
            } } onMouseMove={ (e) => {
                if (!(e.buttons & 1)) return;
                const bb = (e.target as HTMLCanvasElement).getBoundingClientRect();
                const clickFraction = (e.clientX - bb.left) / bb.width;
                player.position = clamp(clickFraction, 0, 1) * player.duration;
            } } initializer={ canvas => {
                canvas.clearColor = 'white';
            } } animator={ canvas => {
                canvas.resizeToFitCSS();
                redrawWaveform(canvas, player);
            } } ref={ canvasRef }/>
        </div>
        <div id="spectrum">
            <AnimatedCanvas initializer={ canvas => {
                canvas.fillColor = "black";
                canvas.clearColor = 'white';
                canvas.strokeWidth = 1;
                canvas.textAlignment = TextAlignment.Center;
                canvas.font = '11px sans-serif';
            } } animator={ canvas => {
                canvas.resizeToFitCSS();
                redrawFFT(canvas, analyzer);
            } }/>
        </div>
        <span id="music-analyzer-end"/>
    </div>;
}