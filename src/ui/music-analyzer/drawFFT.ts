// Not exactly 27.5 - 4200 (A0 to C8) to leave space at ends
import { IntRange, NumberRange } from "@/lib/utils/numberRange";
import { MaximumFinder } from "@/lib/utils/minMax";
import { now } from "tone";
import { LinearValueConvertor } from "@/lib/utils/valueConvertor";
import { clamp } from "@/lib/utils/util";
import { Smoother } from "@/lib/utils/smoother";
import { Canvas } from "@/lib/canvas";
import { MusicAnalyzer } from "@/logic/analyzer";
import {
    freqToMidi, midiNoteValueToString,
} from "@/ui/music-analyzer/midiHelpers";
import { COLORS } from "@/css-colors";

const frequencyRange = new NumberRange(25, 4320);
const midiRange = new IntRange(21, 108);
const midiToXFrac = LinearValueConvertor.fittingRangeTo(
    midiRange, new NumberRange(0.02, 0.993), // These values look nice
);

export function drawFFT (canvas: Canvas, analyzer: MusicAnalyzer) {
    if (!canvas.raw_ctx) return;

    canvas.clear();
    canvas.strokeWidth = 2.1;

    analyzer.frequencyRange = frequencyRange;
    analyzer.reAnalyze();
    const data = analyzer.analysisData.slice();
    const normalizeIntensity = normalizeVolume(data);

    // Calculate stuff
    const p: [ number, number ][] = [];

    const detectedPeaksText: {
        midi: number, yFrac: number, fontSize: number, text: string
    }[] = [];

    for (const i of analyzer.binIndexRange) {
        const val = data[i - analyzer.binIndexRange.start];

        const frequency = i * analyzer.frequencyBinSize;
        const midi: number = freqToMidi.convertForwards(frequency);
        const y = Math.max(val, 0);

        p.push([ midi, y ]);
    }

    // Bin lines to reduce spline size.
    // TODO: cache binning calculations (which indices to which bins; bin sizes)
    //  since those are constant
    const binnedData = binPoints(p);
    const binIndices = IntRange.forIndicesOf(binnedData);
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

        if (maxDepth.get() > 0.1) {
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

    // Bin font sizes to reduce canvas ctx state changes, which can be quite
    // expensive
    const textBins: Map<number,
        Omit<(typeof detectedPeaksText)[number], "fontSize">[]
    > = new Map;
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

    // Draw grid
    canvas.opacity = 0.5;
    canvas.strokeColor = COLORS.medium_color;
    for (let intensity = -2 ; intensity <= 10 ; intensity++) {
        const normalized = normalizeIntensity.convertForwards(intensity);
        if (normalized < 0 || normalized > 1) {
            continue;
        }
        const y = canvas.height * (1 - normalized);
        canvas.immediateLine(0, y, canvas.width, y);
    }
    for (const midi of midiRange) {
        const x = midiToXFrac.convertForwards(midi) * canvas.width;
        canvas.immediateLine(x, 0, x, canvas.height);
    }
    canvas.opacity = 1;

    // Draw FFT
    canvas.strokeColor = COLORS.accent_color;
    canvas.immediateStrokeSpline(...binnedData.map(([ x, y ]) => [
        midiToXFrac.convertForwards(x) * canvas.width,
        (1 - y) * canvas.height,
    ] as const));
    for (const [ font_size, info ] of textBins) {
        canvas.font = `${ font_size }px sans-serif`;

        for (const { midi, yFrac, text } of info) {
            const x = midiToXFrac.convertForwards(midi) * canvas.width;
            const y = (1 - yFrac) * canvas.height;
            canvas.immediateFillCircle(x, y, 2);
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
    for (const midi of midiRange) {
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
    const decibelsRangeFinder = new MaximumFinder();

    data.forEach(p => Number.isFinite(p) && decibelsRangeFinder.accept(p));

    volumeSmoother.update(
        Math.max(decibelsRangeFinder.get() + 1, initialMaxVolume), now());
    const max = volumeSmoother.value;
    const res = LinearValueConvertor.normalizing(new NumberRange(-0.5, max));
    for(let i = 0; i < data.length; i++) data[i] = res.convertForwards(data[i])
    return res;
}

function binPoints (p: [ number, number ][]): (readonly [ number, number ])[] {
    const bins: Map<number, [ number, number ][]> = new Map;
    for (let [ x, y ] of p) {
        x = Math.round(x * 5) / 5;
        if (!bins.has(x)) bins.set(x, []);
        bins.get(x)!.push([ x, y ]);
    }
    return [ ...bins.entries() ].map(
        ([ _, p ]) => {
            const [ px, py ] = [ 0, 1 ].map(i => p.map(j => j[i]));

            const py_total: number = py.reduce((a, b) => a + b ** 4, 0);
            return [
                px.reduce((a, b) => a + b, 0) / p.length,
                (py_total / p.length) ** 0.25,
            ] as const;
        },
    ).sort((a, b) => a[0] - b[0]);
}
