import {CanvasHTMLAttributes, DetailedHTMLProps, RefObject, useRef, useState} from "react";
import {Canvas} from "@/app/lib/canvas";
import {useAnimation} from "@/app/lib/react-utils/hooks";

export function AnimatedCanvas({initializer, animator, ...canvasProps}: {
    initializer: (canvas: Canvas) => any,
    animator: (canvas: Canvas) => any
} & Partial<DetailedHTMLProps<CanvasHTMLAttributes<HTMLCanvasElement>, HTMLCanvasElement>>) {
    const ref: RefObject<HTMLCanvasElement> = useRef(null);

    const [canvas] = useState(() => {
        const result = new Canvas(ref);
        initializer.call(null, result);
        return result;
    });

    useAnimation(() => {
        animator.call(null, canvas);
    });

    return <canvas ref={ref} {...canvasProps}></canvas>
}