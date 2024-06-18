import {ToneAudioBuffer} from "tone";

import {ReadonlyRange} from "@/app/lib/utils/range";
import webfft from "webfft";

export function getWaveformData(buffer: ToneAudioBuffer, startTime: number) : Float32Array {
    const arr = buffer.slice(startTime).toArray();
    return Array.isArray(arr) ? arr[0] : arr;
}

export function getWaveformDataForTimeRange(buffer: ToneAudioBuffer, timeRange: ReadonlyRange) : Float32Array {
    const arr = buffer.slice(timeRange.start, timeRange.end).toArray();

    return Array.isArray(arr) ? arr[0] : arr;
}

export function getFFT(buffer: ToneAudioBuffer, startTime: number, resolution: number) {
    let size = 1 << resolution;
    const fft = new webfft(size);

    const data = getWaveformData(buffer, startTime).slice(0, size * 2);

    const out = fft.fft(data);
    fft.dispose();

    return out;
}