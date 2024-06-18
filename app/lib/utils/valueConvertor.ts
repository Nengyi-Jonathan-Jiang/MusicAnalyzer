import {ReadonlyRange, Range} from "@/app/lib/utils/range";

export abstract class ValueConvertor {
    public abstract convertForwards(amountA: number): number;
    public abstract convertBackwards(amountB: number): number;

    public composedWith(...others: ValueConvertor[]){
        return ValueConvertor.compose(this, ...others);
    }

    public inverted() : ValueConvertor {
        return new InvertedValueConvertor(this);
    }

    public convertRangeForwards(range: ReadonlyRange){
        return range.copy()
            .modifyStart(i => this.convertForwards(i))
            .modifyEnd(i => this.convertForwards(i))
    }

    public convertRangeBackwards(range: ReadonlyRange){
        return range.copy()
            .modifyStart(i => this.convertBackwards(i))
            .modifyEnd(i => this.convertBackwards(i))
    }

    public static compose(...convertors: ValueConvertor[]) : ValueConvertor {
        return new ComposedValueConvertor(...convertors);
    }

    public static invert(convertor: ValueConvertor) {
        return new InvertedValueConvertor(convertor);
    }

    public static readonly logTransform = new class extends ValueConvertor {
        convertBackwards(amountB: number): number {
            return Math.exp(amountB);
        }

        convertForwards(amountA: number): number {
            return Math.log(amountA);
        }
    }();

    public static readonly expTransform : ValueConvertor;
}

class ComposedValueConvertor extends ValueConvertor {
    private readonly convertors: ValueConvertor[];
    constructor(...convertors : ValueConvertor[]) {
        super();
        this.convertors = convertors;
    }

    convertForwards(amountA: number): number {
        return this.convertors.reduce((amount, convertor) => convertor.convertForwards(amount), amountA);
    }

    convertBackwards(amountB: number): number {
        return this.convertors.reduceRight((amount, convertor) => convertor.convertBackwards(amount), amountB);
    }
}

class InvertedValueConvertor extends ValueConvertor {
    private readonly baseConvertor: ValueConvertor;

    constructor(convertor: ValueConvertor) {
        super();
        this.baseConvertor = convertor;
    }

    convertForwards(amountA: number): number {
        return this.baseConvertor.convertBackwards(amountA);
    }

    convertBackwards(amountB: number): number {
        return this.baseConvertor.convertForwards(amountB);
    }
}


export class LinearValueConvertor extends ValueConvertor {
    readonly #factor: number;
    readonly #offset: number;

    /**
     * Represents a linear unit conversion.
     *
     * If {@link applyOffsetFirst} is true, convertForwards(x) returns `x * factor + offset`,
     * otherwise, it returns `(x + offset) * factor`
     */
    constructor(factor: number, offset: number = 0, applyOffsetFirst = false) {
        super();
        this.#factor = factor;
        this.#offset = applyOffsetFirst ? factor * offset : offset;
    }

    convertForwards(amountA: number) {
        return amountA * this.#factor + this.#offset;
    }

    convertBackwards(amountB: number) {
        return (amountB - this.#offset) / this.#factor;
    }

    static fittingRangeTo(sourceRange : ReadonlyRange, destRange : ReadonlyRange) : LinearValueConvertor {
        // To convert value a from sourceRange to destRange, we write
        // b = (a - sourceRange.start) / sourceRange.length * destRange.length + destRange.start
        // which simplifies to
        // b = a * (destRange.length / sourceRange.length) +
        //         (-sourceRange.start * destRange.length / sourceRange.length + destRange.start)

        const factor = destRange.length / sourceRange.length;
        return new LinearValueConvertor(factor, destRange.start - sourceRange.start * factor)
    }
}

// @ts-ignore
// noinspection JSConstantReassignment
ValueConvertor.expTransform = ValueConvertor.logTransform.inverted();

// @ts-ignore
window.ValueConvertor = ValueConvertor;
// @ts-ignore
window.LinearValueConvertor = LinearValueConvertor;
// @ts-ignore
window._Range = Range;