import {AtlasPage, Image} from "./atlas";
import {generateMeshSprite} from "./generateSpriteMesh";

const PAD_MOVE_RADIUS_0 = 16;
const PAD_MOVE_RADIUS_1 = 48;
const PAD_FIRE_RADIUS_0 = 16;
const PAD_FIRE_RADIUS_1 = 40;
const PI2 = Math.PI * 2;
const TO_RAD = Math.PI / 180;

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
    npc3,
    npc4,
    npc5,
    npc6,
    npc7,

    barrel0,
    barrel1,
    barrel2,

    item0,
    item1,
    item2,
    item3,
    item4,
    item5,

    tree0,
    tree1,
    tree2,
    tree3,
    tree4,
    tree5,

    particle_flesh0,
    particle_flesh1,
    particle_shell,

    logo_title,

    num_avatars = 14,
    num_npc = 8,
}

const Font = (size: number): string => `${size}px m,e`;
// export const Font = (size: number): string => size + "px e";
export const EMOJI: Record<number, string> = [];

export const img: Image[] = [];

export const createCanvas = (size: number, _canvas?: HTMLCanvasElement | CanvasRenderingContext2D): CanvasRenderingContext2D => {
    _canvas = document.createElement("canvas");
    _canvas.width = _canvas.height = size;
    _canvas = _canvas.getContext("2d");
    _canvas.fillStyle = _canvas.strokeStyle = "#fff";
    _canvas.textAlign = "center";
    _canvas.textBaseline = "alphabetic";
    return _canvas;
}

const circle = (ctx: CanvasRenderingContext2D, r: number) => {
    ctx.beginPath();
    ctx.arc(0, 0, r - 0.3, 0, PI2);
    ctx.closePath();
}

