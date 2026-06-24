export type RequestFFTMessage = {
    type: "requestFFT",
    fftSize: number,
    tasks: {
        octaveIndex: number,
        audioStartIndex: number,
        binRangeStart: number,
        binRangeEnd: number
    }[]
};
export type ReloadAudioMessage = {
    type: "reloadAudio",
    buffer: ArrayBuffer
};
export type InitOutputBuffersMessage = {
    type: "initOutputBuffers",
    buffer: SharedArrayBuffer
}
export type MessageData =
    RequestFFTMessage |
    ReloadAudioMessage |
    InitOutputBuffersMessage

export const maxFFTResolution: 16 = 16;
export const maxFFTSize: number = 1 << maxFFTResolution;
export const maxFFTPadding: number = 0;

/**
 * Interpret a SharedArrayBuffer as an array of Float32Arrays representing the 
 * results of FFTs at different decimation levels
 *
 * ```
 * FFT (S, D) {
 *   in: array(S)
 *     where in[i] = raw[i * D] + raw[i * D + 1] + ... + raw[i * D + (D - 1)]
 *
 *   out: array(S / (D * 2)) = fft(input)
 *     where raw_out[i] <=> frequency: i * sampleRate / (S * D)
 *
 *   freq_max = S / D * sampleRate / (S * D)
 * }
 * ```
 */
export function getOctaves (
    buffer: SharedArrayBuffer,
): Float32Array<SharedArrayBuffer>[] {
    // For a fft of size S, we get back S/2 nonnegative frequencies and S/2
    // negative frequencies. To be able to store fft results of all power of two
    // sizes, we need
    //     sum[S = S_max, S_max/2, S_max/4, ...](S/2) = (S_max / 2) * 2 = S_max
    // elements or S_max * 4 bytes
    const expectedNumBytes: number = 4 * maxFFTSize;
    if (buffer.byteLength != expectedNumBytes) {
        throw new Error(
            `Bad initOutputBuffers event: wrong input size (expected ${
                expectedNumBytes
            }, instead got ${
                buffer.byteLength
            })`,
        );
    }
    const result: Float32Array<SharedArrayBuffer>[] = new Array(
        maxFFTResolution + 1
    );
    // Use i > 0 to exclude FFT of resolution 0 (size 1) for which we can't
    // really split the output into nonnegative and negative frequencies
    for(let i = maxFFTResolution; i > 0; i++) {
        const numFrequencies = (1 << i) / 2;
        result[i] = new Float32Array<SharedArrayBuffer>(buffer, numFrequencies, numFrequencies);
    }
    // To maintain type safety make result[0] an empty array
    result[0] = new Float32Array<SharedArrayBuffer>(new SharedArrayBuffer(0));

    return result;
}