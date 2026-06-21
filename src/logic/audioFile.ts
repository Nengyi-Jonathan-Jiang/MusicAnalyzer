import { ToneAudioBuffer } from "tone";
import { clamp } from "@/lib/utils/util";

const emptyArray = new Float32Array(2 << 16);

export class AudioFile {
    public readonly buffer: ToneAudioBuffer;
    private _arr: Float32Array | null = null;

    // Arrays for faster access to audio data

    /** zero-padded data */
    private _zero_extended_data: Float32Array | null = null;
    /** repeat-padded data */
    private _repeat_extended_data: Float32Array | null = null;
    /** zeroed out data, special case when arr is empty */
    private _empty_data: Float32Array | null = null;

    get arr (): Readonly<Float32Array> {
        if (this._arr === null) {
            if (!this.buffer.loaded) {
                return emptyArray;
            }

            let arr = this.buffer.toArray();

            // Collapse stereo to mono for analysis
            if (!(arr instanceof Float32Array)) {
                const channels = arr;
                arr = new Float32Array(channels[0].length);
                for (const channel of channels) {
                    for (let i = 0 ; i < arr.length ; i++) {
                        arr[i] += channel[i];
                    }
                }

                for (let i = 0 ; i < arr.length ; i++) {
                    arr[i] /= channels.length;
                }

                this.buffer.fromArray(arr);
            }

            this._arr = arr;
        }
        return this._arr;
    }

    #getExtendedArr (padding: number, loop: boolean = false) {
        const arr: Readonly<Float32Array> = this.arr;
        let length = padding * 2 + arr.length;

        if (arr.length === 0) {
            return (this._empty_data ??= new Float32Array(length));
        }

        if (loop) {
            if (this._repeat_extended_data?.length == length) {
                return this._repeat_extended_data;
            }
            this._repeat_extended_data = new Float32Array(length);

            // Keep track of what we left unfilled by lifting loop variable out
            let i1, i2;
            for (i1 = padding ; i1 >= arr.length ; i1 -= arr.length) {
                this._repeat_extended_data.set(arr, i1 - arr.length);
            }
            for (i2 = padding ; i2 + arr.length <= length ; i2 += arr.length) {
                this._repeat_extended_data.set(arr, i2);
            }
            // Now 0 <= i1 < arr.length; length - arr.length < i2 <= length

            // Fill in incomplete repeats at the ends
            this._repeat_extended_data.set(arr.slice(arr.length - i1), 0);
            this._repeat_extended_data.set(arr.slice(0, length - i2), i2);

            return this._repeat_extended_data;
        }
        else {
            if (this._zero_extended_data?.length == length) {
                return this._zero_extended_data;
            }
            this._zero_extended_data = new Float32Array(length);
            this._zero_extended_data.set(arr, padding);
            return this._zero_extended_data;
        }
    }

    /**
     * Creates a slice of the data up to a point
     *
     * The returned array is a readonly view of length `2 * samples` around the
     * given point
     */
    public getData (
        time: number, samples: number,
        loop: boolean = false,
    ): Readonly<Float32Array> {
        const sample = clamp(time * this.buffer.sampleRate, 0, this.arr.length);

        const index_center = Math.round(sample - samples * 0.25);
        const index_start = index_center - (samples >> 1);
        const index_end = index_center + samples - (samples >> 1);

        const padding: number = samples;
        const extendedArr = this.#getExtendedArr(padding, loop);
        return extendedArr.subarray(index_start + padding, index_end + padding);
    }

    constructor (buffer: ToneAudioBuffer) {
        this.buffer = buffer;
    }
}