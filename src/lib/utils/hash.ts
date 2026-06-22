const primitiveIds = new Map<any, number>();
const objectIds = new WeakMap<any, number>();
let idCounter = 0;

/**
 * Get a unique number associated with any value. For primitives, this is by
 * value; for objects this is by reference.
 */
export function getObjectId (obj: any): number {
    const store = typeof obj === 'object' ? objectIds : primitiveIds;

    if (!store.has(obj)) {
        store.set(obj, ++idCounter);
    }
    return store.get(obj)!;
}