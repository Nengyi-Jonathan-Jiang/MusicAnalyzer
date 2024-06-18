import {RefObject, useState} from "react";

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