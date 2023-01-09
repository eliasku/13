import {createTexture, draw, getSubTexture, Texture, uploadTexture} from "./draw2d";

const SPACE_REGEX = /\s/gm;
const SPACE_CODE = ' '.codePointAt(0);
const DEFAULT_CHARACTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890.,\'-\/';

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
    _descent: 0
};

export interface FontStyleDef {
    _strokeWidth?: number;
    _strokeColor?: { r: number, g: number, b: number, a: number };
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
    _characters: string;

    // in pixels, resolution independent
    _border: number;

    _characterMap: Map<number, CharacterData>;
    // relative to EM units
    _lineSize: number;

    _dirty: boolean;

    _strokeWidth: number;
    _strokeColor: string;
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
    const texture = createTexture(canvasSize);
    const fa: FontAtlas = {
        _fallback: fallback, _style: style, _size: size, _scale: scale, _family: family, _ctx: ctx,
        _texture: texture,
        _textureBoxLT: getSubTexture(texture, 1, 1, 1, 1, 0, 0),
        _textureBox: getSubTexture(texture, 1, 1, 1, 1, 0.5, 0.5),
        _textureBoxT1: getSubTexture(texture, 1, 1, 1, 1, 0.5, -1),
        _nextSheetX: 0,
        _nextSheetY: 0,
        _sheetLineHeight: 0,
        _characters: "",
        _border: Math.ceil(scale),
        _characterMap: new Map<number, CharacterData>(),
        _lineSize: 1.3,

        _dirty: true,

        _strokeWidth: style._strokeWidth ?? 0,
        _strokeColor: style._strokeColor ? `rgba(${style._strokeColor.r},${style._strokeColor.g},${style._strokeColor.b},${style._strokeColor.a})`
            : 'rgba(0,0,0,0.5)'
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
}

const resetFontCanvas = (fa: FontAtlas) => {
    const fontSize = Math.ceil(fa._size * fa._scale);
    fa._ctx.font = `${fontSize}px ${fa._family},${fa._fallback}`;
    // "Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol"
    // setup context
    fa._ctx.fillStyle = 'rgb(255,255,255)';
    fa._ctx.textBaseline = 'alphabetic';
    fa._ctx.textAlign = 'left';
}

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
    fa._characters = "";
    addChars(fa, characters);
    updateTexture(fa);
}

const addSpaceCharacter = (fa: FontAtlas) => {
    const spaceWidth = fa._ctx.measureText(' ').width / fa._scale;
    fa._characterMap.set(SPACE_CODE, {
            _a: spaceWidth,
            _x: 0,
            _y: 0,
            _w: spaceWidth,
            _h: fa._size * fa._lineSize,
            _texture: getSubTexture(fa._texture, 0, 0, 0, 0, 0, 0)
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
    if (bb._supported === 0) {
        bb._supported = ('actualBoundingBoxLeft' in metrics
            && 'actualBoundingBoxRight' in metrics
            && 'actualBoundingBoxAscent' in metrics
            && 'actualBoundingBoxDescent' in metrics) ? 2 : 1;
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
}

const getCharacter = (fa: FontAtlas, codepoint: number): CharacterData => {
    if (fa._characterMap.has(codepoint)) {
        return fa._characterMap.get(codepoint)!;
    }

    const character = String.fromCodePoint(codepoint);
    const ctx = fa._ctx;
    const canvas = ctx.canvas;
    const invScale = 1 / fa._scale;
    const metrics = ctx.measureText(character);
    const bb = readMetrics(fa, metrics);
    const padding = fa._border + fa._strokeWidth * fa._scale;
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

    const data:CharacterData = {
        _a: metrics.width * invScale,
        _x: -(bb._left + padding) * invScale,
        _y: -(bb._ascent + padding) * invScale,
        _w: w * invScale,
        _h: h * invScale,
        _texture: getSubTexture(fa._texture, x, y, w, h, 0, 0)
    };

    fa._characterMap.set(codepoint, data);
    fa._characters += character;
    const px = x + bb._left + padding;
    const py = y + bb._ascent + padding;
    if (fa._strokeWidth > 0) {
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.lineWidth = 2 * fa._strokeWidth * fa._scale;
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
    fa._nextSheetX = x;
    fa._nextSheetY = y;
    fa._dirty = true;

    return data;
}

const updateTexture = (fa: FontAtlas) => {
    if (fa._dirty) {
        uploadTexture(fa._texture, fa._ctx.canvas);
        fa._dirty = false;
    }
}

/// resources
export const fnt: FontAtlas[] = [];

export const initFonts = () => {
    fnt[0] = makeFontAtlas(`m,e,fa-brands-400`, 24, 1, {_strokeWidth: 3});
};

export const updateFonts = () => fnt.forEach(updateTexture);

export const resetFonts = () => fnt.forEach(fa => resetFontAtlas(fa));

/// drawing

const LF = "\n".codePointAt(0);
export const drawText = (font: FontAtlas, text: string, size: number, x: number, y: number, lineHeight: number, lineSpacing: number, color: number = 0xFFFFFF) => {
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
            draw(gdata._texture, cx + sc * gdata._x, cy + sc * gdata._y, 0, sc, sc, 1, color);
        }
        cx += sc * gdata._a; // advance
    }
}

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
}

export const drawTextShadow = (font: FontAtlas, text: string, size: number, x: number, y: number, color: number = 0xFFFFFF) => {
    //drawText(font, text, size, x, y + 1, 0, 0, 0);
    drawText(font, text, size, x, y, 0, 0, color);
}

export const drawTextShadowCenter = (font: FontAtlas, text: string, size: number, x: number, y: number, color: number = 0xFFFFFF) => {
    x -= measureTextWidth(font, text, size) / 2;
    drawTextShadow(font, text, size, x, y, color);
}