import {ToneAudioBuffer} from "tone";

const emptyArray = new Float32Array(2 << 14);

export class AudioFile {
    public readonly buffer: ToneAudioBuffer;
    private _arr: Float32Array | null = null;

    get arr(): Readonly<Float32Array> {
        if (this._arr === null) {
            if (!this.buffer.loaded) {
                return emptyArray;
            }
            let arr = this.buffer.toArray(0);
            this._arr = arr instanceof Float32Array ? arr : arr[0];
        }
        return this._arr;
    }

    /**
     * Creates a slice of the data up to a point
     */
    public getData(time: number, samples: number) {
        // We are doing a window of 2 * samples because each sample spans over two indices (real and imaginary parts)
        let index_center = ~~(time * this.buffer.sampleRate);
        let index_start = index_center - samples;
        let index_end = index_center + samples;

        let padding_amount_before =  Math.max(-index_start, 0);
        let padding_amount_after = Math.max(index_end - this.arr.length, 0);
        index_start += padding_amount_before;
        index_end -= padding_amount_after;

        try {
            return new Float32Array([
                ...new Array(padding_amount_before).fill(0),
                ...this.arr.subarray(index_start, index_end),
                ...new Array(padding_amount_after).fill(0)
            ]);
        }
        catch(e) {
            console.log(index_start, index_end, padding_amount_before, padding_amount_after);
            throw e;
        }
    }

    constructor(buffer: ToneAudioBuffer) {
        this.buffer = buffer;
    }
}