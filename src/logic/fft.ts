import webfft from "webfft";
import { editArray } from "@/lib/utils/util";
import { AudioFile } from "@/logic/audioFile";
import CacheMultiple = Cache.CacheMultiple;
import { Cache } from "@/lib/utils/cache";

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

export function getFFT (
    audio: AudioFile, startTime: number, resolution: number,
    loop: boolean = false,
): Float32Array | null {
    const size: number = 1 << resolution;
    const fft: webfft = fftCache.get(size);
    const window = windowFunctionCache.get(size);
    const data: Float32Array = audio.getData(startTime, size, loop);

    try {
        return fft.fft(editArray(
            new Float32Array(size * 2),
            (_, i) => i & 1 ? 0 : data[i >> 1] * window[i >> 1],
        ));
    }

    catch (e) {
        console.warn(e);
        return null;
    }
}