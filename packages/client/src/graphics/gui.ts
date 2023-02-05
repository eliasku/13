import {drawText, drawTextAligned, fnt} from "./font.js";
import {inputPointers, mousePointer, Pointer} from "../utils/input.js";
import {img} from "../assets/gfx.js";
import {draw, gl, setDrawZ} from "./draw2d.js";
import {getScreenScale} from "../game/gameState.js";
import {clamp} from "../utils/math.js";
import {Img} from "../assets/img.js";

let y = 8;
export const resetPrinter = () => {
    y = 8;
};
export const termPrint = (text: string, size = 7) => {
    drawText(fnt[0], text, size, 2, y, size, 1);
    y += size + 1;
};

// https://sol.gfxile.net/imgui/ch03.html

let hotItem = "";
let activeItem = "!";
let pointer: Pointer | null = mousePointer;

interface OpaqueQuad {
    _x: number;
    _y: number;
    _w: number;
    _h: number;
    _color: number;
}

interface TextOp {
    _x: number;
    _y: number;
    _size: number;
    _text: string;
    _alignX?: number;
}

export const uiState = {
    _scale: 1,
    _width: 1,
    _height: 1,
    _opaqueQuads: [] as OpaqueQuad[],
    _textOps: [] as TextOp[],
};

const captureInputPointer = () => {
    pointer = mousePointer;
    for (const [, touchPointer] of inputPointers) {
        if (touchPointer._active || touchPointer._upEvent) {
            pointer = touchPointer;
            break;
        }
    }
};

export const ui_begin = () => {
    captureInputPointer();
    hotItem = "";
    setDrawZ(1000);
    uiState._scale = getScreenScale();
    uiState._width = (gl.drawingBufferWidth / uiState._scale) | 0;
    uiState._height = (gl.drawingBufferHeight / uiState._scale) | 0;
};

export const ui_finish = () => {
    if (!pointer._active) {
        activeItem = "";
    } else {
        if (!activeItem) {
            activeItem = "!";
        }
    }
};

export const label = (text: string, size: number, x: number, y: number, alignX = 0.5) => {
    uiState._textOps.push({_x: x, _y: y, _size: size, _text: text, _alignX: alignX});
};

// Check whether current mouse position is within a rectangle
const isRegionHit = (x: number, y: number, w: number, h: number): number => {
    const px = pointer._x / uiState._scale;
    const py = pointer._y / uiState._scale;
    if (px < x || py < y || px >= x + w || py >= y + h) {
        return 0;
    }
    return 1;
};

const getRegionPointerX = (x: number, w: number): number => {
    const px = pointer._x / uiState._scale;
    return (px - x) / w;
};

export const button = (
    id: string,
    text: string,
    x: number,
    y: number,
    config?: {w?: number; h?: number; visible?: boolean},
): number => {
    const w = config?.w ?? 64;
    const h = config?.h ?? 16;
    const visible = config?.visible ?? true;
    if (isRegionHit(x, y, w, h)) {
        hotItem = id;
        if (!activeItem && pointer._active) {
            activeItem = id;
        }
    }
    if (visible) {
        let offset = 0;
        let color = 0xffffff;

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
            color = 0xaaaaaa;
        }
        uiState._opaqueQuads.push(
            {
                _x: x + offset,
                _y: y + offset,
                _w: w,
                _h: h,
                _color: color,
            },
            {
                _x: x + 2,
                _y: y + 2,
                _w: w,
                _h: h,
                _color: 0,
            },
        );
        uiState._textOps.push({
            _x: x + w / 2 + offset,
            _y: y + h / 1.5 + offset,
            _size: 8,
            _text: text,
        });
    }
    // If button is hot and active, but mouse button is not
    // down, the user must have clicked the button.
    if (!pointer._active && hotItem === id && activeItem === id) {
        return 1;
    }

    return 0;
};

export function uiProgressBar(
    id: string,
    current: number,
    total: number,
    x: number,
    y: number,
    w: number,
    h: number,
): undefined | number {
    if (isRegionHit(x, y, w, h)) {
        hotItem = id;
        if (!activeItem && pointer._active) {
            activeItem = id;
        }
    }
    const progress = current / total;
    uiState._opaqueQuads.push(
        {
            _x: x,
            _y: y,
            _w: w * progress,
            _h: h,
            _color: 0xcccccc,
        },
        {
            _x: x + w * progress,
            _y: y,
            _w: w * (1 - progress),
            _h: h,
            _color: 0x333333,
        },
    );

    let r = getRegionPointerX(x, w);
    r = clamp(r, 0, 1);
    r = Math.round(r * total) / total;

    if (!pointer._active && hotItem === id && activeItem === id) {
        return r;
    }

    if (hotItem === id) {
        if (activeItem === id) {
            // Button is both 'hot' and 'active'
        } else {
            // Button is merely 'hot'
        }
        uiState._opaqueQuads.push({
            _x: x,
            _y: y - 1,
            _w: w * r,
            _h: 2,
            _color: 0xffffff,
        });
        return -r - 1;
    } else {
        // button is not hot, but it may be active
    }
}

export function ui_renderOpaque() {
    for (const q of uiState._opaqueQuads) {
        draw(img[Img.box_lt], q._x, q._y, 0, q._w, q._h, 1, q._color);
    }
}

export function ui_renderNormal() {
    for (const t of uiState._textOps) {
        drawTextAligned(fnt[0], t._text, t._size, t._x, t._y, 0xffffff, t._alignX);
    }
}

export function ui_renderComplete() {
    uiState._opaqueQuads.length = 0;
    uiState._textOps.length = 0;
}
