import React from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import './ui.css';
import LoadingScreen from "@/ui/loadingScreen";
import { MusicAnalyzerDisplay } from "@/ui/music-analyzer/musicAnalyzerDisplay";

createRoot(document.getElementById('root')!).render(
    <div id="main">
        <LoadingScreen>
            <MusicAnalyzerDisplay/>
        </LoadingScreen>
    </div>
);
