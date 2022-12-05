import {buildAtlas} from "./generate";
import {AtlasPage} from "./atlas";

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


/// BEGIN
function drawDetails(atlas: AtlasPage) {
    const SCALE = 4;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#abc";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.imageSmoothingEnabled = false;
    const image = atlas.atlas;
    ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, SCALE * image.width, SCALE * image.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 1;
    let totalVerts = atlas.vertices.length;
    let totalTris = atlas.indices.length / 3;
    for (const img of atlas.images) {
        ctx.strokeStyle = "blue";
        ctx.strokeRect(img.tx * SCALE, img.ty * SCALE, img.tw * SCALE, img.th * SCALE);

        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        let index = img.index;
        for (let i = 0; i < img.triangles; ++i) {
            const i0 = atlas.indices[index++];
            const i1 = atlas.indices[index++];
            const i2 = atlas.indices[index++];

            ctx.beginPath();
            ctx.moveTo(SCALE * (atlas.vertices[i0 * 2] + img.tx), SCALE * (atlas.vertices[i0 * 2 + 1] + img.ty));
            ctx.lineTo(SCALE * (atlas.vertices[i1 * 2] + img.tx), SCALE * (atlas.vertices[i1 * 2 + 1] + img.ty));
            ctx.lineTo(SCALE * (atlas.vertices[i2 * 2] + img.tx), SCALE * (atlas.vertices[i2 * 2 + 1] + img.ty));
            ctx.lineTo(SCALE * (atlas.vertices[i0 * 2] + img.tx), SCALE * (atlas.vertices[i0 * 2 + 1] + img.ty));
            ctx.closePath();
            ctx.stroke();
        }

        ctx.fillStyle = "red";
        ctx.fillRect((img.tx + img.x * img.tw) * SCALE,
            (img.ty + img.y * img.th) * SCALE,
            SCALE * 2, SCALE * 2);
    }
    for (const img of atlas.images) {
        ctx.fillStyle = "red";
        ctx.fillRect((img.tx + img.x * img.tw) * SCALE,
            (img.ty + img.y * img.th) * SCALE,
            SCALE * 2, SCALE * 2);
    }

    ctx.font = "48px m";
    ctx.fillStyle = "black";
    ctx.fillText("verts: " + totalVerts + " | tris: " + totalTris, 80, 120);
}

async function start() {
    {
        const font = new FontFace("e", `url(./e.ttf)`);
        await font.load().then(f => document.fonts.add(f));
    }
    {
        const font = new FontFace("m", `url(./m.ttf)`);
        await font.load().then(f => document.fonts.add(f));
    }

    const page = buildAtlas();
    drawDetails(page);
}

start().then();