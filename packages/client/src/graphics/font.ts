import {createTexture, draw, getSubTexture, Texture, uploadTexture} from "./draw2d.js";
import {GL} from "./gl.js";

const SPACE_CODE = " ".codePointAt(0);
const DEFAULT_CHARACTERS = `abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890.,'-/`
    .split("")
    .map(c => c.codePointAt(0));

const createCanvas_ = (size: number): CanvasRenderingContext2D => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;

    // canvas.style.position = "absolute";
    // canvas.style.top = "0px";
    // canvas.style.left = "0px";
    // document.body.appendChild(canvas);

    return canvas.getContext("2d", {
        willReadFrequently: c != null /* hack to enforce `true` against terser optimization */,
    });
};

const gctx = createCanvas_(128);

export interface CharacterData {
    // advance width
    _a: number;
    // bounding rect
    _x: number;
    _y: number;
    _w: number;
    _h: number;
    // uv
    _texture?: Texture;
}

const CHAR_BOUNDING_BOX = {
    _supported: 0,
    _left: 0,
    _right: 0,
    _ascent: 0,
    _descent: 0,
};

export interface FontStyleDef {
    _strokeWidth?: number;
    _strokeColor?: {r: number; g: number; b: number; a: number};
}

export interface FontAtlas {
    _family: string;
    _size: number;
    _scale: number;
    _style: FontStyleDef;
    _fallback: string;
    _ctx: CanvasRenderingContext2D;
    _texture: Texture;
    _textureBoxT1: Texture;
    _textureBoxLT: Texture;
    _textureBox: Texture;
    _nextSheetX: number;
    _nextSheetY: number;
    _sheetLineHeight: number;
    _characters: number[];

    // in pixels, resolution independent
    _border: number;

    _characterMap: Map<number, CharacterData>;
    // relative to EM units
    _lineSize: number;

    _dirty: boolean;

    _strokeWidth: number;
    _strokeColor: string;
}

export const makeFontAtlas = (family: string, size: number, scale: number, style: FontStyleDef): FontAtlas => {
    const canvasSize = 512;
    const ctx = createCanvas_(canvasSize);
    const fallback =
        '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif';
    const texture = createTexture(canvasSize);
    const fa: FontAtlas = {
        _fallback: fallback,
        _style: style,
        _size: size,
        _scale: scale,
        _family: family,
        _ctx: ctx,
        _texture: texture,
        _textureBoxLT: getSubTexture(texture, 1, 1, 1, 1, 0, 0),
        _textureBox: getSubTexture(texture, 1, 1, 1, 1, 0.5, 0.5),
        _textureBoxT1: getSubTexture(texture, 1, 1, 1, 1, 0.5, -1),
        _nextSheetX: 0,
        _nextSheetY: 0,
        _sheetLineHeight: 0,
        _characters: [],
        _border: Math.ceil(scale),
        _characterMap: new Map<number, CharacterData>(),
        _lineSize: 1.3,

        _dirty: true,

        _strokeWidth: style._strokeWidth ?? 0,
        _strokeColor: style._strokeColor
            ? `rgba(${style._strokeColor.r},${style._strokeColor.g},${style._strokeColor.b},${style._strokeColor.a})`
            : "rgba(0,0,0,0.5)",
    };
    resetFontAtlas(fa);
    return fa;
};

const enlargeFontTexture = (fa: FontAtlas) => {
    const c = fa._ctx.canvas;
    const size = c.width << 1;
    fa._texture._w = fa._texture._h = c.width = c.height = size;
    fa._textureBoxLT = getSubTexture(fa._texture, 1, 1, 1, 1, 0, 0);
    fa._textureBox = getSubTexture(fa._texture, 1, 1, 1, 1, 0.5, 0.5);
    fa._textureBoxT1 = getSubTexture(fa._texture, 1, 1, 1, 1, 0.5, -1);
    resetFontAtlas(fa, fa._characters);
};

const setupFontRenderingContext = (context: CanvasRenderingContext2D, fa: FontAtlas) => {
    const fontSize = Math.ceil(fa._size * fa._scale);
    // setup context
    // "Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol"
    context.font = `${fontSize}px ${fa._family},${fa._fallback}`;
    context.fillStyle = "#fff";
    context.textBaseline = "alphabetic";
    context.textAlign = "left";
};

