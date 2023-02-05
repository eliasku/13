import {createTexture, getSubTexture, Texture, uploadTexture} from "../graphics/draw2d.js";
import {GL} from "../graphics/gl.js";
import {loadArrayBuffer, loadImage} from "../graphics/utils.js";

export const EMOJI: Record<number, string> = [
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    "🔪",
    "🪓",
    "🔫",
    "🖊️",
    "✏️️",
    "🪥",
    "⛏",
    "🔌",
    "🧵",
    "💀",
    "👹",
    "🤡",
    "🤖",
    "🎃",
    "🦝",
    "🐙",
    "🐰",
    "🦌",
    "🐺",
    "🐵",
    "🦊",
    "🐭",
    "🦍",
    "🍅",
    "😐",
    "🐷",
    "🧑‍🎄",
    "🎅🏻",
    "🎅🏼",
    "🎅🏾",
    "🎅",
    "🛢",
    "📦",
    "🪦",
    "❤️",
    "💊",
    "🪙",
    "💎",
    "🛡",
    "🧱",
    "🌳",
    "🌲",
    "🌵",
    "🌴",
    "🎄",
    "⛄",
    "🥓",
    "🦴",
];

export const img: Texture[] = [];
export let imgSpotLight: Texture | undefined;

export async function loadMainAtlas(): Promise<void> {
    const [image, buffer] = await Promise.all([loadImage("main.png"), loadArrayBuffer("main.dat")]);
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
            f32[ptr++],
        );
        subImage._index0 = f32[ptr++] | 0;
        subImage._triangles = f32[ptr++] | 0;
        subImage._vertex0 = f32[ptr++] | 0;
        subImage._vertexCount = f32[ptr++] | 0;
        subImage._vertices = vertexData;
        subImage._indices = indexData;
        img[i] = subImage;
    }
}

export async function loadSpotLightTexture(): Promise<void> {
    const image = await loadImage("spot.png");
    imgSpotLight = createTexture(image.width, image.height);
    imgSpotLight._x = 0.5;
    imgSpotLight._y = 0.5;
    uploadTexture(imgSpotLight, image, GL.LINEAR);
}
