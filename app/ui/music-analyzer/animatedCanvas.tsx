import {
    CanvasHTMLAttributes, DetailedHTMLProps, RefObject, useMemo, useRef,
} from "react";
import { Canvas } from "@/app/lib/canvas";
import { useAnimation } from "@/app/lib/react-utils/hooks";

export function AnimatedCanvas ({
    initializer,
    animator,
    ref = null,
    ...canvasProps
}: {
    initializer: (canvas: Canvas) => any,
    animator: (canvas: Canvas) => any,
    ref?: RefObject<HTMLCanvasElement> | null,
} & Partial<DetailedHTMLProps<CanvasHTMLAttributes<HTMLCanvasElement>, HTMLCanvasElement>>) {
    const defaultRef: RefObject<HTMLCanvasElement> = useRef(null);
    const r: RefObject<HTMLCanvasElement> = ref ?? defaultRef;

    const canvas = useMemo(() => {
        const result = new Canvas(r);
        initializer.call(null, result);
        return result;
    }, [ r ]);

    useAnimation(useMemo(() => () => {
        animator.call(null, canvas);
    }, [ canvas ]));

    return <canvas ref={ r } { ...canvasProps }></canvas>;
}