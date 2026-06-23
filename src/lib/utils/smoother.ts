import { clamp } from "@/lib/utils/math";

export namespace Smoother {
    /**
     * A function returning the amount of smoothing. `delta` is the difference
     * between the current value and old smoothed value: `delta = curr - old`.
     * The new value shall be calculated as `new <- curr - delta * R` or
     * equivalently `new <- old + delta * (1 - R)` where `R` is the return value
     * of the function, clamped to the range [0, 1].
     *
     * When `R == 0`, this is equivalent to `new <- curr`; when `R == 1` this is
     * equivalent to `new <- old`.
     */
    export type SmoothingFunction<P extends any[] = any[]>
        = (delta: number, elapsedTime: number, ...params: P) => number;

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

    valueOf() {
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

        const delta = newVal - val;

        if (!isFinite(this.lastTime)) this.lastTime = currTime;
        const elapsedTime = currTime - this.lastTime;
        this.currTime = currTime;

        const interpolation = this.smoothFunc(delta, elapsedTime, ...params);
        if (!isFinite(interpolation)) {
            throw new Error(
                `smoothFunc returned bad number ${
                    interpolation
                } on input ${ delta }, ${ elapsedTime }, ${ params }`,
            );
        }
        return newVal - delta * clamp(
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