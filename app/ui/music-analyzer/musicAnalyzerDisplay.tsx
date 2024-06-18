"use client"

import {createContext, useContext, useEffect, useState} from "react";
import {Oscillator, start, ToneAudioBuffer} from "tone";
import {MusicAnalyzer, MusicPlayer} from "@/app/logic/analyzer";
import {useListenerOnWindow} from "@/app/lib/utils/util";
import {AnalysisResultDisplay} from "@/app/ui/music-analyzer/AnalysisResultDisplay";
import {getFFT} from "@/app/logic/analyzeAll";

import "./musicAnalyzer.css"

export const AnalyzerContext = createContext<MusicAnalyzer>(new MusicAnalyzer());

// @ts-ignore
window.getFFT = getFFT

function Uploader({player}: {player: MusicPlayer}) {
    function onUpload({target}: { target: HTMLInputElement }) {
        if (!target.files?.length) return;

        const urlObj = URL.createObjectURL(target.files[0]);

        const buffer = new ToneAudioBuffer(urlObj, () => URL.revokeObjectURL(urlObj));
        player.buffer = buffer;

        // @ts-ignore
        window.buffer = buffer;
    }

    return <div>
        <input type="file" accept=".mp3, .wav" onChange={onUpload}/>
    </div>
}

export function MusicAnalyzerDisplay() {
    const [analyzer] = useState(() => new MusicAnalyzer());
    const [player] = useState(() => new MusicPlayer());

    useEffect(() => {
        analyzer.source = player.node;
    }, []);

    useListenerOnWindow(window, "mousedown", () => start());

    return <div id="music-analyzer">
        <AnalyzerContext.Provider value={analyzer}>
            <Uploader player={player}/>
            <button onClick={() => player.play()}>Play</button>
            <AnalysisResultDisplay/>
        </AnalyzerContext.Provider>
    </div>;
}