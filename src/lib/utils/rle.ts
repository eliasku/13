// https://github.com/MichaelDipperstein/rle/blob/master/rle.c

export function decodeRLE(src: Uint8Array, size: number, dest: Uint8Array): number {
    let i = 0;
    let ptr = 0;
    const EOF = 0x100;
    let prevChar = EOF;
    while (i < size) {
        const currChar = src[i++];
        dest[ptr++] = currChar;
        if (currChar === prevChar && /* end of buffer */i < size) {
            let count = src[i++];
            while (count > 0) {
                dest[ptr++] = currChar;
                --count;
            }
            prevChar = EOF;
        } else {
            prevChar = currChar;
        }
    }
    return ptr;
}

export function encodeRLE(src: Uint8Array, size: number, dest: Uint8Array): number {
    const EOF = 0x100;
    let ptr = 0;
    let prevChar = EOF;
    let i = 0;
    while (i < size) {
        let count = 0;
        let currChar = src[i++];
        dest[ptr++] = currChar;
        if (currChar === prevChar) {
            count = 0;
            while (i < size) {
                currChar = src[i++];
                if (currChar === prevChar) {
                    ++count;
                    if (count === 0xFF) {
                        dest[ptr++] = count;
                        prevChar = EOF;
                        break;
                    }
                } else {
                    dest[ptr++] = count;
                    dest[ptr++] = currChar;
                    prevChar = currChar;
                    break;
                }
            }
        } else {
            prevChar = currChar;
        }
        if (i >= size) {
            dest[ptr++] = count;
            break;
        }
    }

    return ptr;
}
