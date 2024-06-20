import {RefObject, useRef, useState} from "react";
import {Canvas} from "@/app/lib/canvas";
import {useAnimation} from "@/app/lib/react-utils/hooks";

export function AnimatedCanvas({initializer, animator}: {initializer: (canvas: Canvas) => any, animator: (canvas: Canvas) => any}) {
    const ref: RefObject<HTMLCanvasElement> = useRef(null);

    const [canvas] = useState(() => {
        const result = new Canvas(ref);
        initializer.call(null, result);
        return result;
    });

    useAnimation(() => {
        animator.call(null, canvas);
    });

    return <canvas ref={ref}></canvas>
}