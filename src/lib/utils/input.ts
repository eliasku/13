import {audioContext} from "../audio/context";
import {getOrCreate} from "./utils";

export interface Pointer {
    id_: number;
    startX_: number;
    startY_: number;
    x_: number;
    y_: number;
    downEvent_: boolean;
    upEvent_: boolean;
    active_: boolean;
}

export const enum KeyCode {
    Space = 32,
    A = 65,
    S = 83,
    W = 87,
    D = 68,
    Right = 39,
    Left = 37,
    Up = 38,
    Down = 40,
    Shift = 16,
    E = 69,

    Digit0 = 48,
    Digit1,
    Digit2,
    Digit3,
    Digit4,
    Digit5,
    Digit6,
    Digit7,
    Digit8,
    Digit9,
}

export let mousePointer: Pointer;
export const inputPointers = new Map<number, Pointer>();
export const keyboardState: number[] = [];
export const keyboardDown: number[] = [];
export const keyboardUp: number[] = [];

// LOCAL SCOPE
{
    const getPointer = (id: number): Pointer => getOrCreate(inputPointers, id, newPointer);

    const unlockAudio = () => {
        if (audioContext.state[0] == "s") {
            // audioContext.resume().then(() => {
            //     console.info("AudioContext resumed");
            // }).catch((reason) => {
            //     console.error("AudioContext resume failed:", reason);
            // });
            audioContext.resume().catch();
        }
    }

    /* @__PURE__ */
    const newPointer = (id_: number): Pointer => ({
        id_,
        startX_: 0,
        startY_: 0,
        x_: 0,
        y_: 0,
        downEvent_: false,
        upEvent_: false,
        active_: false,
    });

    const handleDown = (pointer: Pointer, x: number, y: number) => {
        pointer.x_ = x;
        pointer.y_ = y;
        pointer.startX_ = x;
        pointer.startY_ = y;
        pointer.downEvent_ = true;
        pointer.active_ = true;
        // console.info("-down:", pointer.id_);
    }

    const handleMove = (pointer: Pointer, x: number, y: number) => {
        pointer.x_ = x;
        pointer.y_ = y;
        // console.info("-move:", pointer.id_);
    }

    const handleUp = (p: Pointer) => {
        p.upEvent_ = p.active_;
        p.active_ = false;
        // console.info("-up:", pointer.id_);
    }

    const _handleMouse = (e: MouseEvent, fn: (pointer: Pointer, x: number, y: number) => void, _bb: DOMRect = c.getBoundingClientRect()) => {
        fn(mousePointer,
            ((e.clientX - _bb.x) * devicePixelRatio) | 0,
            ((e.clientY - _bb.y) * devicePixelRatio) | 0);
    };

    const _handleTouch = (e: TouchEvent, fn: (pointer: Pointer, x: number, y: number) => void, _bb: DOMRect = c.getBoundingClientRect(), _touch?: Touch) => {
        e.preventDefault();
        for (_touch of e.changedTouches) {
            fn(getPointer(_touch.identifier),
                ((_touch.clientX - _bb.x) * devicePixelRatio) | 0,
                ((_touch.clientY - _bb.y) * devicePixelRatio) | 0);
        }
    };

// INIT INPUT
    mousePointer = newPointer(0);

    oncontextmenu = e => e.preventDefault();

    /*document.*/
    onkeydown = (e: KeyboardEvent, _kode = e.which) => {
        unlockAudio();
        if (!keyboardState[_kode] && !e.repeat) {
            keyboardDown[_kode] = keyboardState[_kode] = 1;
        }
    };
    /*document.*/
    onkeyup = (e: KeyboardEvent, _kode = e.which) => {
        e.preventDefault();
        keyboardUp[_kode] = keyboardState[_kode];
        keyboardState[_kode] = 0;
    };

    c.onmousedown = (e) => {
        _handleMouse(e, handleDown);
        // console.info("onmousedown");
    };

    c.onmouseup = (e) => {
        unlockAudio();
        handleUp(mousePointer);
        // console.info("onmouseup");
    };

    c.onmouseleave = (e) => {
        handleUp(mousePointer);
        // console.info("onmouseleave");
    };

    c.onmouseenter = (e) => {
        if (e.buttons) {
            _handleMouse(e, handleDown);
        }
        // console.info("onmouseenter");
    };

    c.onmousemove = (e) => {
        _handleMouse(e, handleMove);
        // console.info("onmousemove");
    };

    c.ontouchstart = (e: TouchEvent) => {
        _handleTouch(e, handleDown);
        // console.info("ontouchstart");
    };
    c.ontouchmove = (e: TouchEvent) => {
        _handleTouch(e, handleMove);
        // console.info("ontouchmove");
    };
    c.ontouchend = (e: TouchEvent, _touch?: Touch) => {
        unlockAudio();
        e.preventDefault();
        for (_touch of e.changedTouches) {
            handleUp(getPointer(_touch.identifier));
        }
        // console.info("ontouchend");
    };
}

const resetPointer = (p: Pointer) =>
    p.downEvent_ = p.upEvent_ = false;

export const updateInput = () => {
    keyboardDown.length = 0;
    keyboardUp.length = 0;
    resetPointer(mousePointer);
    inputPointers.forEach(resetPointer);
}

export const isAnyKeyDown = () =>
    keyboardDown.length ||
    mousePointer.upEvent_ ||
    [...inputPointers.values()].some(x => x.upEvent_);