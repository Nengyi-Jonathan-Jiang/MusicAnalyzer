import {DetailedHTMLProps, InputHTMLAttributes, LabelHTMLAttributes} from "react";


export function Uploader({callback, fileTypes, labelProps, inputProps}: {
    callback: (url: string, revokeURL: () => void) => any,
    fileTypes: string[],
    labelProps?: DetailedHTMLProps<LabelHTMLAttributes<HTMLLabelElement>, HTMLLabelElement>,
    inputProps?: DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>,
}) {
    function onUpload({target}: { target: HTMLInputElement }) {
        if (!target.files?.length) return;

        const urlObj = URL.createObjectURL(target.files[0]);
        callback.call(null, urlObj, () => URL.revokeObjectURL(urlObj));
    }

    return <label {...labelProps}>
        <input type="file" accept={fileTypes.join(', ')} onChange={onUpload} {...inputProps}/>
    </label>
}