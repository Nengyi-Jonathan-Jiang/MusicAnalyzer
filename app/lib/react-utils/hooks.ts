import {RefObject, useEffect, useState} from "react";

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
    }, []);
}