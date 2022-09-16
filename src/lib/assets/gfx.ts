import {createTexture, getSubTexture, Texture, uploadTexture} from "../graphics/draw2d";
import {PI2, TO_RAD} from "../utils/math";
import {PAD_FIRE_RADIUS_0, PAD_FIRE_RADIUS_1, PAD_MOVE_RADIUS_0, PAD_MOVE_RADIUS_1} from "./params";
import {GL} from "../graphics/gl";
import {rehash} from "../utils/hasher";

export const enum Img {
    box = 0,
    box_lt,
    box_t,
    box_t1,
    box_l,
    box_r,
    circle_4,
    circle_4_60p,
    circle_4_70p,
    circle_16,

    weapon0,
    weapon1,
    weapon2,
    weapon3,
    weapon4,
    weapon5,
    weapon6,
    weapon7,
    weapon8,
    weapon9,

    avatar0,
    avatar1,
    avatar2,
    avatar3,
    avatar4,
    avatar5,
    avatar6,
    avatar7,
    avatar8,
    avatar9,
    avatar10,
    avatar11,
    avatar12,
    avatar13,

    npc0,
    npc1,
    npc2,

    barrel0,
    barrel1,
    barrel2,

    item0,

    tree0,
    tree1,

    particle_flesh0,
    particle_flesh1,
    particle_shell,

    joy0,
    joy1,
    joy2,

    logo_title,
    logo_start,

    light_circle,

    num_avatars = 14,
    num_npc = 3,
}

const Font = (size: number): string => size + "px Georgia,e";
// export const Font = (size: number): string => size + "px e";
export const EMOJI: Record<number, string> = [];

export const img: Texture[] = [];

export const createCanvas = (size: number, _canvas?: HTMLCanvasElement | CanvasRenderingContext2D): CanvasRenderingContext2D => {
    _canvas = document.createElement("canvas");
    _canvas.width = _canvas.height = size;
    _canvas = rehash(_canvas.getContext("2d"));
    _canvas.fillStyle = _canvas.strokeStyle = "#fff";
    _canvas.textAlign = "center";
    _canvas.textBaseline = "middle";
    return _canvas;
}

const circle = (ctx: CanvasRenderingContext2D, r: number) => {
    ctx.beginPath();
    ctx.arc(0, 0, r - 0.3, 0, PI2);
    //ctx.closePath();
}

