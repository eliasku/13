export class Pointer {
    id = 0;
    startX = +0.0;
    startY = +0.0;
    prevX = +0.0;
    prevY = +0.0;
    x = +0.0;
    y = +0.0;
    down = false;
    active = false;
}

const pointers:Pointer[] = [];
export const inputPointers = pointers;

function getPointer(id: number): Pointer {
    for (let i = 0; i < pointers.length; ++i) {
        if (pointers[i].id === id) {
            return pointers[i];
        }
    }
    const pointer = new Pointer();
    pointer.id = id;
    pointers.push(pointer);
    return pointer;
}

function handleDown(pointer: Pointer, x: number, y: number) {
    pointer.x = x;
    pointer.y = y;
    pointer.prevX = x;
    pointer.prevY = y;
    pointer.startX = x;
    pointer.startY = y;
    pointer.down = true;
    pointer.active = true;
}

function handleMove(pointer: Pointer, x: number, y: number) {
    pointer.prevX = pointer.x;
    pointer.prevY = pointer.y;
    pointer.x = x;
    pointer.y = y;
}

function handleUp(pointer: Pointer) {
    pointer.down = false;
    pointer.active = false;
}

export function initInput(canvas:HTMLCanvasElement) {
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
        if(e.buttons) {
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
