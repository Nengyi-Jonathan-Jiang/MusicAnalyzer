import {createArray} from "@/app/lib/utils/util";

export interface ReadonlyNumberRange {
    readonly endpoints: number[];
    readonly start: number;
    readonly end: number;
    readonly length: number;

    trimmedToRange(interval: ReadonlyNumberRange): NumberRange;

    copy() : NumberRange;
}

export interface ReadonlyIntRange extends ReadonlyNumberRange {
    readonly valuesInRange: number[];
    readonly startExclusive: number;
    readonly endExclusive: number;
    readonly numIntsInRange: number;

    trimmedToRange(interval: ReadonlyIntRange): IntRange;

    copy() : IntRange;
}

export class NumberRange implements ReadonlyNumberRange {
    #start: number = 0;
    #end: number = 0;

    constructor();
    constructor(start: number, end: number);
    constructor(start: number = 0, end: number = 0) {
        this.#start = start;
        this.#end = end;
    }

    includes(x : number) : boolean {
        return x >= this.start && x <= this.end;
    }

    /** The start and end of the interval (inclusive) as a tuple of two numbers */
    get endpoints(): [number, number] {
        return [this.start, this.end];
    }

    get length(): number {
        return this.end - this.start;
    }

    get start(): number {
        return this.#start;
    }

    set start(start: number) {
        this.#start = start;
    }

    setStart(start: number): this {
        this.start = start;
        return this;
    }

    modifyStart(mappingFunction: (this: null, start: number) => any): this {
        this.start = mappingFunction.call(null, this.start);
        return this;
    }

    get end() {
        return this.#end;
    }

    set end(end) {
        this.#end = end;
    }

    setEnd(end: number) {
        this.end = end;
        return this;
    }

    modifyEnd(mappingFunction: (this: null, start: number) => any): this {
        this.end = mappingFunction.call(null, this.end);
        return this;
    }

    copy() {
        return new NumberRange().setStart(this.start).setEnd(this.end);
    }

    trimToRange(interval: ReadonlyNumberRange) {
        this.start = Math.max(this.start, interval.start);
        this.end = Math.min(this.end, interval.end);
        return this;
    }

    trimmedToRange(interval: ReadonlyNumberRange) {
        return this.copy().trimToRange(interval);
    }

    static fromEndpoints(p1: number, p2: number) {
        return new NumberRange()
            .setStart(Math.min(p1, p2))
            .setEnd(Math.max(p1, p2))
    }
}

export class IntRange extends NumberRange implements ReadonlyIntRange {

    constructor();
    constructor(startInclusive: number, endInclusive: number);
    constructor(startInclusive: number = 0, endInclusive: number = 0) {
        super(startInclusive, endInclusive);
    }

    copy() {
        return new IntRange().setStart(this.start).setEnd(this.end);
    }

    get numIntsInRange() {
        return super.length + 1;
    }

    get valuesInRange(): number[] {
        return createArray(this.numIntsInRange, i => i + this.start);
    }

    [Symbol.iterator](): Iterator<number> {
        return this.valuesInRange[Symbol.iterator]();
    }

    map<T>(func: (this: null, value: number) => T): T[] {
        return this.valuesInRange.map(func.bind(null));
    }

    forEach(func: (this: null, value: number) => any): void {
        for (const value of this) {
            func.call(null, value);
        }
    }

    get startExclusive() {
        return this.start - 1;
    }

    set startExclusive(startExclusive: number) {
        this.start = startExclusive + 1;
    }

    setStartExclusive(startExclusive: number) {
        this.startExclusive = startExclusive;
        return this;
    }

    modifyStartExclusive(mappingFunction: (this: null, start: number) => any): this {
        this.startExclusive = mappingFunction.call(null, this.startExclusive);
        return this;
    }

    trimmedToRange(interval: ReadonlyIntRange) {
        return this.copy().trimToRange(interval);
    }

    get endExclusive() {
        return this.end + 1;
    }

    set endExclusive(endExclusive: number) {
        this.end = endExclusive - 1;
    }

    setEndExclusive(endExclusive: number) {
        this.endExclusive = endExclusive;
        return this;
    }

    modifyEndExclusive(mappingFunction : (this: null, start: number) => any) : this {
        this.endExclusive = mappingFunction.call(null, this.endExclusive);
        return this;
    }

    static fromEndpointsExclusive(p1: number, p2: number) {
        return new IntRange()
            .setStartExclusive(Math.min(p1, p2))
            .setEndExclusive(Math.max(p1, p2))
    }

    static fromEndpointsWithStartExclusive(p1: number, p2: number) {
        return new IntRange()
            .setStartExclusive(Math.min(p1, p2))
            .setEnd(Math.max(p1, p2))
    }

    static fromEndpointsWithEndExclusive(p1: number, p2: number) {
        return new IntRange()
            .setStart(Math.min(p1, p2))
            .setEndExclusive(Math.max(p1, p2))
    }

    static forIndicesOf(arrayLike: {length: number}) {
        return new IntRange(0, arrayLike.length - 1);
    }

    static smallestRangeContaining(range: ReadonlyNumberRange) {
        return new IntRange(Math.floor(range.start), Math.ceil(range.end));
    }

    static largestRangeContainedIn(range: ReadonlyNumberRange) {
        return new IntRange(Math.ceil(range.start), Math.floor(range.end));
    }
}