export const loadAtlas = (): void => {
    const canvaSize = 512;
    const texture = createTexture(canvaSize);
    const temp = createCanvas(canvaSize);
    const atlas = createCanvas(canvaSize);
    let x = 1;
    let y = 1;
    let x1 = 1;
    let maxHeight = 0;
    let sprWidth = 0;
    let sprHeight = 0;
    const pushSprite = (w: number, h: number) => {
        x = x1;
        x1 = x + w + 1;
        if (x1 + 1 >= canvaSize) {
            y += 1 + maxHeight;
            maxHeight = h;
            x = 1;
            x1 = x + w + 1;
        }
        if (h > maxHeight) maxHeight = h;
        sprWidth = w;
        sprHeight = h;
    };

    const saveImage = (ax?: number, ay?: number) =>
        img.push(getSubTexture(texture, x, y, sprWidth, sprHeight, ax, ay));

    const cutAlpha = (cut: number = 0x80, imageData?: ImageData, imagePixels?: Uint8ClampedArray) => {
        imageData = atlas.getImageData(x, y, sprWidth, sprHeight);
        imagePixels = imageData.data;
        for (let i = 3; i < imagePixels.length; i += 4) {
            imagePixels[i] = imagePixels[i] < cut ? 0 : 0xFF;
        }
        atlas.putImageData(imageData, x, y);
    };

    const createEmoji2 = (emoji: string, ox: number, oy: number, w: number, h: number, size: number = 0, a: number = 0, sx: number = 1, sy: number = 1, cut?: number, ax?: number, ay?: number) => {
        // const emoji = String.fromCodePoint(...emojiCode);
        let scale = 8;
        const emojiSize = (16 + size) * scale;
        temp.clearRect(0, 0, canvaSize, canvaSize);
        temp.font = Font(emojiSize);
        temp.translate(canvaSize / 2, canvaSize / 2);
        temp.rotate(a * TO_RAD);
        temp.scale(sx, sy);
        temp.fillText(emoji, 0, 0);
        temp.resetTransform();
        pushSprite(w, h);
        // atlas.imageSmoothingEnabled = false;
        atlas.translate(x + 1, y + 1);
        scale = 1 / scale;
        atlas.scale(scale, scale);
        atlas.translate(-ox, -oy);
        atlas.drawImage(temp.canvas, 0, 0);
        atlas.resetTransform();
        cutAlpha(cut);
        EMOJI[img.length] = emoji;
        saveImage(ax, ay);
    }

    const createCircle = (r: number) => {
        const s = r * 2;
        pushSprite(s, s);
        atlas.translate(x + r, y + r);
        circle(atlas, r);
        atlas.fill();
        atlas.resetTransform();
        cutAlpha();
        saveImage();
    }
    // BOX
    pushSprite(1, 1);
    atlas.fillRect(x, y, 1, 1);
    saveImage();
    saveImage(0, 0);
    saveImage(0.5, 0);
    saveImage(0.5, -1);
    saveImage(0);
    saveImage(1);
    // CIRCLE
    createCircle(4);
    saveImage(0.6);
    saveImage(0.7);

    createCircle(16);

    // none weapon gfx index
    saveImage();
    // img.push(undefined);

    [
        /* 🔪 */ ["🔪", 180, 234, 19, 7, -4, -50, , , , 0.3,],
        /* 🪓 */ ["🪓", 198, 210, 20, 10, , 45, -1, , , 0.3,],
        /* 🔫 */ ["🔫", 208, 198, 15, 12, -4, , -1, , , 0.3,],
        /* 🖊️ */ ["🖊️", 157, 211, 24, 8, , -45, -1, , , ,],
        /* ✏️️ */ ["✏️️", 186, 216, 23, 8, , 44.5, -1, , , ,],
        /* 🪥 */ ["🪥", 175, 261, 20, 8, , 45, , -1, , ,],
        /* ⛏ */ ["⛏", 196, 216, 21, 17, , 135, , , , ,],
        /* 🔌 */ ["🔌", 188, 202, 22, 11, , 45, -1, , , ,],
        /* 🧵 */ ["🧵", 217, 192, 19, 19, , 90, , , , 0.3, 0.4],
        /* 💀 */ ["💀", 198, 166, 17, 19, , , , , , ,],
        /* 👹 */ ["👹", 192, 166, 19, 18, , , , , , ,],
        /* 🤡 */ ["🤡", 192, 166, 19, 19, , , , , , ,],
        /* 🤖 */ ["🤖", 192, 166, 19, 18, , , , , , ,],
        /* 🎃 */ ["🎃", 192, 166, 19, 19, , , , , , ,],
        /* 🦝 */ ["🦝", 192, 172, 19, 17, , , , , , ,],
        /* 🐙 */ ["🐙", 192, 166, 19, 18, , , , , , ,],
        /* 🐰 */ ["🐰", 186, 144, 20, 23, 4, , , , , , 0.65],
        /* 🦌 */ ["🦌", 176, 144, 23, 23, 4, , , , , , 0.67],
        /* 🐺 */ ["🐺", 181, 153, 21, 20, 4, , , , , ,],
        /* 🐵 */ ["🐵", 181, 144, 21, 23, 4, , , , , ,],
        /* 🦊 */ ["🦊", 177, 153, 22, 20, 4, , , , , ,],
        /* 🐭 */ ["🐭", 176, 148, 23, 22, 4, , , , , ,],
        /* 🦍 */ ["🦍", 179, 145, 22, 22, 4, , , , , ,],

        /* 🍅 */ ["🍅", 195, 166, 18, 19, , , , , , ,],
        /* 😐 */ ["😐", 192, 166, 19, 19, , , , , , ,],
        /* 🐷 */ ["🐷", 192, 170, 19, 17, , , , , , ,],
        /* 🛢 */ ["🛢", 203, 144, 16, 23, 4, , , , , , 0.95],
        /* 📦 */ ["📦", 193, 144, 18, 22, 4, , , , , , 0.85],
        /* 🪦 */ ["🪦", 176, 144, 23, 23, 4, , , , , , 0.95],
        /* ❤️ */ ["❤️", 208, 194, 15, 13, -4, , , , , ,],
        /* 🌳 */ ["🌳", 156, 99, 28, 31, 12, , , , 136, , 0.95],
        /* 🌲 */ ["🌲", 162, 99, 26, 31, 12, , , , 136, , 0.95],
        /* 🥓 */ ["🥓", 163, 219, 22, 9, , -45, , , , ,],
        /* 🦴 */ ["🦴", 163, 213, 21, 9, , -45, , , , ,],
    ].map(a =>
        // @ts-ignore
        createEmoji2(...a)
    );
    pushSprite(4, 2);
    atlas.fillRect(x, y, 4, 2);
    atlas.fillStyle = "#999";
    atlas.fillRect(x, y, 1, 2);
    saveImage();

    atlas.fillStyle = "#fff";


    const renderJoy = (r0: number, r1: number, text0: string, text1: string) => {
        let s = r1 * 2 + 32;
        pushSprite(s, s);
        atlas.font = Font(10);
        atlas.lineWidth = 2;

        s /= 2;
        atlas.translate(x + s, y + s);

        circle(atlas, r0);
        atlas.stroke();

        circle(atlas, r1);
        atlas.stroke();

        atlas.fillText(text0, 0, -r0 - 5);
        atlas.fillText(text1, 0, -r1 - 5);

        atlas.resetTransform();

        cutAlpha();
        saveImage();
    }

    renderJoy(PAD_MOVE_RADIUS_0, PAD_MOVE_RADIUS_1, "RUN", "JUMP");
    renderJoy(PAD_FIRE_RADIUS_0, PAD_FIRE_RADIUS_1, "AIM", "FIRE");
    renderJoy(16, 16, "DROP", "");

    pushSprite(72, 64);
    atlas.font = Font(72);
    atlas.fillText("13", x + 72 / 2, y + 28);
    cutAlpha();
    saveImage();

    pushSprite(200, 24);
    atlas.font = Font(24);
    atlas.fillText("TAP TO START", x + 100, y + 12);
    cutAlpha();
    saveImage();

    uploadTexture(texture, atlas.canvas);

    // document.body.appendChild(atlas.canvas);
    // atlas.canvas.style.position = "fixed";
    // atlas.canvas.style.top = "0";
    // atlas.canvas.style.left = "0";

    // TODO: dispose
    // atlas.canvas.width = atlas.canvas.height = temp.canvas.width = temp.canvas.height = 0;

    {
        const ctx = createCanvas(64);
        ctx.translate(32, 32);
        const grd = rehash(ctx.createRadialGradient(0, 0, 32 / 2, 0, 0, 32));
        grd.addColorStop(0, "rgba(255,255,255,1)");
        grd.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = grd;
        circle(ctx, 32);
        ctx.fill();
        ctx.scale(1, 0.25);
        circle(ctx, 32);
        ctx.fill();
        ctx.resetTransform();
        img[Img.light_circle] = createTexture(64);
        img[Img.light_circle].x_ = 0.5;
        img[Img.light_circle].y_ = 0.5;
        uploadTexture(img[Img.light_circle], ctx.canvas, GL.LINEAR);
    }
}
