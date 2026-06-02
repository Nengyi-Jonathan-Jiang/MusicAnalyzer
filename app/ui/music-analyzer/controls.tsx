import { MusicPlayer } from "@/app/logic/musicPlayer";
import { ToneAudioBuffer } from "tone";
import { AudioFile } from "@/app/logic/audioFile";
import { Uploader } from "@/app/ui/music-analyzer/uploader";
import { NumberRange } from "@/app/lib/utils/numberRange";
import { ReactElement, useEffect, useMemo, useRef, useState } from "react";
import { MusicAnalyzer } from "@/app/logic/analyzer";
import {
    useAnimation, useListenerOnElement,
} from "@/app/lib/react-utils/hooks";
import {
    NumericValueConvertor, powTransform, ValueConvertor,
} from "@/app/lib/utils/valueConvertor";

import "./controls.css";

import PauseIcon from '@/app/icon/pause.svg';
import PlayIcon from '@/app/icon/play.svg';
import RepeatEnabledIcon from '@/app/icon/repeat-enabled.svg';
import RepeatDisabledIcon from '@/app/icon/repeat-disabled.svg';
import RewindIcon from '@/app/icon/rewind.svg';

const SUPPORTED_AUDIO_FORMATS: string[] = [
    ".mp3", ".m4a", ".mp4", ".wav", ".ogg", ".webm", ".flac",
];

export function Controls ({ analyzer }: { analyzer: MusicAnalyzer }) {
    const player = analyzer.player;
    const [ doRepeat, setDoRepeat ] = useState(player.doRepeat);

    const ref = useRef<HTMLSpanElement>(null);
    useEffect(() => {
        if (ref.current) {
            ref.current.innerText = '0.000';
        }
    }, []);

    useAnimation(useMemo(() => () => {
        if (ref.current) {
            const s = `${ player.position.toFixed(2) }`;
            if (ref.current.innerText !== s) {
                ref.current.innerText = s;
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
            callback={ (url, onLoad) => {
                // Need to convert to mono
                let buffer = new ToneAudioBuffer(url, onLoad);
                player.audio = new AudioFile(buffer);
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

        <label id="current-position-display">
            <span>Current position: </span>
            <span
                ref={ ref }>{ `${ player.position.toFixed(
                2) }` }</span>
        </label>

        <div className="divider"/>
        <div id="playback-controls-center"/>
        <div className="divider"/>

        <Slider id="volume" name="Volume"
                range={ new NumberRange(0, 1.5) }
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
                range={ new NumberRange(10, 16) }
                step={ 1 }
                value={ analyzer.resolution }
                setValue={ r => analyzer.resolution = r }
                displayText={ r => [
                    "Fastest",
                    "Faster",
                    "Balanced",
                    "Fine",
                    "Finer",
                    "Super",
                    "Best",
                ][r - 10] }
                displayWidth={ 4.5 }/>
    </div>;
}

export function handlePositionWheel (e: WheelEvent, player: MusicPlayer) {
    const scrollMultiplier = (e.ctrlKey ? 2 : e.altKey ? 0.25 : 1);
    player.position += e.deltaY / 100 * scrollMultiplier;
    e.preventDefault();
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
                       .innerText = displayText(newValue);
               } }/>
        <span style={ { '--text-width': `${ displayWidth }em` } as any }>
            { displayText(convertor.convertBackwards(value)) }
        </span>
    </label>;
}
