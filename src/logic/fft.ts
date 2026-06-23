import webfft from "webfft";
import { editArray } from "@/lib/utils/util";
import { AudioFile } from "@/logic/audioFile";
import { Cache } from "@/lib/utils/cache";
import CacheMultiple = Cache.CacheMultiple;

const windowFunctionCache = new CacheMultiple<Float32Array, [ number ]>(
    size => {
        return editArray(new Float32Array(size), (_, i) => {
            return 0.5 - 0.5 * Math.cos(2 * Math.PI * i / size);
        });
    },
);

const fftCache = new CacheMultiple<webfft, [ number ]>(size => {
    const res = new webfft(size);
    res.setSubLibrary('kissWasm');
    return res;
});

const inputArrayCache = new CacheMultiple<Float32Array, [ number ]>(
    size => new Float32Array(size * 2),
);

export function getFFT (
    audio: AudioFile, startTime: number, resolution: number,
    loop: boolean = false,
): Float32Array | null {
    const size: number = 1 << resolution;
    const fft = fftCache.get(size);
    const window = windowFunctionCache.get(size);
    const data = audio.getData(startTime, size, loop);
    const input = inputArrayCache.get(size);

    for (let i = 0 ; i < input.length ; i++) {
        input[i] = i & 1 ? 0 : data[i >> 1] * window[i >> 1];
    }

    try {
        return fft.fft(input);
    }

    catch (e) {
        console.warn(e);
        return null;
    }
}