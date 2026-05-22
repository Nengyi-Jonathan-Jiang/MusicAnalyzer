import { now, Player, ToneAudioBuffer, ToneAudioNode } from "tone";
import { clamp } from "@/app/lib/utils/util";
import { AudioFile } from "@/app/logic/audioFile";

export class MusicPlayer {
    readonly #player: Player;
    #audio: AudioFile;
    #startTime: number = NaN;
    #isPlaying: boolean = false;
    #startPosition: number = 0;

    public onstop: () => any = () => void 0;
    public onstart: () => any = () => void 0;

    constructor () {
        this.#player = new Player();
        this.#player.toDestination();
        this.#audio = new AudioFile(new ToneAudioBuffer());
        this.#player.onstop = this.#onstop.bind(this);
    }

    #onstop () {
        if (!this.#isPlaying) return;

        this.#startPosition += this.#playTimeSinceLastStarted;
        this.#isPlaying = false;
        this.#startTime = NaN;
        this.onstop.call(null);
    }

    get duration () {
        return this.audio.buffer.duration;
    }

    play () {
        if (this.#isPlaying || !this.isAudioLoaded) return;
        if (this.isFinished) this.position = 0;

        this.#isPlaying = true;

        this.#player.start(now(), this.#startPosition);
        this.#startTime = now();

        this.onstart.call(null);
    }

    pause () {
        this.#player.stop();
        this.#onstop();
    }

    get #playTimeSinceLastStarted () {
        if (!this.#isPlaying) return 0;
        return now() - this.#startTime;
    }

    get isFinished () {
        return this.position > this.duration - 0.001;
    }

    #resumePlayingTimeout: NodeJS.Timeout | null = null;
    static readonly #resumePlayingDelay: number = 1000;

    set position (time: number) {
        if (time >= this.duration) {
            this.pause();
            if (this.#resumePlayingTimeout !== null) {
                clearTimeout(this.#resumePlayingTimeout);
                this.#resumePlayingTimeout = null;
            }
            this.#startPosition = this.duration;
            return;
        }

        if (this.#resumePlayingTimeout !== null) {
            clearTimeout(this.#resumePlayingTimeout);
            this.#resumePlayingTimeout = setTimeout(() => {
                this.play();
                this.#resumePlayingTimeout = null;
            }, MusicPlayer.#resumePlayingDelay);
        }
        if (this.#isPlaying) {
            this.pause();
            if (this.#resumePlayingTimeout !== null) {
                clearTimeout(this.#resumePlayingTimeout);
            }
            this.#resumePlayingTimeout = setTimeout(() => {
                this.play();
                this.#resumePlayingTimeout = null;
            }, MusicPlayer.#resumePlayingDelay);
        }
        this.#startPosition = clamp(time, 0, this.duration);
    }

    get position () {
        return this.#startPosition + this.#playTimeSinceLastStarted;
    }

    rewind () {
        this.pause();
        this.position = 0;
    }

    get isPlaying () {
        return this.#isPlaying;
    }

    get audio () {
        return this.#audio;
    }

    set audio (audio: AudioFile) {
        this.rewind();
        this.#player.buffer = audio.buffer;
        this.#audio = audio;
    }

    get isAudioLoaded () {
        return this.audio.buffer.loaded;
    }

    get node (): ToneAudioNode {
        return this.#player;
    }
}