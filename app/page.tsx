"use client"

import './ui.css'
import './style.css'

import React from "react";
import LoadingScreen from "@/app/ui/loadingScreen";
import {MusicAnalyzerDisplay} from "@/app/ui/music-analyzer/musicAnalyzerDisplay";

export default function Page() {
    return (
        <div id="main">
            <LoadingScreen>
                <MusicAnalyzerDisplay/>
            </LoadingScreen>
        </div>
    );
}
