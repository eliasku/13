import {createTexture, draw, getSubTexture, Texture, uploadTexture} from "./draw2d";
import {max} from "../utils/math";

const SPACE_REGEX = /\s/gm;
const SPACE_CODE = ' '.codePointAt(0);
const DEFAULT_CHARACTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890.,\'-\/';

export interface CharacterData {
    // advance width
    a: number;
    // bounding rect
    x: number;
    y: number;
    w: number;
    h: number;
    // uv
    tex?: Texture;
}

const CHAR_BOUNDING_BOX = {
    supported: 0,
    left: 0,
    right: 0,
    ascent: 0,
    descent: 0
};

export interface FontStyleDef {
    strokeWidth?: number;
    strokeColor?: { r: number, g: number, b: number, a: number };
}

export interface FontAtlas {
    family: string;
    size: number;
    scale: number;
    style: FontStyleDef;
    fallback: string;
    ctx: CanvasRenderingContext2D;
    texture: Texture;
    nextSheetX: number;
    nextSheetY: number;
    sheetLineHeight: number;
    characters: string;

    // in pixels, resolution independent
    border: number;

    characterMap: Map<number, CharacterData>;
    // relative to EM units
    lineSize: number;

    dirty: boolean;

    strokeWidth: number;
    strokeColor: string;
}

export const makeFontAtlas = (family: string,
                              size: number,
                              scale: number,
                              style: FontStyleDef): FontAtlas => {
    const canvas = document.createElement("canvas");
    const canvasSize = 128;
    canvas.width = canvas.height = canvasSize;

    // canvas.style.position = "absolute";
    // canvas.style.top = "0px";
    // canvas.style.left = "0px";
    // document.body.appendChild(canvas);

    const ctx = canvas.getContext("2d", {willReadFrequently: true});
    const fallback = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif';
    const fa: FontAtlas = {
        fallback, style, size, scale, family, ctx,
        texture: createTexture(canvasSize),
        nextSheetX: 0,
        nextSheetY: 0,
        sheetLineHeight: 0,
        characters: "",
        border: Math.ceil(scale),
        characterMap: new Map<number, CharacterData>(),
        lineSize: 1.3,

        dirty: true,

        strokeWidth: style.strokeWidth ?? 0,
        strokeColor: style.strokeColor ? `rgba(${style.strokeColor.r},${style.strokeColor.g},${style.strokeColor.b},${style.strokeColor.a})`
            : 'rgba(0,0,0,0.5)'
    };
    resetFontAtlas(fa);
    return fa;
};

const enlargeFontTexture = (fa: FontAtlas) => {
    const c = fa.ctx.canvas;
    const size = c.width << 1;
    fa.texture.w_ = fa.texture.h_ = c.width = c.height = size;
    resetFontAtlas(fa, fa.characters);
}

const resetFontCanvas = (fa: FontAtlas) => {
    const fontSize = Math.ceil(fa.size * fa.scale);
    fa.ctx.font = `${fontSize}px ${fa.family},${fa.fallback}`;
    // "Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol"
    // setup context
    fa.ctx.fillStyle = 'rgb(255,255,255)';
    fa.ctx.textBaseline = 'alphabetic';
    fa.ctx.textAlign = 'left';
}

const resetFontAtlas = (fa: FontAtlas, characters = DEFAULT_CHARACTERS) => {
    fa.ctx.clearRect(0, 0, fa.ctx.canvas.width, fa.ctx.canvas.height);
    //fa.ctx.fillRect(0, 0, fa.ctx.canvas.width, fa.ctx.canvas.height);
    resetFontCanvas(fa);
    fa.nextSheetX = 0;
    fa.nextSheetY = 0;
    fa.characterMap.clear();
    addSpaceCharacter(fa);
    fa.characters = "";
    addChars(fa, characters);
    updateTexture(fa);
}

const addSpaceCharacter = (fa: FontAtlas) => {
    const spaceWidth = fa.ctx.measureText(' ').width / fa.scale;
    fa.characterMap.set(SPACE_CODE, {
            a: spaceWidth,
            x: 0,
            y: 0,
            w: spaceWidth,
            h: fa.size * fa.lineSize,
            tex: getSubTexture(fa.texture, 0, 0, 0, 0, 0, 0)
        }
    );
}

const addChars = (fa: FontAtlas, characters: string) => {
    const chars = characters.replace(SPACE_REGEX, '');
    for (let i = 0; i < chars.length; i++) {
        getCharacter(fa, chars.codePointAt(i));
    }
}

const readMetrics = (fa: FontAtlas, metrics: TextMetrics) => {
    const bb = CHAR_BOUNDING_BOX;
    if (bb.supported === 0) {
        bb.supported = ('actualBoundingBoxLeft' in metrics
            && 'actualBoundingBoxRight' in metrics
            && 'actualBoundingBoxAscent' in metrics
            && 'actualBoundingBoxDescent' in metrics) ? 2 : 1;
    }
    if (bb.supported === 2) {
        bb.left = metrics.actualBoundingBoxLeft;
        bb.right = metrics.actualBoundingBoxRight;
        bb.ascent = metrics.actualBoundingBoxAscent;
        bb.descent = metrics.actualBoundingBoxDescent;
    } else {
        const size = fa.size * fa.scale;
        bb.left = 0;
        bb.right = metrics.width;
        bb.ascent = Math.ceil(0.7 * size);
        bb.descent = Math.ceil(0.3 * size);
    }
    return bb;
}

