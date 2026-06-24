// Buffers for communication with main thread
import {
    getOctaves,
    maxFFTResolution, MessageData, RequestFFTMessage,
} from "@/logic/analyzer_shared";

let inputBuffer: Float32Array = null;
let outputBuffers: Float32Array<SharedArrayBuffer>[] | null = null;

// Most recent FFT task requested by main thread
let currentTask: RequestFFTMessage | null = null;

self.addEventListener("message", ({ data: anyData }) => {
    const data = anyData as MessageData;

    switch (data.type) {
        case "requestFFT":
            currentTask = data;
            break;
        case "reloadAudio":
            inputBuffers = initializeInputBuffers(data.buffer);
            break;
        case "initOutputBuffers":
            outputBuffers = getOctaves(data.buffer);
            break;
    }
});

while (true) {

    await scheduler.yield();
}