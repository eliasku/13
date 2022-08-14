export class Pointer {
    id_ = 0;
    startX_ = +0.0;
    startY_ = +0.0;
    prevX_ = +0.0;
    prevY_ = +0.0;
    x_ = +0.0;
    y_ = +0.0;
    down_ = false;
    active_ = false;
}

const pointers: Pointer[] = [];
export const inputPointers = pointers;

function getPointer(id: number): Pointer {
    for (let i = 0; i < pointers.length; ++i) {
        if (pointers[i].id_ === id) {
            return pointers[i];
        }
    }
    const pointer = new Pointer();
    pointer.id_ = id;
    pointers.push(pointer);
    return pointer;
}

function handleDown(pointer: Pointer, x: number, y: number) {
    pointer.x_ = x;
    pointer.y_ = y;
    pointer.prevX_ = x;
    pointer.prevY_ = y;
    pointer.startX_ = x;
    pointer.startY_ = y;
    pointer.down_ = true;
    pointer.active_ = true;
}

function handleMove(pointer: Pointer, x: number, y: number) {
    pointer.prevX_ = pointer.x_;
    pointer.prevY_ = pointer.y_;
    pointer.x_ = x;
    pointer.y_ = y;
}

function handleUp(pointer: Pointer) {
    pointer.down_ = false;
    pointer.active_ = false;
}

export function initInput(canvas: HTMLCanvasElement) {
    canvas.addEventListener("mousedown", (e) => {
        const scale = canvas.width / canvas.clientWidth;
        const bb = canvas.getBoundingClientRect();
        handleDown(getPointer(-1),
            ((e.clientX - bb.x) * scale) | 0,
            ((e.clientY - bb.y) * scale) | 0)
    });

    canvas.addEventListener("mouseup", (e) => {
        handleUp(getPointer(-1));
    });

    canvas.addEventListener("mouseleave", (e) => {
        handleUp(getPointer(-1));
    });

    canvas.addEventListener("mouseenter", (e) => {
        if (e.buttons) {
            const scale = canvas.width / canvas.clientWidth;
            const bb = canvas.getBoundingClientRect();
            handleDown(getPointer(-1),
                ((e.clientX - bb.x) * scale) | 0,
                ((e.clientY - bb.y) * scale) | 0)
        }
    });

    canvas.addEventListener("mousemove", (e) => {
        const scale = canvas.width / canvas.clientWidth;
        const bb = canvas.getBoundingClientRect();
        handleMove(getPointer(-1),
            ((e.clientX - bb.x) * scale) | 0,
            ((e.clientY - bb.y) * scale) | 0)
    });

    canvas.addEventListener("touchstart", (e) => {
        e.preventDefault();
        const scale = canvas.width / canvas.clientWidth;
        const bb = canvas.getBoundingClientRect();
        for (let i = 0; i < e.changedTouches.length; ++i) {
            const touch = e.changedTouches.item(i)!;
            handleDown(getPointer(touch.identifier),
                ((touch.clientX - bb.x) * scale) | 0,
                ((touch.clientY - bb.y) * scale) | 0);
        }
    });
    canvas.addEventListener("touchmove", (e) => {
        e.preventDefault();
        const scale = canvas.width / canvas.clientWidth;
        const bb = canvas.getBoundingClientRect();
        for (let i = 0; i < e.changedTouches.length; ++i) {
            const touch = e.changedTouches.item(i)!;
            handleMove(getPointer(touch.identifier),
                ((touch.clientX - bb.x) * scale) | 0,
                ((touch.clientY - bb.y) * scale) | 0);
        }
    }, false);
    canvas.addEventListener("touchend", (e) => {
        for (let i = 0; i < e.changedTouches.length; ++i) {
            const touch = e.changedTouches.item(i)!;
            handleUp(getPointer(touch.identifier));
        }
    });
    canvas.addEventListener("touchcancel", (e) => {
        for (let i = 0; i < e.changedTouches.length; ++i) {
            const touch = e.changedTouches.item(i)!;
            handleUp(getPointer(touch.identifier));
        }
    });
}
