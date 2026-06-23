import { ToneAudioBuffer } from "tone";
import { Cache } from "@/lib/utils/cache";
import CacheSingle = Cache.CacheSingle;
import { clamp } from "@/lib/utils/math";

const emptyArray = new Float32Array(2 << 16);

export class AudioFile {
    public readonly buffer: ToneAudioBuffer;

    constructor (buffer: ToneAudioBuffer) {
        this.buffer = buffer;
    }

    /**
     * Creates a slice of the data around a point
     *
     * The returned array is a readonly (by convention) view of length `samples`
     */
    public getData (
        time: number, samples: number,
        loop: boolean = false,
    ): Readonly<Float32Array> {
        const sample = clamp(
            time * this.buffer.sampleRate, 0, this.audioData.length,
        );

        const index_center = Math.round(sample - samples * 0.25);
        const index_start = index_center - (samples >> 1);
        const index_end = index_center + samples - (samples >> 1);

        const padding: number = samples;
        const extendedArr = this.#getExtendedArr(padding, loop);
        return extendedArr.subarray(index_start + padding, index_end + padding);
    }

    get audioData (): Readonly<Float32Array> {
        if (!this.buffer.loaded) return emptyArray;
        return this.#audioData.get();
    }

    readonly #audioData = new CacheSingle<Float32Array>(() => {
        let res = this.buffer.toArray();

        // Collapse stereo to mono
        if (!(res instanceof Float32Array)) {
            const channels = res;
            res = new Float32Array(channels[0].length);
            for (const channel of channels) {
                for (let i = 0 ; i < res.length ; i++) {
                    res[i] += channel[i];
                }
            }

            for (let i = 0 ; i < res.length ; i++) {
                res[i] /= channels.length;
            }

            this.buffer.fromArray(res);
        }

        return res;
    });

    #getExtendedArr (padding: number, loop: boolean = false) {
        const arr: Readonly<Float32Array> = this.audioData;
        return (
            arr.length === 0 ? this.#emptyData : loop
                ? this.#loopedData
                : this.#paddedData
        ).get(arr.length, padding);
    }


    readonly #emptyData = new CacheSingle<Float32Array, [ number, number ]>(
        (len, pad) => new Float32Array(len + pad * 2),
    );
    readonly #paddedData = new CacheSingle<Float32Array, [ number, number ]>(
        (len, pad) => {
            const res = new Float32Array(len + pad * 2);
            res.set(this.audioData, pad);
            return res;
        },
    );
    readonly #loopedData = new CacheSingle<Float32Array, [ number, number ]>(
        (len, pad) => {
            // [ padding ] [ main data ] [ padding ]
            const res = new Float32Array(len + pad * 2),
                  arr = this.audioData;

            let i1, i2; // Lifted out of loops so we can use them later

            // Add enough whole copies of arr to fill padding at start
            for (i1 = pad - len ; i1 >= 0 ; i1 -= len) {
                res.set(arr, i1);
            }
            // Add main data
            res.set(arr, pad);
            // Add enough whole copies of arr to fill padding at end
            for (i2 = pad + len ; i2 + len <= len + pad * 2 ; i2 += len) {
                res.set(arr, i2);
            }

            // i1 should be negative, marking where another copy of arr would
            // have been inserted had it not fallen off the start. Thus, we need
            // to chop off the first |i1| elements and copy the rest into the
            // start of the array
            res.set(arr.subarray(-i1), 0);
            // i2 should be within len of len + pad * 2 (a.k.a. res.length),
            // marking where another copy would have been inserted had it not
            // fallen off the end. Thus, we need to copy another res.length - i2
            // elements into the end of the array
            res.set(arr.subarray(0, res.length - i2), i2);

            return res;
        },
    );

}