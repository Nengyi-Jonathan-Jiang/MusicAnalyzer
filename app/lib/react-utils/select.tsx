import {ComponentType, CSSProperties, RefObject, useEffect, useRef, useState} from "react";
import {useRefs} from "@/app/lib/react-utils/hooks";
import {useListenerOnWindow} from "@/app/lib/utils/util";

type SelectOptionComponentProps<OptionValueType, RefType extends HTMLElement> = {
    value: OptionValueType,
    elementRef: RefObject<RefType>
}

type SelectOptionComponent<OptionValueType, RefType extends HTMLElement> = ComponentType<SelectOptionComponentProps<OptionValueType, RefType>>;

function BasicSelectOptionComponent<OptionValueType>
({
     value,
     elementRef,
     ...otherProps
 }: SelectOptionComponentProps<OptionValueType, HTMLSpanElement>) {
    return <span ref={elementRef} {...otherProps}>{value?.toString()}</span>
}

const selectOptionsStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    width: "fit-content",
}
const selectOptionsClosedStyle: CSSProperties = {
    opacity: 0,
    userSelect: "none",
    pointerEvents: "none",
    height: 0,
    overflowY: "hidden"
};
const selectOptionsOpenStyle: CSSProperties = {
    height: 0,
    overflowY: "visible"
};

type SelectProps<OptionValueType, ActiveOptionRefType extends HTMLElement, OptionRefType extends HTMLElement> = {
    containerClassName?: string,
    onChange: ((value: OptionValueType) => void),
    value: OptionValueType,
    options: OptionValueType[]
    ActiveOptionComponent?: SelectOptionComponent<OptionValueType, ActiveOptionRefType>,
    OptionComponent?: SelectOptionComponent<OptionValueType, OptionRefType>,
    id?: string,
    containerProps?: (currentValue: OptionValueType) => any,
    activeOptionProps?: (currentValue: OptionValueType) => any,
    optionProps?: (optionValue: OptionValueType, currentValue: OptionValueType) => any,
};

export function Select<OptionValueType, ActiveOptionRefType extends HTMLElement, OptionRefType extends HTMLElement>
({
     onChange,
     options,
     value,
     ActiveOptionComponent = BasicSelectOptionComponent,
     OptionComponent = BasicSelectOptionComponent,
     containerProps = () => ({}),
     activeOptionProps = () => ({}),
     optionProps = () => ({}),
    ...otherProps
 }: SelectProps<OptionValueType, ActiveOptionRefType, OptionRefType>) {
    const [isOpen, setIsOpen] = useState(false);

    const open = () => setIsOpen(true);
    const close = () => setIsOpen(false);
    const toggleOpen = () => setIsOpen(!isOpen);

    const containerRef = useRef<HTMLDivElement>(null);
    const activeOptionRef = useRef<ActiveOptionRefType>(null);
    const optionRefs = useRefs<OptionRefType>(options.length);

    useEffect(() => {
        optionRefs.forEach(({current}, i) => {
            if (current === null) return;
            current.onclick = () => {
                onChange(options[i]);
                close();
            }
        })
    }, [optionRefs, isOpen]);

    useListenerOnWindow(window, "mousedown", e => {
        if(containerRef.current === null || e.target === null) return;

        if(!containerRef.current.contains(e.target as Node)) {
            close();
        }
    })

    return <div ref={containerRef} {...containerProps(value)} {...otherProps}>
        <div onClick={() => {
            toggleOpen();
        }}>
            <ActiveOptionComponent value={value} elementRef={activeOptionRef} {...activeOptionProps(value)}/>
        </div>
        {
            <div style={{...(isOpen ? selectOptionsOpenStyle : selectOptionsClosedStyle)}}>
                <div style={selectOptionsStyle}>
                    {options.map((option, i) =>
                        <OptionComponent value={option} elementRef={optionRefs[i]} key={i} {...optionProps(option, value)}/>
                    )}
                </div>
            </div>
        }
    </div>
}