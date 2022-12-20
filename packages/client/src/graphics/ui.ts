import {drawText, drawTextShadowCenter, fnt} from "./font";
import {inputPointers, mousePointer, Pointer} from "../utils/input";
import {Img, img} from "../assets/gfx";
import {draw, setDrawZ} from "./draw2d";

let y = 8;
export const resetPrinter = () => {
    y = 8;
}
export const termPrint = (text: string, size = 7) => {
    drawText(fnt[0], text, size, 2, y, size, 1);
    y += size + 1;
}

// https://sol.gfxile.net/imgui/ch03.html

let hotItem = "";
let activeItem = "!";
let pointerScale = 1;
let pointer: Pointer | null = mousePointer;

interface OpaqueQuad {
    x: number;
    y: number;
    w: number;
    h: number;
    color: number;
}

interface TextOp {
    x: number;
    y: number;
    size: number;
    text: string;
}

const opaqueQuads: OpaqueQuad[] = [];
const textOps: TextOp[] = [];

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
    setDrawZ(1000);
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

export const label = (text: string, size: number, x: number, y: number) => {
    textOps.push({x, y, size, text,});
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
        opaqueQuads.push({
            x: x + offset,
            y: y + offset,
            w,
            h,
            color
        });
        opaqueQuads.push({
            x: x + 2,
            y: y + 2,
            w,
            h,
            color: 0
        });
        // draw(img[Img.box_lt], x + 2, y + 2, 0, w, h, 1, 0);
        // draw(img[Img.box_lt], x + offset, y + offset, 0, w, h, 1, color);
        textOps.push({
            x: x + w / 2 + offset,
            y: y + h / 1.5 + offset,
            size: 8,
            text,
        });
        // drawTextShadowCenter(fnt[0], text, 8, x + w / 2 + offset, y + h / 1.5 + offset);
    }
    // If button is hot and active, but mouse button is not
    // down, the user must have clicked the button.
    if (!pointer.active_ && hotItem === id && activeItem === id) {
        return 1;
    }

    return 0;
}

export function ui_renderOpaque() {
    for (const q of opaqueQuads) {
        draw(img[Img.box_lt], q.x, q.y, 0, q.w, q.h, 1, q.color);
    }
}

export function ui_renderNormal() {
    for (const t of textOps) {
        drawTextShadowCenter(fnt[0], t.text, t.size, t.x, t.y);
    }
}

export function ui_renderComplete() {
    opaqueQuads.length = 0;
    textOps.length = 0;
}

