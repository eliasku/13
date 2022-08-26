import {DEBUG_TERM, DEV_MODE} from "../game/config";

const textTerminal: HTMLLabelElement | null = DEBUG_TERM && document.getElementById("1") as HTMLLabelElement;
let textTerminalBuffer = "";

export function termPrint(text: string) {
    if (DEBUG_TERM) {
        textTerminalBuffer += text;
    }
}

export function termFlush() {
    if (DEBUG_TERM) {
        textTerminal.innerText = textTerminalBuffer;
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
