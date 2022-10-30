import {drawText, fnt} from "./font";
import {inputPointers, mousePointer, Pointer} from "../utils/input";
import {Img, img} from "../assets/gfx";
import {draw} from "./draw2d";

let y = 15;
export const resetPrinter = () => {
    y = 15;
}
export const termPrint = (text: string) => {
    drawText(fnt[0], text, 7, 2, y, 7, 1);
    y += 8;
}

// https://sol.gfxile.net/imgui/ch03.html

let hotItem = "";
let activeItem = "!";
let pointerScale = 1;
let pointer: Pointer | null = mousePointer;

const captureInputPointer = () => {
    pointer = mousePointer;
    for (const [, touchPointer] of inputPointers) {
        if (touchPointer.active_ || touchPointer.upEvent_) {
            pointer = touchPointer;
            break;
        }
    }
}

export const ui_begin = (scale: number) => {
    captureInputPointer();
    pointerScale = scale;
    hotItem = "";
}

export const ui_finish = () => {
    if (!pointer.active_) {
        activeItem = "";
    } else {
        if (!activeItem) {
            activeItem = "!";
        }
    }
}

export const label = (text: string, x: number, y: number) => {
    drawText(fnt[0], text, 7, x, y, 7, 1);
}

// Check whether current mouse position is within a rectangle
const isRegionHit = (x: number, y: number, w: number, h: number): number => {
    const px = pointer.x_ / pointerScale;
    const py = pointer.y_ / pointerScale;
    if (px < x ||
        py < y ||
        px >= x + w ||
        py >= y + h) {
        return 0;
    }
    return 1;
}

export const button = (id: string, text: string, x: number, y: number, config?: { w?: number, h?: number, visible?: boolean }): number => {
    const w = config?.w ?? 64;
    const h = config?.h ?? 16;
    const visible = config?.visible ?? true;
    if (isRegionHit(x, y, w, h)) {
        hotItem = id;
        if (!activeItem && pointer.active_) {
            activeItem = id;
        }
    }
    if (visible) {
        let offset = 0;
        let color = 0xFFFFFF;

        if (hotItem === id) {
            if (activeItem === id) {
                // Button is both 'hot' and 'active'
                offset = 1;
            } else {
                // Button is merely 'hot'
                offset = 0;
            }
        } else {
            // button is not hot, but it may be active
            color = 0xAAAAAA;
        }
        draw(img[Img.box_lt], x + 2, y + 2, 0, w, h, 1, 0);
        draw(img[Img.box_lt], x + offset, y + offset, 0, w, h, 1, color);

        drawText(fnt[0], text, 8, x + 4 + offset, y + h / 1.5 + offset, 8, 1);
    }
    // If button is hot and active, but mouse button is not
    // down, the user must have clicked the button.
    if (!pointer.active_ && hotItem === id && activeItem === id) {
        return 1;
    }

    return 0;
}