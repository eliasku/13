import {unlockAudio} from "../audio/context";
import {gl} from "../graphics/gl";

export interface Pointer {
    id_: number;
    startX_: number;
    startY_: number;
    prevX_: number;
    prevY_: number;
    x_: number;
    y_: number;
    downEvent_: boolean;
    upEvent_: boolean;
    active_: boolean;
}

function newPointer(id_: number): Pointer {
    return {
        id_,
        startX_: 0,
        startY_: 0,
        prevX_: 0,
        prevY_: 0,
        x_: 0,
        y_: 0,
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
    if(!p) {
        p = newPointer(id);
        inputPointers.set(id, p);
    }
    return p;
}

function handleDown(pointer: Pointer, x: number, y: number) {
    pointer.x_ = x;
    pointer.y_ = y;
    pointer.prevX_ = x;
    pointer.prevY_ = y;
    pointer.startX_ = x;
    pointer.startY_ = y;
    pointer.downEvent_ = true;
    pointer.active_ = true;
}

function handleMove(pointer: Pointer, x: number, y: number) {
    pointer.prevX_ = pointer.x_;
    pointer.prevY_ = pointer.y_;
    pointer.x_ = x;
    pointer.y_ = y;
}

function handleUp(pointer: Pointer) {
    pointer.upEvent_ = true;
    pointer.active_ = false;
}

export function initInput() {
    const canvas = gl.canvas;
    oncontextmenu = e => e.preventDefault();
    const handleMouse = (e: MouseEvent, fn: (pointer: Pointer, x: number, y: number) => void) => {
        const scale = canvas.width / canvas.clientWidth;
        const bb = canvas.getBoundingClientRect();
        fn(mousePointer,
            ((e.clientX - bb.x) * scale) | 0,
            ((e.clientY - bb.y) * scale) | 0);
    };
    canvas.addEventListener("mousedown", (e) => {
        handleMouse(e, handleDown);
        unlockAudio();
    }, false);

    canvas.addEventListener("mouseup", (e) => {
        handleUp(mousePointer);
        e.preventDefault();
    }, false);

    canvas.addEventListener("mouseleave", (e) => {
        handleUp(mousePointer);
    }, false);

    canvas.addEventListener("mouseenter", (e) => {
        if (e.buttons) {
            handleMouse(e, handleDown);
        }
    }, false);

    canvas.addEventListener("mousemove", (e) => {
        handleMouse(e, handleMove);
    }, false);

    const handleTouchEvent = (e: TouchEvent, fn: (pointer: Pointer, x: number, y: number) => void) => {
        e.preventDefault();
        const scale = canvas.width / canvas.clientWidth;
        const bb = canvas.getBoundingClientRect();
        for (let i = 0; i < e.changedTouches.length; ++i) {
            const touch = e.changedTouches.item(i)!;
            fn(getPointer(touch.identifier),
                ((touch.clientX - bb.x) * scale) | 0,
                ((touch.clientY - bb.y) * scale) | 0);
        }
    };
    canvas.addEventListener("touchstart", (e) => {
        handleTouchEvent(e, handleDown);
        unlockAudio();
    }, false);
    canvas.addEventListener("touchmove", (e) => {
        handleTouchEvent(e, handleMove);
    }, false);
    const onTouchEnd = (e: TouchEvent) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; ++i) {
            const touch = e.changedTouches.item(i)!;
            handleUp(getPointer(touch.identifier));
        }
    };
    canvas.addEventListener("touchend", onTouchEnd, false);

    const wnd = document;
    //wnd.addEventListener("keypress", onKey, true);
    wnd.addEventListener("keydown", (e) => {
        e.preventDefault();
        if (!keyboardState.has(e.code)) {
            keyboardDown.add(e.code);
        }
        keyboardState.add(e.code);
        unlockAudio();
    }, false);
    wnd.addEventListener("keyup", (e) => {
        e.preventDefault();
        if (keyboardState.has(e.code)) {
            keyboardUp.add(e.code);
        }
        keyboardState.delete(e.code);
    }, false);
}

export function updateInput() {
    keyboardDown.clear();
    keyboardUp.clear();
    mousePointer.downEvent_ = false;
    mousePointer.upEvent_ = false;
    for(const [,p] of inputPointers) {
        p.downEvent_ = false;
        p.upEvent_ = false;
    }
}

export function isAnyKeyDown() {
    for (const [,p] of inputPointers) {
        if (p.downEvent_) return true;
    }
    return mousePointer.downEvent_ || keyboardDown.size;
}