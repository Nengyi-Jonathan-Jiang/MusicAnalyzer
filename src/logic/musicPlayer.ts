import { Gain, getContext, now, Player, ToneAudioBuffer } from "tone";
import { clamp } from "@/lib/utils/util";
import { AudioFile } from "@/logic/audioFile";

export class MusicPlayer {
    readonly #player: Player;
    readonly #gain: Gain;
    #audio: AudioFile;

    #resumeTime: number = NaN;
    #resumePosition: number = 0;

    #isPlaying: boolean = false;

    #autoResume: number | null = null;
    static readonly #autoResumeDelay: number = 300;

    public onstop: () => any = () => void 0;
    public onstart: () => any = () => void 0;

    #volume: number = 1;

    #doRepeat: boolean = false;

    // Can replace with console.debug to enable logging of player events
    private readonly debug: Function = () => void 0;

    constructor () {
        this.#player = new Player();
        this.#gain = new Gain(1, "gain");
        this.#player.connect(this.#gain);
        this.#gain.toDestination();
        this.#audio = new AudioFile(new ToneAudioBuffer());
        this.#player.onstop = () => {
            if (!this.#isPlaying) return;
            this.debug('Player stopped naturally');
            this.#player.stop();
            if (this.isFinished) {
                this.#resumePosition = this.duration;
            }

            this.#isPlaying = false;
            this.#resumeTime = NaN;
            this.onstop.call(null);
        };
    }

    get duration () {
        return this.audio.buffer.duration;
    }

    play () {
        if (this.#isPlaying || !this.isAudioLoaded) return;
        if (this.isFinished) this.#resumePosition = 0;

        this.debug('Player started through play()');

        this.#isPlaying = true;
        this.#resumeTime = now();

        this.onstart.call(null);

        this.#player.start(this.#resumeTime, this.#resumePosition);
    }

    pause () {
        this.#cancelAutoResume();
        if (!this.#isPlaying) return;

        this.debug('Player stopped through pause()');

        this.#resumePosition = this.position;
        this.#isPlaying = false;
        this.#resumeTime = NaN;
        this.onstop.call(null);

        this.#player.stop();
    }

    #cancelAutoResume () {
        if (this.#autoResume !== null) {
            this.debug('Canceled pending auto-resume');
            clearTimeout(this.#autoResume);
            this.#autoResume = null;
        }
    }

    #scheduleAutoResume (delay: number = MusicPlayer.#autoResumeDelay) {
        this.#cancelAutoResume();
        this.debug('Scheduled auto-resume');
        const r = this.#autoResume = setTimeout(() => {
            this.play();
            this.debug('Executed auto-resume');
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

    get #rawPosition () {
        return this.#resumePosition + this.#playTimeSinceResumed;
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

    /**
     * Current time in seconds of the player.
     *
     * This is guaranteed to be between 0 and duration
     */
    get position () {
        if (!this.#isPlaying) return this.#resumePosition;

        return this.#doRepeat
            ? this.#rawPosition % this.duration
            : clamp(this.#rawPosition, 0, this.duration);
    }

    get volume (): number {
        return this.#volume;
    }

    set volume (value: number) {
        this.#volume = value;
        this.#gain.gain.exponentialRampTo(value, 0.02);
    }

    rewind () {
        const needsResume = this.#isPlaying;
        this.pause();
        this.position = 0;
        if (needsResume) this.#scheduleAutoResume();
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
        this.#player.loopStart = 0;
        this.#player.loopEnd = this.duration;
    }

    get doRepeat (): boolean {
        return this.#doRepeat;
    }

    set doRepeat (value: boolean) {
        // noinspection JSAssignmentUsedAsCondition
        if (this.#doRepeat = value) {
            this.#player.loop = true;
        }
        else {
            this.#player.loop = false;

            // Fix raw position since it may be out of bounds iff repeat is on
            if (this.#isPlaying) while (this.#rawPosition >= this.duration) {
                this.#resumeTime += this.duration;
            }
        }
        // TODO: fix issue where
    }

    get isAudioLoaded () {
        return this.audio.buffer.loaded;
    }

    get sampleRate () {
        return getContext().sampleRate;
    }
}