import {gl} from "../graphics/gl";
import {getPointer, inputPointers, keyboardState, Pointer} from "../utils/input";
import {camera, draw} from "../graphics/draw2d";
import {Actor} from "./types";
import {img_box, img_cirle} from "./res";

export const enum ControlsFlag {
    Move = 0x100,
    Run = 0x200,
    Jump = 0x400,
    Shooting = 0x800,
    Drop = 0x1000,
}

export let lookAtX = 0;
export let lookAtY = 0;
export let viewX = 0;
export let viewY = 0;
export let shootButtonDown = 0;
export let jumpButtonDown = 0;
export let moveX = 0;
export let moveY = 0;
export let moveFast = 0;
export let dropButton = 0;

export function updateControls(player: Actor) {
    const W = gl.drawingBufferWidth;
    const H = gl.drawingBufferHeight;

    const mouse = getPointer(-1);

    const px = player.x;
    const py = player.y - player.z - 10;

    if (mouse.x_ >= 0 && mouse.x_ < W && mouse.y_ >= 0 && mouse.y_ < H) {
        lookAtX = (mouse.x_ - W * camera.toX) / camera.scale + camera.atX;
        lookAtY = (mouse.y_ - H * camera.toY) / camera.scale + camera.atY;
        viewX = lookAtX - px;
        viewY = lookAtY - py;
    }

    shootButtonDown = ((viewX || viewY) && mouse.active_) as any | 0;

    moveX = ((keyboardState["KeyD"] || keyboardState["ArrowRight"]) | 0)
        - ((keyboardState["KeyA"] || keyboardState["ArrowLeft"]) | 0);
    moveY = ((keyboardState["KeyS"] || keyboardState["ArrowDown"]) | 0)
        - ((keyboardState["KeyW"] || keyboardState["ArrowUp"]) | 0);

    if (moveX || moveY) {
        moveFast = (!(keyboardState["ShiftLeft"] || keyboardState["ShiftRight"])) as any | 0;
    }

    jumpButtonDown = keyboardState["Space"] | 0;
    dropButton = keyboardState["KeyE"] | 0;


    {
        updateVirtualPad();
        const k = 1.0 / camera.scale;
        if (touchPadActive) {
            {
                let dx = 0;
                let dy = 0;
                if (vpadL) {
                    dx = (vpadL.x_ - vpadL.startX_) * k;
                    dy = (vpadL.y_ - vpadL.startY_) * k;
                }
                const len = Math.hypot(dx, dy);
                moveX = dx;
                moveY = dy;
                moveFast = (len > 16) as any | 0;
                jumpButtonDown = (len > 32) as any | 0;
            }
            {
                let dx = 0;
                let dy = 0;
                if (vpadR) {
                    dx = (vpadR.x_ - vpadR.startX_) * k;
                    dy = (vpadR.y_ - vpadR.startY_) * k;
                }
                const len = Math.hypot(dx, dy);
                viewX = dx;
                viewY = dy;
                lookAtX = px + dx * 3;
                lookAtY = py + dy * 3;
                shootButtonDown = (len > 24) as any | 0;
            }
            dropButton = topR ? 1 : 0;
        }
    }
}

let topR: Pointer | undefined;
let vpadL: Pointer | undefined;
let vpadR: Pointer | undefined;
let touchPadActive = false;

function updateVirtualPad() {
    const W = gl.drawingBufferWidth;
    const H = gl.drawingBufferHeight;

    // if not captured
    if (!vpadL) {
        // capture
        for (const p of inputPointers) {
            if (p.id_ >= 0 && p.down_ && p.x_ < W / 2 && p.y_ > H / 2) {
                vpadL = p;
            }
        }
    }

    // if captured
    if (vpadL) {
        if (!vpadL.active_) {
            // release
            vpadL = undefined;
        }
    }

    // if not captured
    if (!vpadR) {
        // capture
        for (const p of inputPointers) {
            if (p.id_ >= 0 && p.down_ && p.x_ > W / 2 && p.y_ > H / 2) {
                vpadR = p;
            }
        }
    }

    // if captured
    if (vpadR) {
        if (!vpadR.active_) {
            // release
            vpadR = undefined;
        }
    }

    if(!topR) {
        for (const p of inputPointers) {
            if (p.id_ >= 0 && p.down_ && p.x_ > W / 2 && p.y_ < H / 2) {
                topR = p;
            }
        }
    }
    // if captured
    if (topR) {
        if (!topR.active_) {
            // release
            topR = undefined;
        }
    }
    touchPadActive = touchPadActive || !!vpadL || !!vpadR || !!topR;
}

export function drawVirtualPad() {
    if (!touchPadActive) {
        return;
    }
    const k = 1.0 / camera.scale;
    const W = gl.drawingBufferWidth * k;
    const H = gl.drawingBufferHeight * k;
    {
        const cx = W / 4;
        const cy = H * 3 / 4;
        draw(img_cirle, cx, cy, 0, 10, 10, 0x22000000);
        if (vpadL) {
            draw(img_box, vpadL.startX_ * k, vpadL.startY_ * k, 0, 32, 32, 0x77FFFFFF);
            draw(img_box, vpadL.startX_ * k, vpadL.startY_ * k, 0, 64, 64, 0x77FFFFFF);
            draw(img_cirle, vpadL.x_ * k, vpadL.y_ * k, 0, 1, 1, 0xFFFFFFFF);
        }
    }

    {
        const cx = W * 3 / 4;
        const cy = H * 3 / 4;
        draw(img_cirle, cx, cy, 0, 10, 10, 0x22000000);
        if (vpadR) {
            draw(img_box, vpadR.startX_ * k, vpadR.startY_ * k, 0, 32, 32, 0x77FFFFFF);
            draw(img_box, vpadR.startX_ * k, vpadR.startY_ * k, 0, 64, 64, 0x77FFFFFF);
            draw(img_cirle, vpadR.x_ * k, vpadR.y_ * k, 0, 1, 1, 0xFFFFFFFF);
        }
    }


    {
        const cx = W * 3 / 4;
        const cy = H * 1 / 4;
        draw(img_box, cx, cy, 0, W / 4, H / 4, topR ? 0x22FFFFFF : 0x22000000);
    }
}