const getCharacter = (fa: FontAtlas, codepoint: number): CharacterData => {
    if (fa.characterMap.has(codepoint)) {
        return fa.characterMap.get(codepoint)!;
    }

    const character = String.fromCodePoint(codepoint);
    const ctx = fa.ctx;
    const canvas = ctx.canvas;
    const invScale = 1 / fa.scale;
    const metrics = ctx.measureText(character);
    const bb = readMetrics(fa, metrics);
    const padding = fa.border + fa.strokeWidth * fa.scale;
    const w = bb.right + bb.left + 2 * padding;
    const h = bb.descent + bb.ascent + 2 * padding;
    let x = fa.nextSheetX;
    let y = fa.nextSheetY;
    if (x + w > canvas.width) {
        x = 0;
        y += fa.sheetLineHeight;
        fa.sheetLineHeight = 0;
        if (y + h > canvas.height) {
            enlargeFontTexture(fa);
            return getCharacter(fa, codepoint);
        }
    }

    if (h > fa.sheetLineHeight) {
        fa.sheetLineHeight = h;
    }

    const data = {
        a: metrics.width * invScale,
        x: -(bb.left + padding) * invScale,
        y: -(bb.ascent + padding) * invScale,
        w: w * invScale,
        h: h * invScale,
        tex: getSubTexture(fa.texture, x, y, w, h, 0, 0)
    };

    fa.characterMap.set(codepoint, data);
    fa.characters += character;
    const px = x + bb.left + padding;
    const py = y + bb.ascent + padding;
    if (fa.strokeWidth > 0) {
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.lineWidth = 2 * fa.strokeWidth * fa.scale;
        ctx.lineJoin = 'round';
        ctx.strokeText(character, px, py);
        ctx.strokeText(character, px, py + 1);
    }
    // ctx.fillStyle = "#000";
    // ctx.fillText(character, px, py + 3);
    ctx.fillStyle = "#fff";
    ctx.fillText(character, px, py);

    //
    {
        const imageData = ctx.getImageData(x, y, w, h);
        const imagePixels = imageData.data;
        for (let i = 3; i < imagePixels.length; i += 4) {
            imagePixels[i] = imagePixels[i] < 0x80 ? 0 : 0xFF;
        }
        ctx.putImageData(imageData, x, y);
    }
    // if (DEBUG_SHOW_BOUNDS) {
    // ctx.lineWidth = 1;
    // ctx.strokeStyle = 'rgb(255,0,0)';
    // ctx.strokeRect(x, y + padding, w / 2, bb.ascent);
    // ctx.strokeStyle = 'rgb(0,255,0)';
    // ctx.strokeRect(x + w / 2, y + padding + bb.ascent, w / 2, bb.descent);
    // }
    x += w;
    fa.nextSheetX = x;
    fa.nextSheetY = y;
    fa.dirty = true;

    return data;
}

const updateTexture = (fa: FontAtlas) => {
    if (fa.dirty) {
        uploadTexture(fa.texture, fa.ctx.canvas);
        fa.dirty = false;
    }
}

/// reseources


export const fnt: FontAtlas[] = [
    makeFontAtlas("monospace,e", 24, 1, {strokeWidth: 3})
];

export const updateFonts = () => fnt.forEach(updateTexture);

export const resetFonts = () => fnt.forEach(fa => resetFontAtlas(fa));

/// drawing

const LF = "\n".codePointAt(0);
export const drawText = (font: FontAtlas, text: string, size: number, x: number, y: number, lineHeight: number, lineSpacing: number, color: number = 0xFFFFFF) => {
    const sc = size / font.size;
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
        if (gdata.tex) {
            draw(gdata.tex, cx + sc * gdata.x, cy + sc * gdata.y, 0, sc, sc, 1, color);
        }
        cx += sc * gdata.a; // advance
    }
}

export const measureTextWidth = (font: FontAtlas, text: string, size: number): number => {
    const sc = size / font.size;
    let x = 0;
    let w = 0;
    for (const ch of text) {
        const code = ch.codePointAt(0);
        if (code === LF) {
            x = 0;
            continue;
        }
        const gdata = getCharacter(font, code);
        x += sc * gdata.a;
        if (x > w) {
            w = x;
        }
    }
    return w;
}

export const drawTextShadow = (font: FontAtlas, text: string, size: number, x: number, y: number, color: number = 0xFFFFFF) => {
    //drawText(font, text, size, x, y + 1, 0, 0, 0);
    drawText(font, text, size, x, y, 0, 0, color);
}

export const drawTextShadowCenter = (font: FontAtlas, text: string, size: number, x: number, y: number, color: number = 0xFFFFFF) => {
    x -= measureTextWidth(font, text, size) / 2;
    drawTextShadow(font, text, size, x, y, color);
}