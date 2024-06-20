"use client"

import {useEffect, useRef, useState} from "react";
import {start, ToneAudioBuffer} from "tone";
import {MusicAnalyzer} from "@/app/logic/analyzer";
import {clamp, useListenerOnWindow} from "@/app/lib/utils/util";

import "./musicAnalyzer.css"
import {MusicPlayer} from "@/app/logic/musicPlayer";
import {useAnimation} from "@/app/lib/react-utils/hooks";
import {Canvas, TextAlignment} from "@/app/lib/canvas";
import {NumberRange} from "@/app/lib/utils/numberRange";
import {LinearValueConvertor, logTransform} from "@/app/lib/utils/valueConvertor";
import {SubarrayView} from "@/app/lib/utils/subarrayView";
import {MaximumFinder, MinMaxFinder} from "@/app/lib/utils/minMax";
import {freqToMidiConvertor, midiNoteValueToString} from "@/app/ui/music-analyzer/midiHelpers";
import {AnimatedCanvas} from "@/app/ui/music-analyzer/animatedCanvas";
import {Uploader} from "@/app/ui/music-analyzer/uploader";

const frequencyRange =
    new NumberRange(27.5, 4200);

const freqToDisplayFractionConvertor = LinearValueConvertor.normalizingAfter(
    frequencyRange,
    logTransform
);

function normalizeAndProcessFFTData(data: SubarrayView<number>) {
    const decibelsRangeFinder = new MinMaxFinder();

    data.forEach(p => Number.isFinite(p) && decibelsRangeFinder.accept(p));

    data.modifyEach(LinearValueConvertor.normalizing(decibelsRangeFinder.get()).convertForwards)
        .modifyEach(i => i ** 2);
}

function redraw(canvas: Canvas, analyzer: MusicAnalyzer) {
    canvas.clear();

    canvas.strokeColor = "#aaa";
    canvas.font = `${canvas.width * 0.005}px sans-serif`;

    const data = new Float32Array(analyzer.analysisData);
    const relevantBinIndexRange = analyzer.getBinIndexRangeForFrequencies(frequencyRange)
    normalizeAndProcessFFTData(new SubarrayView<number>(data, relevantBinIndexRange));

    for (let midiNoteNumber = 21; midiNoteNumber <= 108; midiNoteNumber++) {
        const freq = freqToMidiConvertor.convertBackwards(midiNoteNumber);
        const x = freqToDisplayFractionConvertor.convertForwards(freq) * canvas.width;

        let noteName = midiNoteValueToString(midiNoteNumber);
        canvas.immediateFillText(noteName, x, canvas.height * .025);
        canvas.immediateLine(x, canvas.height * .05, x, canvas.height);
    }

    const p: [number, number][] = [];

    for (const i of relevantBinIndexRange) {
        const val = data[i];

        const frequency = i * analyzer.frequencyBinSize;
        const midiNote = Math.round(freqToMidiConvertor.convertForwards(frequency));

        const x = freqToDisplayFractionConvertor.convertForwards(frequency) * canvas.width;
        const y = canvas.height * (1 - .9 * val);

        // Check for peaks
        if(relevantBinIndexRange.includes(i - 1) && relevantBinIndexRange.includes(i + 1)) {
            if(val > data[i - 1] && val > data[i + 1]) {
                // Found a peak, check depth

                let maxDepth = new MaximumFinder(0);

                let pos : number;
                pos = i + 1;
                while(relevantBinIndexRange.includes(pos)) {
                    if(data[pos] < data[pos - 1]) {
                        maxDepth.accept(val - data[pos]);
                        pos++;
                    }
                    else break;
                }
                pos = i - 1;
                while(relevantBinIndexRange.includes(pos)) {
                    if(data[pos] < data[pos + 1]) {
                        maxDepth.accept(val - data[pos]);
                        pos--;
                    }
                    else break;
                }

                if(maxDepth.get() > 0.1) {
                    canvas.immediateFillCircle(x, y, 3);

                    canvas.font = `${canvas.width * 0.006 * (
                        Math.log10(maxDepth.get() * 10) ** 0.2
                    )}px sans-serif`;
                    canvas.immediateFillText(midiNoteValueToString(midiNote), x, y - canvas.height * 0.03);
                }
            }
        }

        p.push([x, y]);
    }

    canvas.strokeColor = 'black';
    canvas.immediateStrokeSpline(...p);
}

