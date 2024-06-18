"use client"

import {PropsWithChildren, useEffect, useState} from "react";

export default function LoadingScreen({children} : PropsWithChildren) {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    return <>
        {isMounted ? children : (
            <div className="loading-screen">
                <div className="loading-screen-spinner"></div>
                <span className="loading-screen-text">Loading editor...</span>
            </div>
        )}
    </>
}