import {createTexture, getSubTexture, Texture, uploadTexture} from "../graphics/draw2d";
import {PI2, toRad} from "../utils/math";
import {PAD_FIRE_RADIUS_0, PAD_FIRE_RADIUS_1, PAD_MOVE_RADIUS_0, PAD_MOVE_RADIUS_1} from "./params";

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

    npc0,
    npc1,
    npc2,

    barrel0,
    barrel1,
    barrel2,

    item0,
    item1,

    tree0,
    tree1,

    particle_flesh0,
    particle_flesh1,
    particle_shell,

    joy0,
    joy1,
    joy2,

    num_avatars = 8,
    num_npc = 3,
}

export const EMOJI: Record<number, string> = [];

type EmojiDecl = [string, number, number, number, number,
    number?,
    number?, number?, number?,
    number?,
    number?, number?];

export const img: Texture[] = [];

export const createCanvas = (size: number, alpha: boolean) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d", {alpha});
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#fff";
    return ctx;
}

const cutAlpha = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cut: number) => {
    const bmp = ctx.getImageData(x, y, w, h);
    for (let i = 3; i < bmp.data.length; i += 4) {
        bmp.data[i] = bmp.data[i] >= cut ? 0xFF : 0;
    }
    ctx.putImageData(bmp, x, y);
}

