// Not exactly 27.5 - 4200 (A0 to C8) to leave space at ends
import { IntRange, NumberRange } from "@/lib/utils/numberRange";
import { MaximumFinder } from "@/lib/utils/minMax";
import { now } from "tone";
import {
    convertRangeForwards, LinearValueConvertor,
} from "@/lib/utils/valueConvertor";
import { Smoother } from "@/lib/utils/smoother";
import { Canvas } from "@/lib/canvas";
import { MusicAnalyzer } from "@/logic/analyzer";
import {
    freqToMidi, midiNoteValueToString,
} from "@/ui/music-analyzer/midiHelpers";
import { COLORS } from "@/css-colors";
import { Cache } from "@/lib/utils/cache";
import { clamp } from "@/lib/utils/math";
import CacheSingle = Cache.CacheSingle;

const frequencyRange = new NumberRange(25, 4320);
const midiRange = new IntRange(21, 108);
const midiToXFrac = LinearValueConvertor.fittingRangeTo(
    midiRange, new NumberRange(0.02, 0.993), // These values look nice
);


let currFrame = 0;

export function drawFFT (canvas: Canvas, analyzer: MusicAnalyzer) {
    if (!canvas.raw_ctx) return;

    analyzer.frequencyRange = frequencyRange;

    // Skip analysis on some frames for performance
    currFrame = (currFrame + 1) & 3;
    if (!(currFrame & ({ 14: 1, 15: 3, 16: 3 }[analyzer.resolution] ?? 0))) {
        analyzer.reAnalyze();
    }
    analyzer.updateSmoothed();

    const data = analyzer.smoothedFFT.slice();
    const normalizeIntensity = normalizeVolume(data);

    // Bin lines to reduce data size, especially in high frequencies
    const binnedData = binPoints(data, analyzer);
    const binIndices = IntRange.forIndicesOf(binnedData);

    const detectedPeaks = findPeaks(binnedData, binIndices, canvas);
    const binnedText = binText(detectedPeaks);

    canvas.clear();

    // Draw grid
    canvas.strokeWidth = convertRangeForwards(
        midiToXFrac, new NumberRange(0, 1)).length * canvas.width * 0.95;
    canvas.opacity = 0.1;
    for (let midi = midiRange.start ; midi <= midiRange.end ; midi++) {
        const x = midiToXFrac.convertForwards(midi) * canvas.width;
        canvas.strokeColor = [
            1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1,
        ][midi % 12] ? COLORS.fg_color : COLORS.medium_color;
        canvas.immediateLine(x, 0, x, canvas.height);
    }
    canvas.strokeWidth = 2.1;
    canvas.opacity = 0.6;
    canvas.strokeColor = COLORS.medium_color;
    for (let intensity = -2 ; intensity <= 10 ; intensity++) {
        const normalized = normalizeIntensity.convertForwards(intensity);
        if (normalized < 0 || normalized > 1) {
            continue;
        }
        const y = canvas.height * (1 - normalized);
        canvas.immediateLine(0, y, canvas.width, y);
    }
    canvas.opacity = 1;

    // Draw FFT
    canvas.strokeWidth = 2.1;
    canvas.strokeColor = COLORS.accent_color;
    canvas.immediateStrokeSpline(...binnedData.map(([ x, y ]) => [
        midiToXFrac.convertForwards(x) * canvas.width,
        (1 - y) * canvas.height,
    ] as const));
    for (const [ font_size, info ] of binnedText) {
        canvas.font = `${ font_size }px sans-serif`;

        for (const { midi, yFrac, text } of info) {
            const x = midiToXFrac.convertForwards(midi) * canvas.width;
            const y = (1 - yFrac) * canvas.height;
            canvas.immediateFillText(text, x, y - canvas.height * 0.03);
        }
    }

    // Draw grid text
    canvas.fillColor = COLORS.fg_color;
    canvas.clearRect(0, 0, canvas.width * 0.016, canvas.height);
    canvas.font = `${ canvas.width * 0.005 }px sans-serif`;
    for (let intensity = -2 ; intensity <= 10 ; intensity++) {
        const normalized = normalizeIntensity.convertForwards(intensity);
        if (normalized < 0 || normalized > 1) {
            continue;
        }
        const y = canvas.height * (1 - normalized);
        canvas.immediateFillText(
            `${ intensity >= 0 ? '+' : '' }${ intensity }dB`,
            canvas.width * 0.007, y,
        );
    }
    canvas.clearRect(0, 0, canvas.width, canvas.height * 0.05);
    for (let midi = midiRange.start ; midi <= midiRange.end ; midi++) {
        const x = midiToXFrac.convertForwards(midi) * canvas.width;
        const noteName = midiNoteValueToString(midi);
        canvas.immediateFillText(noteName, x, canvas.height * .025);
    }
    canvas.strokeColor = COLORS.medium_color;
    canvas.opacity = 0.5;
    canvas.immediateLine(
        canvas.width * 0.016, canvas.height,
        canvas.width * 0.016, canvas.height * 0.05,
    );
    canvas.immediateLine(
        0, canvas.height * 0.05,
        canvas.width, canvas.height * 0.05,
    );
    canvas.opacity = 1;
}

