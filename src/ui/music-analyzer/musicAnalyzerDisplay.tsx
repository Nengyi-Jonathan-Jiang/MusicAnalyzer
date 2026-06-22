"use client";

import { useMemo, useRef, useState } from "react";
import { start } from "tone";
import { MusicAnalyzer } from "@/logic/analyzer";
import { clamp, useManualRerender } from "@/lib/utils/util";

import "./musicAnalyzer.css";
import { MusicPlayer } from "@/logic/musicPlayer";
import {
    Listener, useListenerOnElement, useListenerOnWindow,
} from "@/lib/react-utils/hooks";
import { TextAlignment } from "@/lib/canvas";
import { AnimatedCanvas } from "@/ui/music-analyzer/animatedCanvas";
import { Controls, handlePositionWheel } from "@/ui/music-analyzer/controls";
import { drawFFT } from "@/ui/music-analyzer/drawFFT";

import { drawWaveform } from "@/ui/music-analyzer/drawWaveform";

// TODO: add text when no music selected and while audio buffers are loading
//
// TODO: add piano keyboard to notes at top of FFT display

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
                if (e.key === ' ' && !e.repeat) {
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
            } } initializer={ () => {

            } } animator={ canvas => {
                canvas.resizeToFitCSS();
                drawWaveform(canvas, player);
            } } ref={ canvasRef }/>
        </div>
        <div id="spectrum">
            <AnimatedCanvas initializer={ canvas => {
                canvas.textAlignment = TextAlignment.Center;
            } } animator={ canvas => {
                canvas.resizeToFitCSS(2);
                drawFFT(canvas, analyzer);
            } }/>
        </div>
        <span id="music-analyzer-end"/>
    </div>;
}