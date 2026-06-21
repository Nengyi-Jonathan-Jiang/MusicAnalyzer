import {
    createRef, DetailedHTMLProps, InputHTMLAttributes, LabelHTMLAttributes,
    useMemo,
} from "react";
import { useListenerOnWindow } from "@/lib/react-utils/hooks";


export function Uploader ({ callback, fileTypes, labelProps, inputProps }: {
    callback: (url: string, onLoad: () => void, fileName: string) => any,
    fileTypes: string[],
    labelProps?: DetailedHTMLProps<LabelHTMLAttributes<HTMLLabelElement>, HTMLLabelElement>,
    inputProps?: DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>,
}) {
    const labelRef = createRef<HTMLLabelElement>();

    function onUpload ({ target: { files } }: {
        target: { files: { length: number, [_: number]: File } | null }
    }) {
        if (!files?.length) return;

        const file: File = files[0];
        const urlObj = URL.createObjectURL(file);
        (labelRef.current!.firstChild as Text).textContent = file.name;
        callback.call(
            null,
            urlObj,
            () => URL.revokeObjectURL(urlObj),
            file.name,
        );
    }

    useListenerOnWindow({
        listenerType: 'dragover',
        listener:     useMemo(() => (e: DragEvent) => {
            if (!e.dataTransfer) return;
            const items = [ ...e.dataTransfer.items ]
                .filter(i => i.kind === "file");
            if (items.length) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
            }
        }, []),
    });
    useListenerOnWindow({
        listenerType: 'drop', listener: useMemo(() => (e: DragEvent) => {
            if (!e.dataTransfer) return;
            const files = [ ...e.dataTransfer.items ]
                .filter(i => i.kind === "file")
                .map(i => i.getAsFile())
                .filter((i): i is File => i !== null);

            if (files.length) {
                e.preventDefault();
                onUpload({ target: { files } });
            }
        }, [ callback ]),
    });

    return <label { ...labelProps } ref={ labelRef }>
        Upload
        <input type="file"
               accept={ fileTypes.join(', ') }
               onChange={ onUpload }
               { ...inputProps }
        />
    </label>;
}