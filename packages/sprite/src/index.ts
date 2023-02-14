import {buildAtlas} from "./generate";
import {AtlasPage} from "./atlas";
import {preview2} from "./spr";

const w = document.body.clientWidth;
const h = document.body.clientHeight;
c.width = w * devicePixelRatio;
c.height = h * devicePixelRatio;
c.style.width = w + "px";
c.style.height = h + "px";
const ctx = c.getContext("2d") as CanvasRenderingContext2D;
if (!ctx) {
    throw new Error("unable to create 2d rendering context");
}

/// BEGIN
const drawDetails = (atlas: AtlasPage) => {
    const SCALE = 8;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#abc";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.imageSmoothingEnabled = false;
    const image = atlas.image;
    ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, SCALE * image.width, SCALE * image.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 1;
    const totalVerts = atlas.vertices.length;
    const totalTris = atlas.indices.length / 3;
    for (const img of atlas.images) {
        ctx.strokeStyle = "blue";
        ctx.strokeRect(img.tx * SCALE, img.ty * SCALE, img.tw * SCALE, img.th * SCALE);

        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        let index = img.index0;
        for (let i = 0; i < img.triangles; ++i) {
            const i0 = img.vertex0 + atlas.indices[index++];
            const i1 = img.vertex0 + atlas.indices[index++];
            const i2 = img.vertex0 + atlas.indices[index++];

            ctx.beginPath();
            ctx.moveTo(SCALE * (atlas.vertices[i0 * 2] + img.tx), SCALE * (atlas.vertices[i0 * 2 + 1] + img.ty));
            ctx.lineTo(SCALE * (atlas.vertices[i1 * 2] + img.tx), SCALE * (atlas.vertices[i1 * 2 + 1] + img.ty));
            ctx.lineTo(SCALE * (atlas.vertices[i2 * 2] + img.tx), SCALE * (atlas.vertices[i2 * 2 + 1] + img.ty));
            ctx.lineTo(SCALE * (atlas.vertices[i0 * 2] + img.tx), SCALE * (atlas.vertices[i0 * 2 + 1] + img.ty));
            ctx.closePath();
            ctx.stroke();
        }
    }
    for (const img of atlas.images) {
        ctx.fillStyle = "yellow";
        ctx.fillRect(
            (img.tx + img.x * img.tw) * SCALE - SCALE,
            (img.ty + img.y * img.th) * SCALE - SCALE,
            SCALE * 2,
            SCALE * 2,
        );
        ctx.fillStyle = "black";
        ctx.fillRect(
            (img.tx + img.x * img.tw) * SCALE - SCALE * 0.5,
            (img.ty + img.y * img.th) * SCALE - SCALE * 0.5,
            SCALE,
            SCALE,
        );
    }

    ctx.font = "48px m";
    ctx.fillStyle = "black";
    ctx.fillText("verts: " + totalVerts + " | tris: " + totalTris, 80, 120);
};

const start = async () => {
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
    page.image.toBlob((blob: Blob | null) => {
        if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            document.body.appendChild(a);
            a.href = url;
            a.download = "main.png";
            a.click();
            setTimeout(() => {
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            }, 0);
        }
    }, "png");

    const url = URL.createObjectURL(new Blob([page.data], {type: "application/octet-stream"}));
    const a = document.createElement("a");
    document.body.appendChild(a);
    a.href = url;
    a.download = "main.dat";
    a.click();
    setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }, 0);

    // makeSpotLightTexture();
};

console.info(preview2("🐸", {size: 19}));

start().then();
