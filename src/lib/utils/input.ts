import {audioContext} from "../audio/context";

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

export let mousePointer: Pointer;
export const inputPointers = new Map<number, Pointer>();
export const keyboardState: Set<string> = new Set();
export const keyboardDown: Set<string> = new Set();
export const keyboardUp: Set<string> = new Set();

// LOCAL SCOPE
{
    const getPointer = (id: number): Pointer => {
        if (!inputPointers.has(id)) {
            inputPointers.set(id, newPointer(id));
        }
        return inputPointers.get(id);
    }

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
        p.upEvent_ = true;
        p.active_ = false;
        // console.info("-up:", pointer.id_);
    }

    const _handleMouse = (e: MouseEvent, fn: (pointer: Pointer, x: number, y: number) => void, _bb: DOMRect = c.getBoundingClientRect()) => {
        fn(mousePointer,
            ((e.clientX - _bb.x) * devicePixelRatio) | 0,
            ((e.clientY - _bb.y) * devicePixelRatio) | 0);
    };

    const _handleTouch = (e: TouchEvent, fn: (pointer: Pointer, x: number, y: number) => void, _bb: DOMRect = c.getBoundingClientRect()) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; ++i) {
            const touch = e.changedTouches[i];
            fn(getPointer(touch.identifier),
                ((touch.clientX - _bb.x) * devicePixelRatio) | 0,
                ((touch.clientY - _bb.y) * devicePixelRatio) | 0);
        }
    };

// INIT INPUT
    mousePointer = newPointer(0);

    oncontextmenu = e => e.preventDefault();

    /*document.*/
    onkeydown = (e: KeyboardEvent) => {
        // e.preventDefault();
        if (!keyboardState.has(e.code) && !e.repeat) {
            keyboardDown.add(e.code);
            keyboardState.add(e.code);
        }
        unlockAudio();
    };
    /*document.*/
    onkeyup = (e: KeyboardEvent) => {
        e.preventDefault();
        if (keyboardState.delete(e.code)) {
            keyboardUp.add(e.code);
        }
    };

    c.onmousedown = (e) => {
        _handleMouse(e, handleDown);
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
        unlockAudio();
        // console.info("ontouchstart");
    };
    c.ontouchmove = (e: TouchEvent) => {
        _handleTouch(e, handleMove);
        // console.info("ontouchmove");
    };
    c.ontouchend = (e: TouchEvent) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; ++i) {
            handleUp(getPointer(e.changedTouches[i].identifier));
        }
        // console.info("ontouchend");
    };
}
// })();

const resetPointer = (p: Pointer) => {
    p.downEvent_ = false;
    p.upEvent_ = false;
};

export const updateInput = () => {
    keyboardDown.clear();
    keyboardUp.clear();
    resetPointer(mousePointer);
    inputPointers.forEach(resetPointer);
}

export const isAnyKeyDown = () =>
    mousePointer.downEvent_ ||
    keyboardDown.size ||
    [...inputPointers.values()].some(x => x.downEvent_);