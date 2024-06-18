import {createArray, editArray} from "@/app/lib/utils/util";
import {IntRange, ReadonlyIntRange} from "@/app/lib/utils/range";

type ArrayOrArrayView<T> = T[] | SubarrayView<T>;

class SubarrayViewIterator<T> implements IterableIterator<T> {
    private readonly arrayView: SubarrayView<T>;
    private currentIndex: number;
    private lastValue: T | null = null;
    private done: boolean = true;

    constructor(arrayView: SubarrayView<T>) {
        this.arrayView = arrayView;
        this.currentIndex = 0;
    }

    [Symbol.iterator](): IterableIterator<T> {
        return this;
    }

    next(): IteratorResult<T> {
        if (this.done) {
            return {done: true, value: this.lastValue as T};
        }

        const value = this.arrayView.get(this.currentIndex++);
        const done = this.currentIndex === this.arrayView.length;

        if (done) {
            this.lastValue = this.arrayView.get(this.arrayView.length - 1);
            this.done = true;
        }

        return {done, value};
    }
}

/** A light readonly view on a subarray */
export interface ReadonlySubarrayView<T> {
    readonly length: number;

    get(index: number): T;

    [Symbol.iterator](): IterableIterator<T>;

    every(predicate: (this: null, value: T, index: number) => boolean): boolean;

    every<U>(predicate: (this: U, value: T, index: number) => boolean, thisArg: U): boolean;

    some(predicate: (this: null, value: T, index: number) => boolean): boolean;

    some<U>(predicate: (this: U, value: T, index: number) => boolean, thisArg: U): boolean;

    filter(predicate: (this: null, value: T, index: number) => boolean): T[];

    filter<U>(predicate: (this: U, value: T, index: number) => boolean, thisArg: U): T[];

    find(predicate: (this: null, value: T, index: number) => boolean): T | null;

    find<U>(predicate: (this: U, value: T, index: number) => boolean, thisArg: U): T | null;

    findIndex(predicate: (this: null, value: T, index: number) => boolean): number;

    findIndex<U>(predicate: (this: U, value: T, index: number) => boolean, thisArg: U): number;

    forEach(f: (this: null, value: T, index: number) => any): void;

    forEach<U>(f: (this: U, value: T, index: number) => any, thisArg: U): void;

    join(separator?: string): string;

    map<U>(f: (this: null, value: T, index: number) => U): U[];

    map<U, S>(f: (this: S, value: T, index: number) => U, thisArg: S): U[];

    reduce(f: (previousValue: T, currentValue: T, currentIndex: number, array: T[]) => T): T;

    reduce<U>(f: (previousValue: U, currentValue: T, currentIndex: number, array: T[]) => U, initialValue: U): U;
}

// noinspection JSUnusedGlobalSymbols
/** A light view on a subarray */
export class SubarrayView<T> {
    private readonly backingIndexRange: ReadonlyIntRange;
    private readonly backingArray: ArrayOrArrayView<T>;

    constructor(backingArray: ArrayOrArrayView<T>, backingIndexRange?: ReadonlyIntRange) {
        if (backingIndexRange !== undefined) {
            this.backingIndexRange = backingIndexRange.trimmedToRange(IntRange.forIndicesOf(backingArray));
        } else {
            this.backingIndexRange = IntRange.forIndicesOf(backingArray);
        }

        this.backingArray = backingArray;
    }

    get length() {
        return this.backingIndexRange.length;
    }

    get(index: number): T {
        const backingArray = this.backingArray,
            backingIndex = index + this.backingIndexRange.start;

        return backingArray instanceof SubarrayView ? backingArray.get(backingIndex) : backingArray[backingIndex];
    }

    set(index: number, value: T): T {
        const backingArray = this.backingArray,
            backingIndex = index + this.backingIndexRange.start;

        if (backingArray instanceof SubarrayView) {
            backingArray.set(backingIndex, value);
        } else {
            backingArray[backingIndex] = value;
        }

        return value;
    }

    [Symbol.iterator](): IterableIterator<T> {
        return new SubarrayViewIterator<T>(this);
    }

