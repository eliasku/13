import {audioContext} from "../audio/context.js";
import {getOrCreate} from "./utils.js";
import {getDPR} from "../graphics/draw2d.js";

export interface Pointer {
    _id: number;
    _startX: number;
    _startY: number;
    _x: number;
    _y: number;
    _downEvent: boolean;
    _upEvent: boolean;
    _active: boolean;
}

export const KeyCode = {
    Escape: 27,
    Space: 32,
    A: 65,
    S: 83,
    W: 87,
    D: 68,
    Right: 39,
    Left: 37,
    Up: 38,
    Down: 40,
    Shift: 16,
    E: 69,
    R: 82,
    Q: 81,

    Digit0: 48,
    Digit1: 49,
    Digit2: 50,
    Digit3: 51,
    Digit4: 52,
    Digit5: 53,
    Digit6: 54,
    Digit7: 55,
    Digit8: 56,
    Digit9: 57,
} as const;
export type KeyCode = (typeof KeyCode)[keyof typeof KeyCode];

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
    };

    /* @__PURE__ */
    const newPointer = (id_: number): Pointer => ({
        _id: id_,
        _startX: 0,
        _startY: 0,
        _x: 0,
        _y: 0,
        _downEvent: false,
        _upEvent: false,
        _active: false,
    });

    const handleDown = (pointer: Pointer, x: number, y: number) => {
        pointer._x = x;
        pointer._y = y;
        pointer._startX = x;
        pointer._startY = y;
        pointer._downEvent = true;
        pointer._active = true;
        // console.info("-down:", pointer.id_);
    };

    const handleMove = (pointer: Pointer, x: number, y: number) => {
        pointer._x = x;
        pointer._y = y;
        // console.info("-move:", pointer.id_);
    };

    const handleUp = (p: Pointer) => {
        p._upEvent = p._active;
        p._active = false;
        // console.info("-up:", pointer.id_);
    };

    const _handleMouse = (
        e: MouseEvent,
        fn: (pointer: Pointer, x: number, y: number) => void,
        _bb: DOMRect = c.getBoundingClientRect(),
    ) => {
        fn(mousePointer, ((e.clientX - _bb.x) * getDPR()) | 0, ((e.clientY - _bb.y) * getDPR()) | 0);
    };

    const _handleTouch = (
        e: TouchEvent,
        fn: (pointer: Pointer, x: number, y: number) => void,
        _bb: DOMRect = c.getBoundingClientRect(),
        _touch?: Touch,
    ) => {
        e.preventDefault();
        for (_touch of e.changedTouches) {
            fn(
                getPointer(_touch.identifier),
                ((_touch.clientX - _bb.x) * getDPR()) | 0,
                ((_touch.clientY - _bb.y) * getDPR()) | 0,
            );
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
        // iframe parent received game key events #220
        return false;
    };
    /*document.*/
    onkeyup = (e: KeyboardEvent, _kode = e.which) => {
        e.preventDefault();
        keyboardUp[_kode] = keyboardState[_kode];
        keyboardState[_kode] = 0;
    };

    c.onmousedown = e => {
        _handleMouse(e, handleDown);
        // console.info("onmousedown");
    };

    c.onmouseup = () => {
        unlockAudio();
        handleUp(mousePointer);
        // console.info("onmouseup");
    };

    c.onmouseleave = () => {
        handleUp(mousePointer);
        // console.info("onmouseleave");
    };

    c.onmouseenter = e => {
        if (e.buttons) {
            _handleMouse(e, handleDown);
        }
        // console.info("onmouseenter");
    };

    c.onmousemove = e => {
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

const resetPointer = (p: Pointer) => (p._downEvent = p._upEvent = false);

export const updateInput = () => {
    keyboardDown.length = 0;
    keyboardUp.length = 0;
    resetPointer(mousePointer);
    inputPointers.forEach(resetPointer);
};

export const isAnyKeyDown = () =>
    keyboardDown.length || mousePointer._upEvent || [...inputPointers.values()].some(x => x._upEvent);
