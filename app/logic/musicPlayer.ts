import {now, Player, ToneAudioBuffer, ToneAudioNode} from "tone";
import {clamp} from "@/app/lib/utils/util";

export class MusicPlayer {
    readonly #player: Player;
    #startTime: number = NaN;
    #isPlaying: boolean = false;
    #startPosition: number = 0;

    public onstop : () => any = () => void 0;
    public onstart: () => any = () => void 0;

    constructor() {
        this.#player = new Player();
        this.#player.toDestination();

        this.#player.onstop = this.#onstop.bind(this);
    }

    #onstop() {
        if(!this.#isPlaying) return;

        this.#startPosition += this.#playTimeSinceLastStarted;
        this.#isPlaying = false;
        this.#startTime = NaN;
        this.onstop.call(null);
    }

    get duration() {
        return this.buffer.duration;
    }

    get sampleRate(): number {
        return 1 / this.#player.sampleTime;
    }

    play() {
        if(this.#isPlaying || !this.isBufferLoaded) return;
        if(this.isFinished) this.position = 0;

        this.#isPlaying = true;

        this.#player.start(now(), this.#startPosition);
        this.#startTime = now();

        this.onstart.call(null);
    }

    pause() {
        this.#player.stop();
        this.#onstop();
    }

    get #playTimeSinceLastStarted() {
        if(!this.#isPlaying) return 0;
        return now() - this.#startTime;
    }

    get isFinished() {
        return this.position > this.duration - 0.001;
    }

    set position(time: number) {
        if(this.#isPlaying) {
            this.pause();
            setTimeout(() => this.play(), 300);
        }
        this.#startPosition = clamp(time, 0, this.duration);
    }

    get position() {
        return this.#startPosition + this.#playTimeSinceLastStarted;
    }

    rewind() {
        this.pause();
        this.position = 0;
    }

    get isPlaying() {
        return this.#isPlaying;
    }

    get buffer() {
        return this.#player.buffer
    }

    get bufferAsFloat32Array() {
        const arr = this.buffer.toArray();
        return Array.isArray(arr) ? arr[0] : arr;
    }

    set buffer(buffer: ToneAudioBuffer) {
        this.rewind();
        this.#player.buffer = buffer;
    }

    get isBufferLoaded() {
        return this.buffer.loaded;
    }

    get node(): ToneAudioNode {
        return this.#player;
    }
}