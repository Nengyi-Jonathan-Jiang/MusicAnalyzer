export function clamp (x: number, min: number, max: number) {
    return x < min ? min : x > max ? max : x;
}

/**
 * A "magnet" function `f(x - x₀, a, p)` which, when added to `x`, "pulls" the
 * output around `x₀`
 * ```
 *      ,___,
 *   --/     X     /--
 *            `‾‾‾`
 *  ```
 *  resulting in a graph something like
 *  ```
 *                   /
 *                 /
 *                /
 *               /
 *        _,-X-'‾
 *      /
 *     /
 *    /
 *  /
 *  ```
 *  which deviates from a line becoming nearly flat around `x₀`
 *
 *  The maximum deviation from linear is achieved at `x - x₀ = ±a`, and `p`
 *  controls how quickly the deviation returns to zero.
 */
export function magnet (x: number, x0: number, a: number, p: number = 2) {
    x -= x0;
    return -x * (1 + (x * x) / (a * a) / (2 * p - 1)) ** -p;
}