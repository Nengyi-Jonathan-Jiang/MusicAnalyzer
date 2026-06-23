import { useState } from "react";

type ArrLike<T> = {
    length: number,
    [n: number]: T
}
type TypedArray =
    | Int8Array
    | Uint8Array
    | Uint8ClampedArray
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array
    | Float32Array
    | Float64Array
    | BigInt64Array
    | BigUint64Array;

/**
 * Creates an array with a specified length and fills it with values.
 * @param length The length of the array to be created
 * @param value If this is a function, it will be with each index in the range
 *     [0, length) to populate the array. Otherwise, the array will be filled
 *     with this value.
 */
export function createArray<T> (
    length: number, value: T | ((index: number) => T)): T[] {
    if (length < 1) return [];
    return typeof value === "function"
        ? new Array(length).fill(null)
            .map((_, i) => (value as (index: number) => T)(i))
        : new Array(length).fill(value);
}

export function editArray<A extends number[] | TypedArray> (
    arr: A, f: (value: number, index: number) => number,
    startInclusive ?: number, endInclusive ?: number,
): A;
export function editArray<T, A extends T[]> (
    arr: A, f: (value: T, index: number) => T,
    startInclusive ?: number, endInclusive ?: number,
): A;
export function editArray<T, A extends ArrLike<T> = ArrLike<T>> (
    arr: A, f: (value: T, index: number) => T,
    startInclusive ?: number, endInclusive ?: number,
): A {
    startInclusive ??= 0;
    endInclusive ??= arr.length - 1;

    for (let i = startInclusive ; i <= endInclusive ; i++) {
        arr[i] = f(arr[i], i);
    }

    return arr;
}

export function arraysEqual<T> (a: ArrayLike<T>[], b: ArrayLike<T>[]) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length !== b.length) return false;

    for (let i = 0 ; i < a.length ; ++i) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

/**
 * A custom react hook. Returns a function `rerender()` which forces the
 * component to update
 */
export function useManualRerender (): () => void {
    const [ dummy, setDummy ] = useState(0);
    return () => setDummy(dummy + 1);
}