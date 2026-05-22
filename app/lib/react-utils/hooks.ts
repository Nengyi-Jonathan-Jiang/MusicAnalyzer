import {RefObject, useEffect, useState, DependencyList} from "react";

function createRefList<T>(amount: number) : RefObject<T>[] {
    return new Array<null>(amount).fill(null).map(() => ({current: null}))
}

export function useRefs<T>(amount: number) : RefObject<T>[] {
    const [refList, setRefList] = useState(() => createRefList<T>(amount));
    if(amount !== refList.length) {
        setRefList(createRefList(amount));
    }
    return refList;
}

let isCurrentlyAnimating = false;
let animations = new Set<(t: DOMHighResTimeStamp) => any>;

function startAnimatingIfNotAnimating() {
    if(isCurrentlyAnimating) return;
    isCurrentlyAnimating = true;

    requestAnimationFrame(function f(t){
        if(animations.size > 0) {
            animations.forEach(callback => callback.call(null, t));
            requestAnimationFrame(f)
        }
        else {
            isCurrentlyAnimating = false;
        }
    })
}

export function useAnimation(callback: (currTime: number, deltaTime: number) => any) {
    useEffect(() => {
        let lastFrameTime : number | undefined = undefined;

        const f = (time: DOMHighResTimeStamp) => {
            const currTime = time / 1000;
            lastFrameTime ??= currTime;
            const deltaTime = currTime - lastFrameTime;
            lastFrameTime = currTime;

            callback.call(null, currTime, deltaTime);
        }

        animations.add(f);
        startAnimatingIfNotAnimating();

        return () => { animations.delete(f) };
    });
}

export function useListenerOnWindow<K extends keyof WindowEventMap> (
    { listenerType, listener, passive }: {
        listenerType: K | K[],
        listener: (this: Window, ev: WindowEventMap[K]) => any,
        passive?: boolean
    },
    dependencies?: DependencyList,
): void {
    useEffect(() => {
        const listenerTypes = Array.isArray(listenerType)
            ? listenerType
            : [ listenerType ];
        if (globalThis["window"]) {
            const window: Window = globalThis["window"];

            // Remove existing instances of listener if they exist
            for (const listenerType of listenerTypes) {
                window.removeEventListener(listenerType, listener);
            }
            // Add listeners
            for (const listenerType of listenerTypes) {
                window.addEventListener(
                    listenerType, listener,
                    (passive && { passive }) ?? undefined,
                );
            }
            return (): undefined => {
                for (const listenerType of listenerTypes) {
                    window.removeEventListener(listenerType, listener);
                }
            };
        }
    }, dependencies ?? []);
}

export function useListenerOnElement<K extends keyof HTMLElementEventMap> (
    element: HTMLElement | RefObject<HTMLElement | null>,
    { listenerType, listener, passive }: {
        listenerType: K | K[],
        listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any,
        passive?: boolean
    }, dependencies?: DependencyList,
): void {
    useEffect(() => {
        const el: HTMLElement | null = element instanceof HTMLElement
            ? element
            : element.current;
        const listenerTypes = Array.isArray(listenerType)
            ? listenerType
            : [ listenerType ];
        if (el) {
            // Remove existing instances of listener if they exist
            for (const listenerType of listenerTypes) {
                el.removeEventListener(listenerType, listener);
            }
            // Add listeners
            for (const listenerType of listenerTypes) {
                el.addEventListener(
                    listenerType, listener,
                    (passive && { passive }) ?? undefined,
                );
            }
            return (): undefined => {
                for (const listenerType of listenerTypes) {
                    el.removeEventListener(listenerType, listener);
                }
            };
        }
    }, [ element, ...(dependencies ?? []) ]);
}