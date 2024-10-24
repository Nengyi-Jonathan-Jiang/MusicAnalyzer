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

    constructor(buffer: ToneAudioBuffer) {
        this.buffer = buffer;
    }
}