export const loadAtlas = (): void => {
    const tempSize = 512;
    const atlasSize = 512;
    const texture = createTexture(atlasSize);
    const temp = createCanvas(tempSize, true);
    const atlas = createCanvas(atlasSize, true);
    let x = 1;
    let y = 1;
    let x1 = 1;
    let maxHeight = 0;
    let sprWidth = 0;
    let sprHeight = 0;
    const pushSprite = (w: number, h: number) => {
        x = x1;
        x1 = x + w + 1;
        if (x1 + 1 >= atlasSize) {
            y += 1 + maxHeight;
            maxHeight = h;
            x = 1;
            x1 = x + w + 1;
        }
        if (h > maxHeight) maxHeight = h;
        sprWidth = w;
        sprHeight = h;
    };

    const createEmoji2 = (emoji: string, ox: number, oy: number, w: number, h: number, size: number = 0, a: number = 0, sx: number = 1, sy: number = 1, cut: number = 0x80, ax: number = 0.5, ay: number = 0.5) => {
        // const emoji = String.fromCodePoint(...emojiCode);
        const scale = 1 / 8;
        const emojiSize = ((16 + size) / scale) | 0;
        temp.clearRect(0, 0, tempSize, tempSize);
        temp.font = emojiSize + "px e";
        temp.textAlign = "center";
        temp.textBaseline = "middle";
        temp.translate(tempSize / 2, tempSize / 2);
        temp.rotate(toRad(a));
        temp.scale(sx, sy);
        temp.fillText(emoji, 0, 0);
        temp.resetTransform();
        const alphaThreshold = cut;
        pushSprite(w, h);
        // atlas.imageSmoothingEnabled = false;
        atlas.translate(x + 1, y + 1);
        atlas.scale(scale, scale);
        atlas.translate(-ox, -oy);
        atlas.drawImage(temp.canvas, 0, 0);
        atlas.resetTransform();
        cutAlpha(atlas, x, y, w, h, alphaThreshold);
        EMOJI[img.length] = emoji;
        img.push(getSubTexture(texture, x, y, sprWidth, sprHeight, ax, ay));
    }

    const createCircle = (r: number) => {
        const s = r * 2;
        pushSprite(s, s);
        atlas.translate(x + r, y + r);
        atlas.beginPath();
        atlas.arc(0, 0, r * 0.925, 0, PI2);
        atlas.closePath();
        atlas.fill();
        atlas.resetTransform();
        cutAlpha(atlas, x, y, sprWidth, sprHeight, 0x80);
        img.push(getSubTexture(texture, x, y, sprWidth, sprHeight, 0.5, 0.5));
    }
    // BOX
    pushSprite(1, 1);
    atlas.fillRect(x, y, 1, 1);
    img.push(
        getSubTexture(texture, x, y, sprWidth, sprHeight, 0.5, 0.5),
        getSubTexture(texture, x, y, sprWidth, sprHeight, 0, 0),
        getSubTexture(texture, x, y, sprWidth, sprHeight, 0.5, 0),
        getSubTexture(texture, x, y, sprWidth, sprHeight, 0.5, -1),
        getSubTexture(texture, x, y, sprWidth, sprHeight, 0, 0.5),
        getSubTexture(texture, x, y, sprWidth, sprHeight, 1, 0.5),
    );
    // CIRCLE
    createCircle(4);
    img.push(
        getSubTexture(texture, x, y, sprWidth, sprHeight, 0.6, 0.5),
        getSubTexture(texture, x, y, sprWidth, sprHeight, 0.7, 0.5),
    );
    createCircle(16);

    // none weapon gfx index
    img.push(undefined);

    const DATA = [
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
        /* 🍅 */ ["🍅", 195, 166, 18, 19, , , , , , ,],
        /* 😐 */ ["😐", 192, 166, 19, 19, , , , , , ,],
        /* 🐷 */ ["🐷", 192, 170, 19, 17, , , , , , ,],
        /* 🛢 */ ["🛢", 203, 144, 16, 23, 4, , , , , , 0.95],
        /* 📦 */ ["📦", 193, 144, 18, 22, 4, , , , , , 0.85],
        /* 🪦 */ ["🪦", 176, 144, 23, 23, 4, , , , , , 0.95],
        /* 💊 */ ["💊", 216, 200, 13, 13, -6, , , , , ,],
        /* ❤️ */ ["❤️", 208, 194, 15, 13, -4, , , , , ,],
        /* 🌳 */ ["🌳", 156, 99, 28, 31, 12, , , , 136, , 0.95],
        /* 🌲 */ ["🌲", 162, 99, 26, 31, 12, , , , 136, , 0.95],
        /* 🥓 */ ["🥓", 163, 219, 22, 9, , -45, , , , ,],
        /* 🦴 */ ["🦴", 163, 213, 21, 9, , -45, , , , ,],
    ];
    for (const a of DATA) {
        // @ts-ignore
        createEmoji2(...a);
    }

    pushSprite(4, 2);
    atlas.fillRect(x, y, 4, 2);
    atlas.fillStyle = "#999";
    atlas.fillRect(x, y, 1, 2);
    img.push(getSubTexture(texture, x, y, sprWidth, sprHeight, 0.5, 0.5));

    const strokeCircle = (r: number) => {
        atlas.beginPath();
        atlas.arc(0, 0, r, 0, PI2);
        atlas.closePath();
        atlas.stroke();
    }

    const renderJoy = (r0: number, r1: number, text0: string, text1: string) => {
        const s = r1 * 2 + 32;
        pushSprite(s, s);
        atlas.font = "10px monospace";
        atlas.textAlign = "center";
        atlas.lineWidth = 2;

        atlas.translate(x + s / 2, y + s / 2);

        strokeCircle(r0);
        strokeCircle(r1);

        atlas.fillText(text0, 0, -r0 - 5);
        atlas.fillText(text1, 0, -r1 - 5);

        atlas.resetTransform();

        img.push(getSubTexture(texture, x, y, sprWidth, sprHeight, 0.5, 0.5));
    }

    renderJoy(PAD_MOVE_RADIUS_0, PAD_MOVE_RADIUS_1, "RUN", "JUMP");
    renderJoy(PAD_FIRE_RADIUS_0, PAD_FIRE_RADIUS_1, "AIM", "FIRE");
    renderJoy(16, 16, "DROP", "");

    uploadTexture(texture.texture_, atlas.canvas);

    // TODO: dispose
    atlas.canvas.width = atlas.canvas.height = temp.canvas.width = temp.canvas.height = 0;

    // document.body.appendChild(atlas.canvas);
    // atlas.canvas.style.position = "fixed";
    // atlas.canvas.style.top = "0";
    // atlas.canvas.style.left = "0";
}
