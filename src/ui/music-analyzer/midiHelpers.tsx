import {LinearValueConvertor, logTransform} from "@/lib/utils/valueConvertor";
import {NumberRange} from "@/lib/utils/numberRange";

export const freqToMidi = LinearValueConvertor.fittingRangeToAfter(
    new NumberRange(220, 440),
    new NumberRange(57, 69),
    logTransform
);

export function midiNoteValueToString(n: number) {
    return n < 21 ? '?' : [
        'C', 'C#', 'D', 'Eb', 'E', 'F',
        'F#', 'G', 'Ab', 'A', 'Bb', 'B'
    ][n % 12] + ~~((n - 12) / 12);
}