import {
    CanvasHTMLAttributes, DetailedHTMLProps, RefObject, useMemo, useRef,
} from "react";
import { Canvas } from "@/lib/canvas";
import { useAnimation } from "@/lib/react-utils/hooks";
import { getStaticVariable } from "@/lib/utils/getStaticVariable";

export function AnimatedCanvas ({
    initializer,
    animator,
    ref = null,
    ...canvasProps
}: {
    initializer: (canvas: Canvas) => (void | (() => void)),
    animator: (canvas: Canvas) => any,
    ref?: RefObject<HTMLCanvasElement | null> | null,
} & Partial<DetailedHTMLProps<CanvasHTMLAttributes<HTMLCanvasElement>, HTMLCanvasElement>>) {
    const defaultRef: RefObject<HTMLCanvasElement | null> = useRef(null);
    const r: RefObject<HTMLCanvasElement | null> = ref ?? defaultRef;

    const canvas = useMemo(() => {
        const oldResultCleanup = getStaticVariable(() => [ () => {} ]);
        oldResultCleanup[0]();

        const result = new Canvas(r);
        oldResultCleanup[0] = initializer.call(null, result) ?? (() => {});
        return result;
    }, [ r ]);

    useAnimation(useMemo(() => () => {
        animator.call(null, canvas);
    }, [ canvas ]));

    return <canvas ref={ r } { ...canvasProps }></canvas>;
}