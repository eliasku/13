import {DEBUG_TERM} from "../game/config";

let textTerminalBuffer = "";

export const termPrint = (text: string) => {
    if (DEBUG_TERM) {
        textTerminalBuffer += text;
    }
}

export const termFlush = () => {
    if (DEBUG_TERM) {
        l.innerText = textTerminalBuffer;
    }
}

export const termClear = () => {
    if (DEBUG_TERM) {
        textTerminalBuffer = "";
    }
}

export const debugSleep = (ms: number): Promise<void> =>
    new Promise(resolve => setTimeout(() => resolve(), ms));
