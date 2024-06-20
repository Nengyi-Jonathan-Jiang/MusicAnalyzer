import {NumberRange} from "@/app/lib/utils/numberRange";

export interface CumulativeResultFinder<ResultType = number> {
    accept(value: number): void;

    get(): ResultType;
}

export class MaximumFinder implements CumulativeResultFinder {
    #max: number;

    constructor(initialValue = Number.NEGATIVE_INFINITY) {
        this.#max = initialValue;
    }

    accept = (value: number) => {
        if (value > this.#max) {
            this.#max = value;
        }
    }

    get() {
        return this.#max;
    }
}

export class MinimumFinder implements CumulativeResultFinder {
    #min: number;

    constructor(initialValue = Number.POSITIVE_INFINITY) {
        this.#min = initialValue;
    }

    accept = (value: number) => {
        if (value < this.#min) {
            this.#min = value;
        }
    }

    get() {
        return this.#min;
    }
}

export class MinMaxFinder implements CumulativeResultFinder<NumberRange> {
    readonly #minFinder = new MinimumFinder;
    readonly #maxFinder = new MaximumFinder;

    accept = (value: number) => {
        this.#minFinder.accept(value);
        this.#maxFinder.accept(value);
    }

    get() {
        return new NumberRange(this.#minFinder.get(), this.#maxFinder.get());
    }
}

export class AverageFinder implements CumulativeResultFinder {
    #total: number = 0;
    #numItems: number = 0;

    accept = (value: number) => {
        this.#total += value;
        this.#numItems++;
    }

    get(): number {
        return this.#numItems === 0 ? NaN : this.#total / this.#numItems;
    }
}

export class VarianceFinder implements CumulativeResultFinder {
    readonly #averageSquaredFinder = new AverageFinder;
    readonly #averageFinder = new AverageFinder;
    
    accept = (value: number) => {
        this.#averageFinder.accept(value);
        this.#averageSquaredFinder.accept(value ** 2);
    }

    get(): number {
        return this.#averageSquaredFinder.get() - this.#averageFinder.get() ** 2
    }
}