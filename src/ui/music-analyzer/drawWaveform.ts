import { Canvas } from "@/lib/canvas";
import { MusicPlayer } from "@/logic/musicPlayer";
import { COLORS } from "@/css-colors";
import { editArray } from "@/lib/utils/util";
import { Cache } from "@/lib/utils/cache";
import { MaximumFinder } from "@/lib/utils/minMax";
import { getObjectId } from "@/lib/utils/hash";
import { clamp } from "@/lib/utils/math";

const simplifiedWaveform = new Cache.CacheSingle<
    { rms: Float32Array, peak: Float32Array, length: number },
    [ Float32Array, number ]
>(
    (arr, width) => {
        // Good enough for most screens
        const length: number = Math.min(arr.length, width);
        const rms = new Float32Array(length);
        const peak = new Float32Array(length);
        const max = new MaximumFinder();
        max.accept(0.1); // Don't normalize volume beyond this

        for (let i = 0 ; i < length ; i++) {
            const arrI_left = Math.ceil(i * arr.length / length);
            const arrI_right = (i + 1) * arr.length / length;
            const points: number[] = [];
            for (let i = arrI_left ; i < arrI_right ; i++) {
                points.push(Math.max(arr[i]));
            }

            peak[i] = Math.max(...points);
            rms[i] = (
                (points.reduce((a, b) => a + b ** 2, 0) / points.length) ** 0.5
            );
            // Slightly tweak peak so it follows rms a bit more closely (for
            // aesthetic reasons) by tweaking the ratio between peak and rms:
            // R <- f(R) where R is the ratio and f(R) = 1 + tanh(R - 1) which
            // satisfies f(1) = 1; f(R) -> ∞
            peak[i] = (1 + Math.tanh((peak[i] / rms[i]) - 1)) * rms[i];

            // Use max finder after tweaking peak
            max.accept(peak[i]);
        }

        // Normalize data. In addition, raise to power of 0.8 to slightly reduce
        // difference between soft and loud parts, for aesthetic reasons
        editArray(rms, i => (i / max.get()) ** 0.8);
        editArray(peak, i => (i / max.get()) ** 0.8);

        return {
            rms, peak, length,
        };
    },
    (arr, width) => `${ getObjectId(arr) }:${ width }`,
);

export function drawWaveform (canvas: Canvas, player: MusicPlayer): void {
    canvas.opacity = 1;
    canvas.clear();

    canvas.strokeColor = COLORS.fg_color;
    canvas.strokeWidth = 2;
    canvas.immediateLine(0, canvas.height / 2, canvas.width, canvas.height / 2);

    if (!player.isAudioLoaded) return;

    const { rms, peak, length } = (
        simplifiedWaveform.get(player.audio.audioData, canvas.width)
    );

    canvas.opacity = 0.4;
    canvas.strokeColor = COLORS.accent_color;
    canvas.beginNewPath();
    for (let i = 0 ; i < length ; i++) {
        const val = peak[i];

        canvas.line(
            i + 0.5,
            canvas.height * (1 + val * 0.8) / 2,
            i + 0.5,
            canvas.height * (1 - val * 0.8) / 2,
        );
    }
    canvas.stroke();

    canvas.opacity = 1;
    canvas.strokeColor = COLORS.fg_color;
    canvas.beginNewPath();
    for (let i = 0 ; i < length ; i++) {
        const val = rms[i];

        canvas.line(
            i + 0.5,
            canvas.height * (1 + val * 0.8) / 2,
            i + 0.5,
            canvas.height * (1 - val * 0.8) / 2,
        );
    }
    canvas.stroke();

    const playFraction = clamp(player.position / player.duration, 0, 1);
    canvas.strokeWidth = 2;
    canvas.immediateLine(
        playFraction * canvas.width, 0,
        playFraction * canvas.width, canvas.height,
    );
}