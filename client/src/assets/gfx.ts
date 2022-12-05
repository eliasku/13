import {createTexture, getSubTexture, Texture, uploadTexture} from "../graphics/draw2d";
import {GL} from "../graphics/gl";

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

    joy0,
    joy1,
    joy2,
    joy3,
    joy4,

    logo_title,

    num_avatars = 14,
    num_npc = 8,
}

export const EMOJI: Record<number, string> = [null, null, null, null, null, null, null, null, null, null, null, "🔪", "🪓", "🔫", "🖊️", "✏️️", "🪥", "⛏", "🔌", "🧵", "💀", "👹", "🤡", "🤖", "🎃", "🦝", "🐙", "🐰", "🦌", "🐺", "🐵", "🦊", "🐭", "🦍", "🍅", "😐", "🐷", "🧑‍🎄", "🎅🏻", "🎅🏼", "🎅🏾", "🎅", "🛢", "📦", "🪦", "❤️", "💊", "🪙", "💎", "🛡", "🧱", "🌳", "🌲", "🌵", "🌴", "🎄", "⛄", "🥓", "🦴"];

export const img: Texture[] = [];
export let imgSpotLight: Texture | undefined;

const loadArrayBuffer = (url: string): Promise<ArrayBuffer> => fetch(url).then(b => b.arrayBuffer());

const loadImage = (url: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
    const image = new Image();
    image.onerror = (e) => reject(e);
    image.onload = () => resolve(image);
    image.src = url;
});

export const createCanvas = (size: number, _canvas?: HTMLCanvasElement | CanvasRenderingContext2D): CanvasRenderingContext2D => {
    _canvas = document.createElement("canvas");
    _canvas.width = _canvas.height = size;
    _canvas = _canvas.getContext("2d");
    _canvas.fillStyle = _canvas.strokeStyle = "#fff";
    _canvas.textAlign = "center";
    _canvas.textBaseline = "alphabetic";
    return _canvas;
}

export async function loadMainAtlas(): Promise<void> {
    const [image, buffer] = await Promise.all([
        loadImage("main.png"),
        loadArrayBuffer("main.dat")
    ]);
    const texture = createTexture(image.width, image.height);
    uploadTexture(texture, image);
    const i32 = new Int32Array(buffer);
    const f32 = new Float32Array(buffer);
    let ptr = 0;
    const subImagesCount = i32[ptr++] | 0;
    const verticesCount = i32[ptr++] | 0;
    const indicesCount = i32[ptr++] | 0;
    const vertexData = new Float32Array(buffer, (ptr + subImagesCount * 10) * 4, verticesCount);
    const indexData = new Uint16Array(buffer, (ptr + subImagesCount * 10 + verticesCount) * 4, indicesCount);
    for (let i = 0; i < subImagesCount; ++i) {
        const subImage = getSubTexture(
            texture,
            f32[ptr++] | 0,
            f32[ptr++] | 0,
            f32[ptr++] | 0,
            f32[ptr++] | 0,
            f32[ptr++],
            f32[ptr++]
        );
        subImage.index0 = f32[ptr++] | 0;
        subImage.triangles = f32[ptr++] | 0;
        subImage.vertex0 = f32[ptr++] | 0;
        subImage.vertexCount = f32[ptr++] | 0;
        subImage.vertices = vertexData;
        subImage.indices = indexData;
        img[i] = subImage;
    }
}

export async function loadSpotLightTexture(): Promise<void> {
    const image = await loadImage("spot.png");
    imgSpotLight = createTexture(image.width, image.height);
    imgSpotLight.x_ = 0.5;
    imgSpotLight.y_ = 0.5;
    uploadTexture(imgSpotLight, image, GL.LINEAR);
}
