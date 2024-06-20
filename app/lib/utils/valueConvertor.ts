import {NumberRange, ReadonlyNumberRange} from "@/app/lib/utils/numberRange";

export abstract class ValueConvertor<T, U> {
    public abstract convertForwards(amountA: T): U;

    public abstract convertBackwards(amountB: U): T;

    public composedWith<V>(other: ValueConvertor<U, V>): ValueConvertor<T, V> {
        const thiz = this;
        return new class extends ValueConvertor<T, V> {
            convertForwards = (amountA: T): V => {
                return other.convertForwards(thiz.convertForwards(amountA));
            }

            convertBackwards = (amountB: V): T => {
                return thiz.convertBackwards(other.convertBackwards(amountB));
            }
        };
    }

    public inverted(): ValueConvertor<U, T> {
        const thiz = this;
        return new class extends ValueConvertor<U, T> {
            convertForwards = (amountA: U): T => {
                return thiz.convertBackwards(amountA);
            }

            convertBackwards = (amountB: T): U => {
                return thiz.convertForwards(amountB);
            }
        };
    }
}

export type NumericValueConvertor = ValueConvertor<number, number>;

export function convertRangeForwards(convertor: NumericValueConvertor, range: ReadonlyNumberRange) {
    return range.copy().modifyStart(convertor.convertForwards).modifyEnd(convertor.convertForwards)
}

export function convertRangeBackwards(convertor: NumericValueConvertor, range: ReadonlyNumberRange) {
    return range.copy().modifyStart(convertor.convertBackwards).modifyEnd(convertor.convertBackwards)
}

export const logTransform : NumericValueConvertor = new class extends ValueConvertor<number, number> {
    convertForwards = (amountA: number): number => {
        return Math.log(amountA);
    }

    convertBackwards = (amountB: number): number => {
        return Math.exp(amountB);
    }
}
export const expTransform : NumericValueConvertor = logTransform.inverted();

export class LinearValueConvertor extends ValueConvertor<number, number> {
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

    convertForwards = (amountA: number) => {
        return amountA * this.#factor + this.#offset;
    }

    convertBackwards = (amountB: number) => {
        return (amountB - this.#offset) / this.#factor;
    }

    static fittingRangeTo(sourceRange: ReadonlyNumberRange, destRange: ReadonlyNumberRange): NumericValueConvertor {
        const factor = destRange.length / sourceRange.length;
        return new LinearValueConvertor(factor, destRange.start - sourceRange.start * factor)
    }

    static normalizing(sourceRange: ReadonlyNumberRange): NumericValueConvertor {
        return LinearValueConvertor.fittingRangeTo(sourceRange, new NumberRange(0, 1));
    }

    static fittingRangeToAfter(sourceRange: ReadonlyNumberRange, destRange: ReadonlyNumberRange, transform: NumericValueConvertor): NumericValueConvertor {
        return transform.composedWith(
            LinearValueConvertor.fittingRangeTo(
                convertRangeForwards(transform, sourceRange),
                destRange
            )
        );
    }

    static normalizingAfter(sourceRange: ReadonlyNumberRange, transform: NumericValueConvertor): NumericValueConvertor {
        return transform.composedWith(
            LinearValueConvertor.normalizing(
                convertRangeForwards(transform, sourceRange),
            )
        );
    }
}