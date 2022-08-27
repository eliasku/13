import {DEBUG_TERM} from "../game/config";

let textTerminalBuffer = "";

export function termPrint(text: string) {
    if (DEBUG_TERM) {
        textTerminalBuffer += text;
    }
}

export function termFlush() {
    if (DEBUG_TERM) {
        l.innerText = textTerminalBuffer;
    }
}

export function termClear() {
    if (DEBUG_TERM) {
        textTerminalBuffer = "";
    }
}

export function debugSleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(() => resolve(), ms);
    });
}
