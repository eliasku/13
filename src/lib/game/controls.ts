import {gl} from "../graphics/gl";
import {getPointer, keyboardState} from "../utils/input";
import {camera} from "../graphics/draw2d";
import {Actor} from "./types";

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
        moveFast = (!(keyboardState["ShiftLeft"] || keyboardState["ShiftRight"])) as any |0;
    }

    jumpButtonDown = keyboardState["Space"] | 0;
    dropButton = keyboardState["KeyE"] | 0;
}