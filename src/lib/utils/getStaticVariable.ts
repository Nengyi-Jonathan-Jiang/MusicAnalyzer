const map: Map<string, WeakMap<object, any>> = new Map;
const nullContext: object = new class FunctionStaticNullContext {};

/**
 * Access a static variable identified by the specific location in the calling
 * code and an optional context object, using black magic.
 *
 * This incurs the cost of creating an {@link Error} object and capturing the
 * call stack, which may be a problem if called many times in a hot loop
 *
 * @param initial A function used to get the initial value of the variable. This
 *                will only be called once per variable.
 */
export function getStaticVariable<T> (
    this: object | void, initial: () => T,
    context ?: object | undefined | null,
): T {
    const stack = new Error().stack;
    if (!stack) throw new Error("This is what you get for using black magic");
    const m: RegExpMatchArray | null = stack.match(/^.*:\d+:\d+.*\n(.*)/m);
    if (!m?.[1]) throw new Error("This is what you get for using black magic");
    const id = m[1].trim();

    context ??= this ?? nullContext;
    if (!map.has(id)) map.set(id, new Map);
    const innerMap = map.get(id)!;
    if (!innerMap.has(context)) {
        console.debug(`Create function static ${ id } with context`, context);
        innerMap.set(context, initial());
    }
    return innerMap.get(context);
}