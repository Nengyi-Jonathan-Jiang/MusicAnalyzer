export function setWeakInterval<T extends object> (
    targetObject: T, callback: (obj: T) => void, delay: number,
): number {
    const ref = new WeakRef(targetObject);
    const id = setInterval(() => {
        const obj = ref.deref();

        if (obj) callback(obj);
        else clearInterval(id);
    }, delay);

    return id;
}