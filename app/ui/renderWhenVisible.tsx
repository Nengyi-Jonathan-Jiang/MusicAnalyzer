import {PropsWithChildren, ReactNode, RefObject, useEffect, useRef, useState} from "react";

const observationCallbacks = new Map<Element, (isIntersecting: boolean) => void>;

const observer = new IntersectionObserver((entries) => {
    entries.forEach(({target: element, isIntersecting}) => {
        const callBack = observationCallbacks.get(element);
        if(callBack) {
            callBack(isIntersecting);
        }
    })
}, {rootMargin: "200px"});

function addObservedElement(element : Element, callback : (isIntersecting: boolean) => void){
    observationCallbacks.set(element, callback);
    observer.observe(element);
}

function removeObservedElement(element : Element){
    observer.unobserve(element);
    observationCallbacks.delete(element);
}

/**
 * A component that renders its children the first time the placeholder element supplied by {@link placeholderSupplier}
 * is scrolled into view on the screen.
 *
 * @param children The child elements to be rendered
 * @param placeholderSupplier The placeholder element. This should be a cheap component (otherwise, the purpose of
 * this component would be defeated) that sets the ref provided to the element to be observed.
 */
export function RenderWhenVisible<ElementType extends Element>({children, placeholderSupplier}: PropsWithChildren<{placeholderSupplier: (ref : RefObject<ElementType>) => ReactNode}>) {
    const [hasBeenObserved, setHasBeenObserved] = useState(false);
    const placeholderRef = useRef<ElementType>(null);

    useEffect(() => {
        if (!placeholderRef.current) {
            throw new Error("Placeholder ref must have an element");
        }

        addObservedElement(placeholderRef.current, (isIntersecting) => {
            if(isIntersecting) {
                setHasBeenObserved(true);
            }
        });

        return () => {
            if(placeholderRef.current) {
                removeObservedElement(placeholderRef.current);
            }
        }
    }, []);

    return <>
        {
            hasBeenObserved ? children : placeholderSupplier(placeholderRef)
        }
    </>
}