    every(predicate: (this: null, value: T, index: number) => boolean): boolean;
    every<U>(predicate: (this: U, value: T, index: number) => boolean, thisArg: U): boolean;
    every<U>(predicate: (this: U, value: T, index: number) => boolean, thisArg: any = null): boolean {
        for (let i of IntRange.forIndicesOf(this)) {
            if (!predicate.call(thisArg, this.get(i), i)) {
                return false;
            }
        }

        return true;
    }

    some(predicate: (this: null, value: T, index: number) => boolean): boolean;
    some<U>(predicate: (this: U, value: T, index: number) => boolean, thisArg: U): boolean;
    some<U>(predicate: (this: U, value: T, index: number) => boolean, thisArg: any = null): boolean {
        return !this.every(function (value, index) {
            return !predicate.call(this, value, index);
        }, thisArg);
    }

    fill(value: T): this {
        for (const i of IntRange.forIndicesOf(this)) {
            this.set(i, value);
        }
        return this;
    }

    modifyEach(value: (this: null, value: T, index: number) => T): this;
    modifyEach<U>(value: (this: U, value: T, index: number) => T, thisArg: U): this;
    modifyEach<U>(value: (this: U, value: T, index: number) => T, thisArg: any = null): this {
        for (const i of IntRange.forIndicesOf(this)) {
            this.set(i, value.call(thisArg, this.get(i), i));
        }
        return this;
    }

    filter(predicate: (this: null, value: T, index: number) => boolean): T[];
    filter<U>(predicate: (this: U, value: T, index: number) => boolean, thisArg: U): T[];
    filter<U>(predicate: (this: U, value: T, index: number) => boolean, thisArg: any = null): T[] {
        const resultArray: T[] = [];
        for (const i of IntRange.forIndicesOf(this)) {
            let value = this.get(i);
            if (predicate.call(thisArg, value, i)) {
                resultArray.push(value);
            }
        }
        return resultArray;
    }

    find(predicate: (this: null, value: T, index: number) => boolean): T | null;
    find<U>(predicate: (this: U, value: T, index: number) => boolean, thisArg: U): T | null;
    find<U>(predicate: (this: U, value: T, index: number) => boolean, thisArg: any = null): T | null {
        for (const i of IntRange.forIndicesOf(this)) {
            let value = this.get(i);
            if (predicate.call(thisArg, value, i)) {
                return value;
            }
        }
        return null;
    }

    findIndex(predicate: (this: null, value: T, index: number) => boolean): number;
    findIndex<U>(predicate: (this: U, value: T, index: number) => boolean, thisArg: U): number;
    findIndex<U>(predicate: (this: U, value: T, index: number) => boolean, thisArg: any = null): number {
        for (const i of IntRange.forIndicesOf(this)) {
            let value = this.get(i);
            if (predicate.call(thisArg, value, i)) {
                return i;
            }
        }
        return -1;
    }

    forEach(f: (this: null, value: T, index: number) => any): void;
    forEach<U>(f: (this: U, value: T, index: number) => any, thisArg: U): void;
    forEach<U>(f: (this: U, value: T, index: number) => any, thisArg: any = null): void {
        for (const i of IntRange.forIndicesOf(this)) {
            let value = this.get(i);
            f.call(thisArg, value, i)
        }
    }

    join(separator: string = ','): string {
        if (this.length === 0) return '';
        let result = (this.get(0) as Object).toString();

        for (const i of IntRange.forIndicesOf(this).setStart(1)) {
            result += ',' + (this.get(i) as Object).toString();
        }

        return result;
    }

    map<U>(f: (this: null, value: T, index: number) => U): U[];
    map<U, S>(f: (this: S, value: T, index: number) => U, thisArg: S): U[];
    map<U, S>(f: (this: S, value: T, index: number) => U, thisArg: any = null): U[] {
        return createArray(this.length, i => f.call(thisArg, this.get(i), i));
    }

    // TODO: implement the rest
    reduce(f: (previousValue: T, currentValue: T, currentIndex: number, array: T[]) => T): T;
    reduce<U>(f: (previousValue: U, currentValue: T, currentIndex: number, array: T[]) => U, initialValue: U): U;
    reduce<U>(f: any, initialValue ?: U): U {
        throw new Error("ArrayView.reduce not implemented");
    }
}