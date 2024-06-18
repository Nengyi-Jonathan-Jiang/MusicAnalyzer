
export interface MaximumFinder<T> {
    accept(value: T) : void;
    get() : T;
}

export class MaximumNumberFinder implements MaximumFinder<number> {
    #max: number;

    constructor(initialValue = Number.NEGATIVE_INFINITY) {
        this.#max = initialValue;
    }

    accept(value: number) {
        if (value > this.#max) {
            this.#max = value;
        }
    }

    get() {
        return this.#max;
    }
}

export class MaximumValueFinder<T> implements MaximumFinder<T> {
    #max : T;
    readonly #greaterThanFunc : (a : T, b : T) => boolean;

    constructor(initialValue: T, greaterThanFunc : (a: T, b: T) => boolean) {
        this.#max = initialValue;
        this.#greaterThanFunc = greaterThanFunc;
    }

    accept(value: T) {
        if(this.#greaterThanFunc(value, this.#max)) {
            this.#max = value;
        }
    }

    get(): T {
        return this.#max;
    }
}