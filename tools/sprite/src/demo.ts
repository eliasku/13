import {preview2} from "./spr";
import {lerp} from "./scalar";
import {sin} from "../../../client/src/utils/math";
import {generateMeshSprite} from "./generateSpriteMesh";

function waitNextFrame() {
    return new Promise((resolve) => {
        requestAnimationFrame(resolve);
    });
}

const w = document.body.clientWidth;
const h = document.body.clientHeight;
c.width = w * devicePixelRatio;
c.height = h * devicePixelRatio;
c.style.width = w + "px";
c.style.height = h + "px";
const ctx = c.getContext("2d");


// const image = document.createElement("canvas");
// image.width = image.height = 128;
let image: HTMLCanvasElement = null;
let imageData: ImageData = null;

// const image2 = document.createElement("canvas");
// image2.width = image2.height = 128;
// let image2Data: ImageData = null;

function init() {
    // 🦌🐭
    const emoji = "🐭";
    image = preview2(emoji, {cut: 1});
    const imageCtx = image.getContext("2d");
    imageData = imageCtx.getImageData(0, 0, image.width, image.height);

    // const image2Ctx = image2.getContext("2d");
    // image2Ctx.font = "100px e";
    // image2Ctx.fillText(emoji, 10, 110);
    // image2Data = image2Ctx.getImageData(0, 0, image2.width, image2.height);
    // const image2Pixels = image2Data.data;
    // for (let i2 = 3; i2 < image2Pixels.length; i2 += 4) {
    //     image2Pixels[i2] = image2Pixels[i2] < 20 ? 0 : 255;
    // }
    // image2Ctx.putImageData(image2Data, 0, 0);
}

/// BEGIN
function drawMarch(soft: boolean, subsample: number, tol: number, threshold: number) {
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, 8 * image.width, 8 * image.height);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 4;

    const data = generateMeshSprite(imageData, soft, subsample, tol, threshold);

    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    let totalVerts = data.vertices.length;
    let totalTris = data.indices.length / 3;
    for (let i = 0; i < data.indices.length; i += 3) {
        ctx.beginPath();
        const i0 = data.indices[i];
        const i1 = data.indices[i + 1];
        const i2 = data.indices[i + 2];

        ctx.moveTo(8 * data.vertices[i0 * 2], 8 * data.vertices[i0 * 2 + 1]);
        ctx.lineTo(8 * data.vertices[i1 * 2], 8 * data.vertices[i1 * 2 + 1]);
        ctx.lineTo(8 * data.vertices[i2 * 2], 8 * data.vertices[i2 * 2 + 1]);
        ctx.lineTo(8 * data.vertices[i0 * 2], 8 * data.vertices[i0 * 2 + 1]);
        ctx.stroke();
    }

    ctx.font = "48px monospace";
    ctx.fillStyle = "black";
    ctx.fillText("verts: " + totalVerts + " | tris: " + totalTris, 80, 120);
}

async function start() {
    const font = new FontFace("e", `url(./e.ttf)`);
    await font.load().then(f => document.fonts.add(f));

    init();

    for (let i = 0; i < 200; ++i) {
        await waitNextFrame();
        const t = i / 200;
        drawMarch(true, lerp(0.04, 1, t * t), 0, 0.99);
        ctx.fillText("MARCHING " + ((t * t * 100 + 1) | 0) + " %", 80, 80);
    }
    for (let i = 0; i < 30; ++i) {
        await waitNextFrame();
    }
    for (let i = 0; i < 200; ++i) {
        await waitNextFrame();
        let t = i / 200;
        drawMarch(true, 1, lerp(0, 1, t * t), 0.99);
        ctx.fillText("REDUCTION " + ((t * t * 100 + 1) | 0) + " %", 80, 80);
    }
    for (let i = 0; i < 30; ++i) {
        await waitNextFrame();
    }
    for (let i = 0; i < 200; ++i) {
        await waitNextFrame();
        let t = i / 200;
        drawMarch(true, 1, 1, 0.5 + 0.5 * sin(t * 8));
        ctx.fillText("THRESHOLD " + ((t * t * 100 + 1) | 0) + " %", 80, 80);
    }
}

start().then();