const resetFontCanvas = (fa: FontAtlas) => setupFontRenderingContext(fa._ctx, fa);

const resetFontAtlas = (fa: FontAtlas, characters = DEFAULT_CHARACTERS) => {
    fa._ctx.clearRect(0, 0, fa._ctx.canvas.width, fa._ctx.canvas.height);
    fa._ctx.fillStyle = "#FFF";
    fa._ctx.fillRect(0, 0, 3, 3);
    //fa.ctx.fillRect(0, 0, fa.ctx.canvas.width, fa.ctx.canvas.height);
    resetFontCanvas(fa);
    fa._nextSheetX = 4;
    fa._nextSheetY = 0;
    fa._characterMap.clear();
    addSpaceCharacter(fa);
    fa._characters = [];
    // TODO: revert
    // addChars(fa, characters);
    updateTexture(fa);
};

const addSpaceCharacter = (fa: FontAtlas) => {
    const spaceWidth = fa._ctx.measureText(" ").width / fa._scale;
    fa._characterMap.set(SPACE_CODE, {
        _a: spaceWidth,
        _x: 0,
        _y: 0,
        _w: spaceWidth,
        _h: fa._size * fa._lineSize,
        _texture: getSubTexture(fa._texture, 0, 0, 0, 0, 0, 0),
    });
};

const addChars = (fa: FontAtlas, codePoints: number[]) => {
    for (const codePoint of codePoints) {
        getCharacter(fa, codePoint);
    }
};

const readMetrics = (fa: FontAtlas, metrics: TextMetrics) => {
    const bb = CHAR_BOUNDING_BOX;
    if (bb._supported === 0) {
        bb._supported =
            "actualBoundingBoxLeft" in metrics &&
            "actualBoundingBoxRight" in metrics &&
            "actualBoundingBoxAscent" in metrics &&
            "actualBoundingBoxDescent" in metrics
                ? 2
                : 1;
    }
    if (bb._supported === 2) {
        bb._left = metrics.actualBoundingBoxLeft;
        bb._right = metrics.actualBoundingBoxRight;
        bb._ascent = metrics.actualBoundingBoxAscent;
        bb._descent = metrics.actualBoundingBoxDescent;
    } else {
        const size = fa._size * fa._scale;
        bb._left = 0;
        bb._right = metrics.width;
        bb._ascent = Math.ceil(0.7 * size);
        bb._descent = Math.ceil(0.3 * size);
    }
    return bb;
};

