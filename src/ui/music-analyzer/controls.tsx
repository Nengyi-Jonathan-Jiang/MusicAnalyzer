import { MusicPlayer } from "@/logic/musicPlayer";
import { ToneAudioBuffer } from "tone";
import { AudioFile } from "@/logic/audioFile";
import { Uploader } from "@/ui/music-analyzer/uploader";
import { NumberRange } from "@/lib/utils/numberRange";
import { ReactElement, useEffect, useMemo, useRef, useState } from "react";
import { MusicAnalyzer } from "@/logic/analyzer";
import { useAnimation, useListenerOnElement } from "@/lib/react-utils/hooks";
import {
    NumericValueConvertor, powTransform, ValueConvertor,
} from "@/lib/utils/valueConvertor";

import "./controls.css";

import PauseIcon from '@/icon/pause.svg?react';
import PlayIcon from '@/icon/play.svg?react';
import RepeatEnabledIcon from '@/icon/repeat-enabled.svg?react';
import RepeatDisabledIcon from '@/icon/repeat-disabled.svg?react';
import RewindIcon from '@/icon/rewind.svg?react';

const SUPPORTED_AUDIO_FORMATS: string[] = [
    ".mp3", ".m4a", ".mp4", ".wav", ".ogg", ".webm", ".flac",
];

export function Controls ({ analyzer }: { analyzer: MusicAnalyzer }) {
    const player = analyzer.player;
    const [ doRepeat, setDoRepeat ] = useState(player.doRepeat);

    const ref = useRef<HTMLSpanElement>(null);
    useEffect(() => {
        if (ref.current) {
            ref.current.textContent = '0.000';
        }
    }, []);

    useAnimation(useMemo(() => () => {
        if (ref.current) {
            const s = `${ player.position.toFixed(2) }`;
            if (ref.current.textContent !== s) {
                ref.current.textContent = s;
            }
        }
        analyzer.reAnalyze();
    }, []));

    useListenerOnElement(ref, {
        listenerType: 'wheel',
        listener:     useMemo(
            () => (e: WheelEvent) => handlePositionWheel(e, player),
            [ player ],
        ),
        passive:      false,
    });

    return <div id="playback-controls">
        <Uploader
            callback={ (url, onLoad, name) => {
                // Need to convert to mono
                let buffer = new ToneAudioBuffer(url, onLoad);
                player.audio = new AudioFile(buffer);
                document.title = `Music Analyzer | ${ name }`;
            } }
            fileTypes={ SUPPORTED_AUDIO_FORMATS }
            labelProps={ { id: "uploader" } }/>

        <button id="rewind-button" onClick={ () => {
            player.rewind();
        } }>{ <RewindIcon/> }</button>
        <button id="playpause-button" onClick={ () => {
            if (player.isPlaying) player.pause();
            else player.play();
        } }>{ player.isPlaying ? <PauseIcon/> : <PlayIcon/> }</button>

        <button id="repeat-button" onClick={ () => {
            setDoRepeat(player.doRepeat = !player.doRepeat);
        } }>
            { doRepeat ? <RepeatEnabledIcon/> : <RepeatDisabledIcon/> }
        </button>

        <label id="current-position-display"
               style={ { "--text-width": '3.5em' } as any }>
            <span>Current position: </span>
            <span
                ref={ ref }>{ `${ player.position.toFixed(
                2) }` }</span>
        </label>

        <div className="divider"/>
        <div id="playback-controls-center"/>
        <div className="divider"/>

        <Slider id="volume" name="Volume"
                range={ new NumberRange(0, 2) }
                step={ 0.02 }
                value={ player.volume }
                setValue={ v => player.volume = v }
                convertor={ powTransform(2) }
                displayText={ value => value.toFixed(2) }
                displayWidth={ 2.4 }/>

        <div className="divider"/>

        <Slider id="smoothing" name="Smoothing"
                range={ new NumberRange(0, 1) }
                step={ 0.02 }
                value={ analyzer.smoothing }
                setValue={ s => analyzer.smoothing = s }
                displayText={ s => s.toFixed(2) }
                displayWidth={ 2.4 }/>

        <div className="divider"/>

        <Slider id="spectral-resolution" name="Resolution"
                range={ MusicAnalyzer.allowedResolutions }
                step={ 1 }
                value={ analyzer.resolution }
                setValue={ r => analyzer.resolution = r }
                displayText={ r => [
                    "Fastest",
                    "Faster",
                    "Balanced",
                    "Fine",
                    "Finer",
                    "Finest",
                ][r - MusicAnalyzer.allowedResolutions.start] }
                displayWidth={ 4.5 }/>
    </div>;
}

/**
 * @param convertor Converts slider values to what gets passed to setValue.
 *                  The backwards conversion is applied to `value`
 */
function Slider ({
    id, name,
    value, setValue,
    range, step, convertor,
    displayText, displayWidth,
}: {
    id: string, name: string,

    value: number, setValue: (value: number) => void,

    range: NumberRange, step: number,
    convertor?: NumericValueConvertor

    displayText: (value: number) => string, displayWidth: number
}): ReactElement {
    convertor ??= ValueConvertor.identity();

    return <label id={ id } className="slider">
        <span>{ name }{ ": " }</span>
        <input type="range"
               min={ range.start }
               max={ range.end }
               step={ step }
               defaultValue={ convertor.convertBackwards(value) }
               onInput={ ({ target }) => {
                   const newValue = +(target as HTMLInputElement).value;
                   setValue(convertor!.convertForwards(newValue));
                   ((target as HTMLElement).nextElementSibling as HTMLElement)
                       .textContent = displayText(newValue);
               } }/>
        <span style={ { '--text-width': `${ displayWidth }em` } as any }>
            { displayText(convertor.convertBackwards(value)) }
        </span>
    </label>;
}

export function handlePositionWheel (e: WheelEvent, player: MusicPlayer) {
    if (e.ctrlKey) return;
    const scrollMultiplier = (e.altKey ? 0.05 : 1);
    player.position += e.deltaY / 100 * scrollMultiplier;
    e.preventDefault();
}
