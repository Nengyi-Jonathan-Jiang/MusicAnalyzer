import { clamp } from "./util";

export namespace Smoother {
    /**
     * A function returning the amount of interpolation between the old and new
     * values. `err` is the difference between the current and old smoothed
     * value: `err = curr - old`
     *
     * A return value of 0 indicates directly using the new value and a return
     * value of 1 indicates directly using the old value. Return values outside
     * this range are clamped.
     */
    export type SmoothingFunction<P extends any[] = any[]>
        = (err: number, elapsedTime: number, ...params: P) => number;

    export type Options<P extends any[] = any[]> = {
        initialValue?: number,
        initialTime?: number,
        func: Smoother.SmoothingFunction<P>
    }
}

/** A class representing a smoothed value */
export class Smoother<P extends any[] = []> {
    private val: number;
    private lastTime: number;
    private currTime: number = NaN;
    private readonly smoothFunc: Smoother.SmoothingFunction<P>;

    /**
     * @see Smoother.SmoothingFunction
     */
    constructor (options: Smoother.Options<P>) {
        this.val = options.initialValue ?? NaN;
        this.lastTime = options.initialTime ?? NaN;
        this.smoothFunc = options.func;
    }

    get value () {
        return this.val;
    }

    static exponential (
        options: Omit<Smoother.Options, "func">,
    ): Smoother<[ number ]> {
        return new Smoother<[ number ]>({
            ...options,
            func (_, elapsedTime, decayConstant) {
                return Math.exp(-elapsedTime / decayConstant);
            },
        });
    }

    /**
     * Update the smoothed value stored in this object.
     */
    update (newVal: number, currTime: number, ...params: P): this {
        if (!isFinite(this.val)) this.val = newVal;
        if (!isFinite(newVal)) return this;
        this.val = this.calculate(this.val, newVal, currTime, ...params);
        this.updateTime();
        return this;
    }

    /**
     * Calculate the new smoothed value
     *
     * Unlike {@link update `update()`}, {@link updateTime `updateTime()`} must
     * be called after this to update the stored last time. If using this for
     * multiple values, `updateTime()` should only be called once after
     * calculating for multiple values
     */
    calculate (
        val: number, newVal: number,
        currTime: number,
        ...params: P
    ): number {
        if (!isFinite(val)) val = newVal;
        if (!isFinite(newVal)) throw new Error(
            "Input to smoother must be finite");

        const err = newVal - val;

        if (!isFinite(this.lastTime)) this.lastTime = currTime;
        const elapsedTime = currTime - this.lastTime;
        this.currTime = currTime;

        const interpolation = this.smoothFunc(err, elapsedTime, ...params);
        if (!isFinite(interpolation)) {
            throw new Error(
                `smoothFunc returned bad number ${
                    interpolation
                } on input ${ err }, ${ elapsedTime }, ${ params }`,
            );
        }
        return newVal - err * clamp(
            interpolation,
            0, 1,
        );
    }

    /**
     * Update the stored last time. This makes future calculations of elapsed
     * time correct
     */
    updateTime () {
        if (!isNaN(this.currTime)) {
            this.lastTime = this.currTime;
            this.currTime = NaN;
        }
    }
}

/** A {@link Smoother `Smoother`} used only to update external values */
export type ExternalSmoother<P extends any[] = []> = Omit<Smoother<P>, "value" | "update">