import {
    DetailedHTMLProps, InputHTMLAttributes, LabelHTMLAttributes, useMemo,
} from "react";
import { useListenerOnWindow } from "@/app/lib/react-utils/hooks";


export function Uploader ({ callback, fileTypes, labelProps, inputProps }: {
    callback: (url: string, onLoad: () => void) => any,
    fileTypes: string[],
    labelProps?: DetailedHTMLProps<LabelHTMLAttributes<HTMLLabelElement>, HTMLLabelElement>,
    inputProps?: DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>,
}) {
    function onUpload ({ target: { files } }: {
        target: { files: { length: number, [_: number]: File } | null }
    }) {
        if (!files?.length) return;

        const urlObj = URL.createObjectURL(files[0]);
        callback.call(null, urlObj, () => URL.revokeObjectURL(urlObj));
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

    return <label { ...labelProps }>
        <input type="file"
               accept={ fileTypes.join(', ') }
               onChange={ onUpload }
               { ...inputProps }
        />
    </label>;
}