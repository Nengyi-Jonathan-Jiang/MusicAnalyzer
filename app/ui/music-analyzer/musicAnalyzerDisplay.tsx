"use client";

import { ReactElement, useEffect, useMemo, useRef, useState } from "react";
import { start } from "tone";
import { MusicAnalyzer } from "@/app/logic/analyzer";
import { clamp, useManualRerender } from "@/app/lib/utils/util";

import "./musicAnalyzer.css";
import { MusicPlayer } from "@/app/logic/musicPlayer";
import {
    Listener, useAnimation, useListenerOnElement, useListenerOnWindow,
} from "@/app/lib/react-utils/hooks";
import { Canvas, TextAlignment } from "@/app/lib/canvas";
import { NumberRange } from "@/app/lib/utils/numberRange";
import {
    LinearValueConvertor, logTransform,
} from "@/app/lib/utils/valueConvertor";
import { SubarrayView } from "@/app/lib/utils/subarrayView";
import { MaximumFinder, MinMaxFinder } from "@/app/lib/utils/minMax";
import {
    freqToMidiConvertor, midiNoteValueToString,
} from "@/app/ui/music-analyzer/midiHelpers";
import { AnimatedCanvas } from "@/app/ui/music-analyzer/animatedCanvas";
import { Controls, handlePositionWheel } from "@/app/ui/music-analyzer/controls";

const frequencyRange = new NumberRange(27.5, 4200);

const freqToDisplayFractionConvertor = LinearValueConvertor.normalizingAfter(
    frequencyRange,
    logTransform,
);

function normalizeAndProcessFFTData (data: SubarrayView<number>) {
    const decibelsRangeFinder = new MinMaxFinder();

    data.forEach(p => Number.isFinite(p) && decibelsRangeFinder.accept(p));

    data.modifyEach(LinearValueConvertor.normalizing(
        decibelsRangeFinder.get()).convertForwards)
        .modifyEach(i => i ** 2);
}

function redraw (canvas: Canvas, analyzer: MusicAnalyzer) {
    canvas.clear();

    canvas.strokeColor = "#aaa";
    canvas.font = `${ canvas.width * 0.005 }px sans-serif`;

    const data = new Float32Array(
        analyzer.analysisData.map(
            i => i,
        ),
    );
    const relevantBinIndexRange = analyzer.getBinIndexRangeForFrequencies(
        frequencyRange);
    normalizeAndProcessFFTData(
        new SubarrayView<number>(data, relevantBinIndexRange));

    for (let midiNoteNumber = 21 ; midiNoteNumber <= 108 ; midiNoteNumber++) {
        const freq = freqToMidiConvertor.convertBackwards(midiNoteNumber);
        const x = freqToDisplayFractionConvertor.convertForwards(
            freq) * canvas.width;

        const noteName = midiNoteValueToString(midiNoteNumber);
        canvas.immediateFillText(noteName, x, canvas.height * .025);
        canvas.immediateLine(x, canvas.height * .05, x, canvas.height);
    }

    const p: [ number, number ][] = [];

    for (const i of relevantBinIndexRange) {
        const val = data[i];

        const frequency = i * analyzer.frequencyBinSize;
        const midiNote = Math.round(
            freqToMidiConvertor.convertForwards(frequency));

        const x = freqToDisplayFractionConvertor.convertForwards(
            frequency) * canvas.width;
        const y = canvas.height * (1 - .9 * val);

        // Check for peaks
        if (relevantBinIndexRange.includes(
            i - 1) && relevantBinIndexRange.includes(i + 1)) {
            if (val > data[i - 1] && val > data[i + 1]) {
                // Found a peak, check depth

                const maxDepth = new MaximumFinder(0);

                let pos: number;
                pos = i + 1;
                while (relevantBinIndexRange.includes(pos)) {
                    if (data[pos] < data[pos - 1]) {
                        maxDepth.accept(val - data[pos]);
                        pos++;
                    }
                    else break;
                }
                pos = i - 1;
                while (relevantBinIndexRange.includes(pos)) {
                    if (data[pos] < data[pos + 1]) {
                        maxDepth.accept(val - data[pos]);
                        pos--;
                    }
                    else break;
                }

                if (maxDepth.get() > 0.1) {
                    canvas.immediateFillCircle(x, y, 3);

                    canvas.font = `${ canvas.width * 0.006 * (
                        Math.log10(maxDepth.get() * 10) ** 0.2
                    ) }px sans-serif`;
                    canvas.immediateFillText(
                        midiNoteValueToString(midiNote), x,
                        y - canvas.height * 0.03,
                    );
                }
            }
        }

        p.push([ x, y ]);
    }

    canvas.strokeColor = 'black';
    canvas.immediateStrokeSpline(...p);
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
            () => (e: WheelEvent) => handlePositionWheel(e, player), [ player]
        ),
        passive:      false,
    });

    return <div id="music-analyzer">
        <Controls analyzer={analyzer}/>
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
                redraw(canvas, analyzer);
            } }/>
        </div>
    </div>;
}