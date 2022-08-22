import {DEBUG_TERM, DEV_MODE} from "../game/config";

export function logWarn(msg: string): void {
    if (DEV_MODE) {
        console.warn(msg);
    }
}

export function log(msg: string): void {
    if (DEV_MODE) {
        console.log(msg);
    }
}

export function logAssert(expr: boolean): void {
    if (DEV_MODE) {
        console.assert(expr);
    }
}

export function logDoc(html: string): void {
    if (DEBUG_TERM) {
        const p = document.createElement("p");
        p.innerHTML = html;
        document.body.prepend(p);
    }
}

let textTerminal: HTMLLabelElement | null = DEBUG_TERM && document.getElementById("l") as HTMLLabelElement;
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
