import { Gain, getContext, now, Player, ToneAudioBuffer } from "tone";
import { clamp } from "@/app/lib/utils/util";
import { AudioFile } from "@/app/logic/audioFile";

export class MusicPlayer {
    readonly #player: Player;
    readonly #gain: Gain;
    #audio: AudioFile;

    #resumeTime: number = NaN;
    #resumePosition: number = 0;

    #isPlaying: boolean = false;

    #autoResume: NodeJS.Timeout | null = null;
    static readonly #autoResumeDelay: number = 300;

    public onstop: () => any = () => void 0;
    public onstart: () => any = () => void 0;

    #volume: number = 1;

    #doRepeat: boolean = false;

    constructor () {
        this.#player = new Player();
        this.#gain = new Gain(1, "gain");
        this.#player.connect(this.#gain);
        this.#gain.toDestination();
        this.#audio = new AudioFile(new ToneAudioBuffer());
        this.#player.onstop = () => {
            if (!this.#isPlaying) return;

            if (this.#resumeTime + this.#playTimeSinceResumed >= this.duration) {
                this.#resumePosition = this.duration;
            }

            this.#isPlaying = false;
            this.#resumeTime = NaN;
            this.onstop.call(null);

            this.#resumePosition = 0;
            if (this.#doRepeat) {
                this.#scheduleAutoResume(0);
            }
        };
    }

    get duration () {
        return this.audio.buffer.duration;
    }

    play () {
        if (this.#isPlaying || !this.isAudioLoaded) return;
        if (this.isFinished) this.#resumePosition = 0;

        this.#isPlaying = true;
        this.#resumeTime = now();

        this.onstart.call(null);

        if (this.#player.state !== 'stopped') return;
        this.#player.start(this.#resumeTime, this.#resumePosition);
    }

    pause () {
        this.#cancelAutoResume();
        if (!this.#isPlaying) return;
        this.#resumePosition = this.position;
        this.#isPlaying = false;
        this.#resumeTime = NaN;
        this.onstop.call(null);

        if (this.#player.state !== 'started') return;
        this.#player.stop();
    }

    #cancelAutoResume () {
        if (this.#autoResume !== null) {
            clearTimeout(this.#autoResume);
            this.#autoResume = null;
        }
    }

    #scheduleAutoResume (delay: number = MusicPlayer.#autoResumeDelay) {
        this.#cancelAutoResume();
        const r = this.#autoResume = setTimeout(() => {
            this.play();
            if (this.#autoResume === r) {
                clearTimeout(r);
                this.#autoResume = null;
            }
        }, delay);
    }

    get #playTimeSinceResumed () {
        if (!this.#isPlaying) return 0;
        return now() - this.#resumeTime;
    }

    get isFinished () {
        return this.position > this.duration - 0.001;
    }

    set position (time: number) {
        if (time >= this.duration) {
            this.pause(); // At the end; pause and stop immediately
        }
        else if (this.#isPlaying) {
            this.pause(); // Not at the end and playing; resume later
            this.#scheduleAutoResume();
        }
        else if (this.#autoResume !== null) {
            this.#scheduleAutoResume(); // Paused but will resume; resume later
        }

        this.#resumePosition = clamp(time, 0, this.duration);
    }

    get position () {
        return this.#isPlaying ? clamp(
            this.#resumePosition + this.#playTimeSinceResumed,
            0, this.duration,
        ) : this.#resumePosition;
    }

    get volume (): number {
        return this.#volume;
    }

    set volume (value: number) {
        this.#volume = value;
        this.#gain.gain.exponentialRampTo(value, 0.5);
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

    get doRepeat (): boolean {
        return this.#doRepeat;
    }

    set doRepeat (value: boolean) {
        this.#doRepeat = value;
    }

    get isAudioLoaded () {
        return this.audio.buffer.loaded;
    }

    get sampleRate () {
        return getContext().sampleRate;
    }
}