const getCharacter = (fa: FontAtlas, codepoint: number): CharacterData => {
    if (fa._characterMap.has(codepoint)) {
        return fa._characterMap.get(codepoint);
    }

    const character = String.fromCodePoint(codepoint);
    const ctx = fa._ctx;
    const canvas = ctx.canvas;
    const invScale = 1 / fa._scale;
    const metrics = ctx.measureText(character);
    const bb = readMetrics(fa, metrics);
    const padding = (fa._border + 2 * fa._strokeWidth * fa._scale) | 0;
    const w = bb._right + bb._left + 2 * padding;
    const h = bb._descent + bb._ascent + 2 * padding;
    let x = fa._nextSheetX;
    let y = fa._nextSheetY;
    if (x + w > canvas.width) {
        x = 0;
        y += fa._sheetLineHeight;
        fa._sheetLineHeight = 0;
        if (y + h > canvas.height) {
            enlargeFontTexture(fa);
            return getCharacter(fa, codepoint);
        }
    }

    if (h > fa._sheetLineHeight) {
        fa._sheetLineHeight = h;
    }

    const data: CharacterData = {
        _a: metrics.width * invScale,
        _x: -(bb._left + padding) * invScale,
        _y: -(bb._ascent + padding) * invScale,
        _w: w * invScale,
        _h: h * invScale,
        _texture: getSubTexture(fa._texture, x, y, w, h, 0, 0),
    };

    fa._characterMap.set(codepoint, data);
    fa._characters.push(codepoint);
    const ox = bb._left + padding;
    const oy = bb._ascent + padding;

    {
        gctx.canvas.width = w;
        gctx.canvas.height = h;
        setupFontRenderingContext(gctx, fa);

        gctx.shadowOffsetX = 0;
        gctx.shadowOffsetY = 0;
        gctx.shadowBlur = 4;
        gctx.shadowColor = "#000";
        gctx.fillStyle = "#000";
        gctx.fillText(character, ox, oy);
        {
            const imageData = gctx.getImageData(0, 0, w, h);
            const imagePixels = imageData.data;
            for (let i = 0; i < imagePixels.length; ) {
                imagePixels[i++] = 0;
                imagePixels[i++] = 0;
                imagePixels[i++] = 0;
                const a = imagePixels[i] * 16;
                imagePixels[i++] = a > 0xff ? 0xff : a | 0;
            }
            gctx.putImageData(imageData, 0, 0);
        }
        gctx.shadowOffsetX = 0;
        gctx.shadowOffsetY = 0;
        gctx.shadowBlur = 0;
        gctx.shadowColor = "transparent";

        gctx.globalAlpha = 0.5;
        gctx.drawImage(gctx.canvas, 0, 4);

        gctx.globalAlpha = 1;
        gctx.fillStyle = "#fff";
        gctx.fillText(character, ox, oy);

        ctx.putImageData(gctx.getImageData(0, 0, w, h), x, y);
    }
    // if (DEBUG_SHOW_BOUNDS) {
    // ctx.lineWidth = 1;
    // ctx.strokeStyle = 'rgb(255,0,0)';
    // ctx.strokeRect(x, y + padding, w / 2, bb.ascent);
    // ctx.strokeStyle = 'rgb(0,255,0)';
    // ctx.strokeRect(x + w / 2, y + padding + bb.ascent, w / 2, bb.descent);
    // }
    x += w;
    fa._nextSheetX = x;
    fa._nextSheetY = y;
    fa._dirty = true;

    return data;
};

const updateTexture = (fa: FontAtlas) => {
    if (fa._dirty) {
        uploadTexture(fa._texture, fa._ctx.canvas, GL.LINEAR);
        fa._dirty = false;
    }
};

/// resources
export const fnt: FontAtlas[] = [];

export const initFonts = () => {
    fnt[0] = makeFontAtlas(`m,e,fa-brands-400`, 64, 1, {_strokeWidth: 4});
};

export const updateFonts = () => fnt.forEach(updateTexture);

export const resetFonts = () => fnt.forEach(fa => resetFontAtlas(fa));

/// drawing

const LF = "\n".codePointAt(0);
export const drawText = (
    font: FontAtlas,
    text: string,
    size: number,
    x: number,
    y: number,
    lineHeight: number,
    lineSpacing: number,
    color = 0xffffff,
    alpha = 1,
) => {
    const sc = size / font._size;
    const startX = x;
    let cx = x;
    let cy = y;
    for (const ch of text) {
        const code = ch.codePointAt(0);
        if (code === LF) {
            cx = startX;
            cy += lineHeight + lineSpacing;
            continue;
        }

        const gdata = getCharacter(font, code);
        if (gdata._texture) {
            draw(gdata._texture, cx + sc * gdata._x, cy + sc * gdata._y, 0, sc, sc, alpha, color);
        }
        cx += sc * gdata._a; // advance
    }
};

export const measureTextWidth = (font: FontAtlas, text: string, size: number): number => {
    const sc = size / font._size;
    let x = 0;
    let w = 0;
    for (const ch of text) {
        const code = ch.codePointAt(0);
        if (code === LF) {
            x = 0;
            continue;
        }
        const gdata = getCharacter(font, code);
        x += sc * gdata._a;
        if (x > w) {
            w = x;
        }
    }
    return w;
};

export const drawTextAligned = (
    font: FontAtlas,
    text: string,
    size: number,
    x: number,
    y: number,
    color = 0xffffff,
    alignX = 0.5,
    alpha = 1,
) => {
    if (alignX !== 0.0) {
        x -= alignX * measureTextWidth(font, text, size);
    }
    drawText(font, text, size, x, y, 0, 0, color, alpha);
};
