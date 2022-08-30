import {unlockAudio} from "../audio/context";

export interface Pointer {
    id_: number;
    startX_: number;
    startY_: number;
    x: number;
    y: number;
    downEvent_: boolean;
    upEvent_: boolean;
    active_: boolean;
}

/* @__PURE__ */
function newPointer(id_: number): Pointer {
    return {
        id_,
        startX_: 0,
        startY_: 0,
        x: 0,
        y: 0,
        downEvent_: false,
        upEvent_: false,
        active_: false,
    };
}

export const mousePointer = newPointer(0);
export const inputPointers = new Map<number, Pointer>();
export const keyboardState: Set<string> = new Set();
export const keyboardDown: Set<string> = new Set();
export const keyboardUp: Set<string> = new Set();

export function getPointer(id: number): Pointer {
    let p = inputPointers.get(id);
    if (!p) {
        p = newPointer(id);
        inputPointers.set(id, p);
    }
    return p;
}

function handleDown(pointer: Pointer, x: number, y: number) {
    pointer.x = x;
    pointer.y = y;
    pointer.startX_ = x;
    pointer.startY_ = y;
    pointer.downEvent_ = true;
    pointer.active_ = true;
    // console.info("-down:", pointer.id_);
}

function handleMove(pointer: Pointer, x: number, y: number) {
    pointer.x = x;
    pointer.y = y;
    // console.info("-move:", pointer.id_);
}

function handleUp(pointer: Pointer) {
    pointer.upEvent_ = true;
    pointer.active_ = false;
    // console.info("-up:", pointer.id_);
}

export function initInput() {
    oncontextmenu = e => e.preventDefault();
    const handleMouse = (e: MouseEvent, fn: (pointer: Pointer, x: number, y: number) => void) => {
        const scale = c.width / c.clientWidth;
        const bb = c.getBoundingClientRect();
        fn(mousePointer,
            ((e.clientX - bb.x) * scale) | 0,
            ((e.clientY - bb.y) * scale) | 0);
    };
    c.onmousedown = (e) => {
        handleMouse(e, handleDown);
        unlockAudio();
        // console.info("onmousedown");
    };

    c.onmouseup = (e) => {
        handleUp(mousePointer);
        //e.preventDefault();
        // console.info("onmouseup");
    };

    c.onmouseleave = (e) => {
        handleUp(mousePointer);
        // console.info("onmouseleave");
    };

    c.onmouseenter = (e) => {
        if (e.buttons) {
            handleMouse(e, handleDown);
        }
        // console.info("onmouseenter");
    };

    c.onmousemove = (e) => {
        handleMouse(e, handleMove);
        // console.info("onmousemove");
    };

    const handleTouchEvent = (e: TouchEvent, fn: (pointer: Pointer, x: number, y: number) => void) => {
        e.preventDefault();
        const scale = c.width / c.clientWidth;
        const bb = c.getBoundingClientRect();
        for (let i = 0; i < e.changedTouches.length; ++i) {
            const touch = e.changedTouches.item(i)!;
            fn(getPointer(touch.identifier),
                ((touch.clientX - bb.x) * scale) | 0,
                ((touch.clientY - bb.y) * scale) | 0);
        }
    };
    c.ontouchstart = (e: TouchEvent) => {
        handleTouchEvent(e, handleDown);
        unlockAudio();
        // console.info("ontouchstart");
    };
    c.ontouchmove = (e: TouchEvent) => {
        handleTouchEvent(e, handleMove);
        // console.info("ontouchmove");
    };
    c.ontouchend = (e: TouchEvent) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; ++i) {
            const touch = e.changedTouches.item(i)!;
            handleUp(getPointer(touch.identifier));
        }
        // console.info("ontouchend");
    };

    document.onkeydown = (e: KeyboardEvent) => {
        e.preventDefault();
        if (!keyboardState.has(e.code) && !e.repeat) {
            keyboardDown.add(e.code);
            keyboardState.add(e.code);
        }
        unlockAudio();
    };
    document.onkeyup = (e: KeyboardEvent) => {
        e.preventDefault();
        if (keyboardState.delete(e.code)) {
            keyboardUp.add(e.code);
        }
    };
}

export function updateInput() {
    keyboardDown.clear();
    keyboardUp.clear();
    mousePointer.downEvent_ = false;
    mousePointer.upEvent_ = false;
    for (const [, p] of inputPointers) {
        p.downEvent_ = false;
        p.upEvent_ = false;
    }
}

export function isAnyKeyDown() {
    for (const [, p] of inputPointers) {
        if (p.downEvent_) return true;
    }
    return mousePointer.downEvent_ || keyboardDown.size;
}