export function MusicAnalyzerDisplay() {
    const [analyzer] = useState(() => {
        const player = new MusicPlayer();
        player.node.toDestination();
        return new MusicAnalyzer(player);
    });
    const {player} = analyzer;

    const [playing, setPlaying] = useState(false);

    player.onstart = () => setPlaying(true);
    player.onstop = () => setPlaying(false);

    useListenerOnWindow(window, "mousedown", () => start());

    const ref = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        if(ref.current) ref.current.innerText = '0.000';
    }, []);

    useAnimation(() => {
        if(analyzer.player.isPlaying) {
            if (ref.current) {
                ref.current.innerText = `${player.position.toFixed(3)}`;
            }

            analyzer.reAnalyze();
        }
    });

    return <div id="music-analyzer">
        <div id="playback-controls">

            <button id="rewind-button" onClick={() => {
                player.rewind()
            }}>{"<=="}</button>
            <button id="playpause-button" onClick={() => {
                if (player.isPlaying) player.pause();
                else player.play();
            }}>{player.isPlaying ? "||" : "|>"}</button>

            <div>
                <span>Current position: </span>
                <span ref={ref} contentEditable={player.isPlaying ? undefined : true} onKeyDown={e => {
                    if(!e.key.match(/^[.\d]|Home|End|Arrow.*|Backspace$/)) {
                        e.preventDefault();
                    }
                }}></span>

                <div id="current-position-adjust">
                    <button onClick={() => {
                        player.position += 0.01;
                        analyzer.reAnalyzeImmediate();
                    }}>+</button>
                    <button onClick={() => {
                        player.position -= 0.01;
                        analyzer.reAnalyzeImmediate();
                    }}>-</button>
                </div>
            </div>

            <div id="divider"></div>

            <Uploader callback={(url, revokeURL) => {
                player.buffer = new ToneAudioBuffer(url, revokeURL);
            }} fileTypes={[".mp3", ".wav"]}/>
        </div>
        <div id="waveform">
            <AnimatedCanvas initializer={canvas => {
                canvas.clearColor = 'white';
            }} animator={canvas => {
                canvas.clear();

                canvas.strokeColor = '#aaa';
                canvas.strokeWidth = 1;

                if(!player.isBufferLoaded) {
                    canvas.immediateLine(0, canvas.height / 2, canvas.width, canvas.height / 2);
                    return;
                }

                const x = player.bufferAsFloat32Array;

                canvas.beginNewPath();
                canvas.beginSubPathAt(0, x[0] * canvas.height / 2);

                for (let i = 0; i <= canvas.width; i ++) {
                    const p = (i - 1) / canvas.width;

                    let val = Math.abs(x[~~(x.length * p)]);

                    canvas.lineTo(i, canvas.height * (1 + val) / 2);
                    canvas.lineTo(i, canvas.height * (1 - val) / 2);
                }

                canvas.stroke();

                canvas.strokeColor = 'black';
                canvas.strokeWidth = 2;

                let playFraction = clamp(player.position / player.duration, 0, 1);
                canvas.immediateLine(
                    playFraction * canvas.width, 0,
                    playFraction * canvas.width, canvas.height
                );

                canvas.stroke();
            }}/>
        </div>
        <div id="spectrum">
            <AnimatedCanvas initializer={canvas => {
                canvas.fillColor = "black";
                canvas.clearColor = 'white';
                canvas.strokeWidth = 1;
                canvas.textAlignment = TextAlignment.Center;
                canvas.font = '11px sans-serif';
            }} animator={canvas => {
                canvas.resizeToFitCSS();
                redraw(canvas, analyzer);
            }}/>
        </div>
        <div id="analysis-controls">
            <input type="range" min="10" max="14" step="1" defaultValue="12" onInput={({target}) => {
                analyzer.resolution = +(target as HTMLInputElement).value;
            }}/>
        </div>

        <div>
        </div>
    </div>;
}