export const buildAtlas = (): AtlasPage => {
    const canvaSize = 512;
    const temp = createCanvas(canvaSize);
    const atlas = createCanvas(canvaSize);
    let x = 1;
    let y = 1;
    let x1 = 1;
    let maxHeight = 0;
    let sprWidth = 0;
    let sprHeight = 0;
    let allIndices: number[] = [];
    let allVertices: number[] = [];
    let startIndex = 0;
    let startVertex = 0;
    let indices: number[];
    let vertices: number[];

    const addMesh = (soft = false, flood: boolean = true) => {
        const imgData = atlas.getImageData(x, y, sprWidth, sprHeight);
        const subMesh = generateMeshSprite(imgData, soft, 4, 1, 0.999);
        startIndex = allIndices.length;
        startVertex = allVertices.length / 2;
        indices = subMesh.indices;
        vertices = subMesh.vertices;
        for (const i of indices) {
            allIndices.push(i);
        }
        allVertices = allVertices.concat(vertices);

        if (flood) {
            const imgData = atlas.getImageData(x - 1, y - 1, sprWidth + 2, sprHeight + 2);
            const newImageData = new Uint8ClampedArray((sprWidth + 2) * (sprHeight + 2) * 4);
            const stride = imgData.width * 4;
            const copy = (from: number, to: number) => {
                if (!imgData.data[to + 3] || from === to) {
                    newImageData[to] = imgData.data[from];
                    newImageData[to + 1] = imgData.data[from + 1];
                    newImageData[to + 2] = imgData.data[from + 2];
                    newImageData[to + 3] = imgData.data[from + 3];
                }
            };
            for (let cy = 1; cy < imgData.height - 1; ++cy) {
                for (let cx = 1; cx < imgData.width - 1; ++cx) {
                    let i = cy * stride + cx * 4;
                    if (imgData.data[i + 3]) {
                        copy(i, i);
                        copy(i, i - stride);
                        copy(i, i + stride);
                        copy(i, i - 4);
                        copy(i, i + 4);
                        copy(i, i - stride - 4);
                        copy(i, i - stride + 4);
                        copy(i, i + stride - 4);
                        copy(i, i + stride + 4);
                    }
                }
            }
            imgData.data.set(newImageData);
            atlas.putImageData(imgData, x - 1, y - 1);
        }
    };
    // TODO:
    const addQuadMesh = () => {
        // const imgData = atlas.getImageData(x, y, sprWidth, sprHeight);
        // const subMesh = generateMeshSprite(imgData, true, 1, 1, 1);
        // startIndex = allIndices.length;
        // indices = subMesh.indices;
        // vertices = subMesh.vertices;
        // for(const i of indices) {
        //     allIndices.push(startIndex + i);
        // }
        // allVertices = allVertices.concat(vertices);
    };

    const pushSprite = (w: number, h: number) => {
        const pad = 2;
        x = x1;
        x1 = x + w + pad;
        if (x1 + pad >= canvaSize) {
            y += pad + maxHeight;
            maxHeight = h;
            x = 1;
            x1 = x + w + pad;
        }
        if (h > maxHeight) maxHeight = h;
        sprWidth = w;
        sprHeight = h;
    };

    const saveImage = (ax?: number, ay?: number) =>
        img.push({
            tx: x,
            ty: y,
            tw: sprWidth,
            th: sprHeight,
            x: ax ?? 0.5,
            y: ay ?? 0.5,
            triangles: indices.length / 3,
            index0: startIndex,
            vertex0: startVertex,
            vertexCount: vertices.length / 2,
        });

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
        temp.fillText(emoji, 0, emojiSize * 0.3);
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
        addMesh();
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
        addMesh();
        saveImage();
    }
    // BOX
    pushSprite(1, 1);
    atlas.fillRect(x - 1, y - 1, 3, 3);
    addMesh(false, false);
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
    saveImage();

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
        /* 🧑‍🎄 */ ["🧑‍🎄", 192, 166, 19, 18, , , , , , ,],
        /* 🎅🏻 */ ["🎅🏻", 192, 166, 19, 19, , , , , , ,],
        /* 🎅🏼 */ ["🎅🏼", 192, 166, 19, 19, , , , , , ,],
        /* 🎅🏾 */ ["🎅🏾", 192, 166, 19, 19, , , , , , ,],
        /* 🎅 */ ["🎅", 192, 166, 19, 19, , , , , , ,],

        /* 🛢 */ ["🛢", 203, 144, 16, 23, 4, , , , , , 0.95],
        /* 📦 */ ["📦", 193, 144, 18, 22, 4, , , , , , 0.85],
        /* 🪦 */ ["🪦", 176, 144, 23, 23, 4, , , , , , 0.95],

        /* ❤️ */ ["❤️", 208, 194, 15, 13, -4, , , , , ,],
        /* 💊 */ ["💊", 216, 200, 13, 13, -6, , , , , ,],
        /* 🪙 */ ["🪙", 211, 189, 14, 15, -4, , , , , ,],
        /* 💎 */ ["💎", 208, 197, 15, 13, -4, , , , , ,],
        /* 🛡 */ ["🛡", 213, 189, 13, 15, -4, , , , , ,],
        /* 🧱 */ ["🧱", 209, 200, 14, 12, -4, , , , , ,],

        /* 🌳 */ ["🌳", 156, 99, 28, 31, 12, , , , 136, , 0.95],
        /* 🌲 */ ["🌲", 162, 99, 26, 31, 12, , , , 136, , 0.95],
        /* 🌵 */ ["🌵", 150, 99, 29, 30, 12, , , , 136, , 0.95],
        /* 🌴 */ ["🌴", 159, 100, 27, 30, 12, , , , 136, , 0.95],
        /* 🎄 */ ["🎄", 174, 100, 24, 30, 12, , , , 136, , 0.95],
        /* ⛄ */ ["⛄", 156, 99, 28, 31, 12, , , , 136, , 0.95],
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
    addMesh();
    saveImage();

    atlas.fillStyle = "#fff";

    pushSprite(72, 64);
    atlas.font = Font(72);
    atlas.fillText("13", x + 72 / 2, y + 51);
    cutAlpha();
    addMesh();
    saveImage();

    temp.canvas.width = temp.canvas.height = 0;

    const headerDataSize = 3 * 4;
    const imagesDataSize = img.length * (10 * 4);
    const vertexDataSize = allVertices.length * 4;
    const indexDataSize = allIndices.length * 2;
    const buffer = new ArrayBuffer(headerDataSize + imagesDataSize + vertexDataSize + indexDataSize);
    const bufferHeader = new Int32Array(buffer, 0, headerDataSize / 4);
    const bufferSubImages = new Float32Array(buffer, headerDataSize, imagesDataSize / 4);
    const bufferV = new Float32Array(buffer, headerDataSize + imagesDataSize, allVertices.length);
    const bufferI = new Uint16Array(buffer, headerDataSize + imagesDataSize + vertexDataSize, allIndices.length);

    bufferHeader[0] = img.length;
    bufferHeader[1] = allVertices.length;
    bufferHeader[2] = allIndices.length;

    let ptr = 0;
    for (const subImage of img) {
        bufferSubImages[ptr++] = subImage.tx;
        bufferSubImages[ptr++] = subImage.ty;
        bufferSubImages[ptr++] = subImage.tw;
        bufferSubImages[ptr++] = subImage.th;
        bufferSubImages[ptr++] = subImage.x;
        bufferSubImages[ptr++] = subImage.y;
        bufferSubImages[ptr++] = subImage.index0;
        bufferSubImages[ptr++] = subImage.triangles;
        bufferSubImages[ptr++] = subImage.vertex0;
        bufferSubImages[ptr++] = subImage.vertexCount;
    }
    
    bufferV.set(allVertices);
    bufferI.set(allIndices);

    console.info(JSON.stringify(EMOJI));

    return {
        vertices: new Float32Array(allVertices),
        indices: new Uint16Array(allIndices),
        images: img,
        image: atlas.canvas,
        data: buffer,
    };
}

export function makeSpotLightTexture() {
    const ctx = createCanvas(64);
    ctx.translate(32, 32);
    const grd = ctx.createRadialGradient(0, 0, 32 / 2, 0, 0, 32);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grd;
    circle(ctx, 32);
    ctx.fill();
    ctx.scale(1, 0.25);
    circle(ctx, 32);
    ctx.fill();
    ctx.resetTransform();
    ctx.canvas.toBlob((blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        document.body.appendChild(a);
        a.href = url;
        a.download = "spot.png";
        a.click();
        setTimeout(() => {
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }, 0);
    }, "png");
}