const initialMaxVolume = 0.5;
const volumeSmoother = new Smoother({
    initialValue: initialMaxVolume,
    func (dv, dt) {
        if (dv === 0) return 0;

        const er = Math.max(dv * 2, -1.125);
        const decayFactor: number = er ** 6 * (1.5 + er) ** 2;
        const res: number = clamp(Math.exp(-dt * decayFactor), 0, 1);

        // The update is x <- x + dv (1 - R). Thus, to limit the rate of change,
        // we want |dv (1 - R)| <= v * dt <==> R >= 1 - v * dt / |dv|
        return Math.max(res, 1 - 4 * dt / Math.abs(dv));
    },
});

function normalizeVolume (data: Float32Array) {
    let max = initialMaxVolume;
    for (const point of data) max = Math.max(max, point + 1);
    max = volumeSmoother.update(max, now()).value;

    const res = LinearValueConvertor.normalizing(new NumberRange(-0.5, max));
    for (let i = 0 ; i < data.length ; i++) {
        data[i] = res.convertForwards(data[i]);
    }

    return res;
}

const fftBinMap = new CacheSingle<
    ReadonlyMap<number, readonly (readonly [ number, number ])[]>,
    [ IntRange, number ]
>((binIndices, binWidth) => {
    const bins: Map<number, [ number, number ][]> = new Map;

    for (const binIndex of binIndices) {
        const frequency = binIndex * binWidth;
        const midi: number = freqToMidi.convertForwards(frequency);
        const midiBin = Math.round(midi * 5) / 5;
        if (!bins.has(midiBin)) bins.set(midiBin, []);
        bins.get(midiBin)!.push([ midi, binIndex - binIndices.start ]);
    }

    return bins;
});

function binPoints (
    data: Float32Array, analyzer: MusicAnalyzer,
): [ number, number ][] {

    const binMap = fftBinMap.get(
        analyzer.binIndexRange, analyzer.frequencyBinSize,
    );

    const res: [ number, number ][] = [];
    for (const [ _, points ] of binMap) {
        // Calculate quartic mean (4 is a nice big number) of data
        let px_acc = 0, py_acc = 0;
        for (const point of points) {
            let val = data[point[1]];
            val *= val;
            val *= val;

            px_acc += point[0] * val; // need weighted average of x coordinate
            py_acc += val;
        }
        const px = px_acc / py_acc;
        const py = Math.sqrt(Math.sqrt(py_acc / points.length));

        res.push([ px, py ]);
    }

    return res;
}


function findPeaks (
    binnedData: [ number, number ][],
    binIndices: IntRange,
    canvas: Canvas,
): { midi: number; yFrac: number; fontSize: number; text: string }[] {
    const detectedPeaksText: {
        midi: number, yFrac: number, fontSize: number, text: string
    }[] = [];
    const f = (i: number) => binnedData[i][1];
    for (const i of binIndices) {
        const midi: number = binnedData[i][0];
        const yFrac: number = binnedData[i][1];

        if (!(binIndices.includes(i - 1) && binIndices.includes(i + 1)))
            continue;
        if (yFrac <= f(i - 1) || yFrac <= f(i + 1))
            continue;

        const maxDepth = new MaximumFinder(0);
        let pos: number;
        pos = i + 1;
        while (binIndices.includes(pos)) {
            if (f(pos) < f(pos - 1)) {
                maxDepth.accept(yFrac - f(pos));
                pos++;
            }
            else break;
        }
        pos = i - 1;
        while (binIndices.includes(pos)) {
            if (f(pos) < f(pos + 1)) {
                maxDepth.accept(yFrac - f(pos));
                pos--;
            }
            else break;
        }

        if (maxDepth.get() > 0.2) {
            const fontSize: any = canvas.width * 0.006 * (
                Math.log10(maxDepth.get() * 10) ** 0.2
            );
            detectedPeaksText.push({
                midi,
                yFrac,
                fontSize,
                text: midiNoteValueToString(Math.round(midi)),
            });
        }
    }
    return detectedPeaksText;
}

function binText<T extends { fontSize: number }> (
    detectedPeaksText: T[],
): Map<number, Omit<T, "fontSize">[]> {
    // Bin font sizes to reduce canvas ctx state changes, which can be quite
    // expensive
    const textBins: Map<number, Omit<T, "fontSize">[]> = new Map;
    for (const info of detectedPeaksText) {
        // "Exponential" rounding by the transformation x <-> 10 log(x + 1.11)
        // This results in ~25 bins for font sizes up to 40px
        const roundedFontSize = Math.exp(Math.round(
            10 * Math.log(info.fontSize + 4.1),
        ) / 10) - 4.1;
        // Skip tiny text
        if (roundedFontSize <= 1) continue;

        if (!textBins.has(roundedFontSize)) textBins.set(roundedFontSize, []);
        textBins.get(roundedFontSize)!.push(info);
    }
    return textBins;
}
