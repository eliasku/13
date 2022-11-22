import earcut from "earcut";
import polybool from "polybooljs";
import {flerp, marchHard, marchSoft} from "./march";
import {Vec2} from "./vec2";
import {PolylineSet, polylineSetCollectSegment, polylineSimplifyCurves, polylineSimplifyVertexes} from "./polyline";
import {preview2} from "./spr";

function waitNextFrame() {
    return new Promise((resolve) => {
        requestAnimationFrame(resolve);
    });
}

//var buildLog = polybool.buildLog(true)
polybool.epsilon(1e-6);

const w = document.body.clientWidth;
const h = document.body.clientHeight;
c.width = w * devicePixelRatio;
c.height = h * devicePixelRatio;
c.style.width = w + "px";
c.style.height = h + "px";
const ctx = c.getContext("2d");

const pickAlpha = (x: number, y: number, data: ImageData) => {
    if (x < 0 || x >= data.width || y < 0 || y >= data.height) return 0.0;
    return imageData.data[4 * ((x | 0) + (y | 0) * data.width) + 3] / 255;
}

const sampleAlpha = (x: number, y: number, data: ImageData) => {
    x -= 0.5;
    y -= 0.5;
    const x0 = x | 0;
    const y0 = y | 0;
    const x1 = Math.ceil(x);
    const y1 = Math.ceil(y);
    const fx = x - x0;
    const fy = y - y0;
    const p00 = pickAlpha(x0, y0, data);
    const p10 = pickAlpha(x1, y0, data);
    const p01 = pickAlpha(x0, y1, data);
    const p11 = pickAlpha(x1, y1, data);
    const v = flerp(flerp(p00, p10, fx), flerp(p01, p11, fx), fy);
    if (!isFinite(v)) {
        console.error(v);
    }
    return v;
}

// const image = document.createElement("canvas");
// image.width = image.height = 128;
let image: HTMLCanvasElement = null;
let imageData: ImageData = null;

// const image2 = document.createElement("canvas");
// image2.width = image2.height = 128;
// let image2Data: ImageData = null;

function init() {
    // 🦌🐭
    const emoji = "🦌";
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
function drawMarch(subsample: number, tol: number) {
    let polylineSet: PolylineSet = [];
    marchSoft({
        // marchHard({
        l: 0,
        t: 0,
        r: image.width,
        b: image.height
    }, subsample * image.width, subsample * image.height, 0.99, (v0: Vec2, v1: Vec2, data: any) => {
        //console.info(v0, v1);
        if (!isFinite(v0.x)) console.error("bad v0.x", v0.x);
        if (!isFinite(v0.y)) console.error("bad v0.y", v0.y);
        if (!isFinite(v1.x)) console.error("bad v1.x", v1.x);
        if (!isFinite(v1.y)) console.error("bad v1.y", v1.y);
        polylineSetCollectSegment(v0, v1, polylineSet);
    }, {}, (point: Vec2, data: any) => {
        return sampleAlpha(point.x, point.y, data);
    }, imageData);

    if (tol > 0) {
        for (let i = 0; i < polylineSet.length; ++i) {
            const before = polylineSet[i].length;
            polylineSet[i] = polylineSimplifyCurves(polylineSet[i], tol);
            // polylineSet[i] = polylineSimplifyVertexes(polylineSet[i], tol);
            const after = polylineSet[i].length;
            console.info("reduce to " + after, "-" + (before - after));
        }
    }
    polylineSet.forEach(p => p.pop());
    polylineSet = polylineSet.filter(p => p.length > 1);
    let polygon = {
        regions: polylineSet.map(p => p.map(v => [v.x, v.y])),
        inverted: false
    };

    console.info(polygon);
    polygon = polybool.polygon(polybool.segments(polygon));
    const data = polybool.polygonToGeoJSON(polygon);

    if (!data.coordinates.length) return;
    console.info(data);
    const data2 = [];
    if (data.type === "Polygon") {
        data2.push(earcut.flatten(data.coordinates));
    } else {
        for (const coordinates of data.coordinates) {
            data2.push(earcut.flatten(coordinates));
        }
    }

    // const data2 = [earcut.flatten(data.coordinates)];

    console.info(data2);
    const triangles = [];
    for (const d of data2) {
        triangles.push(earcut(d.vertices, d.holes, d.dimensions));
    }

    ctx.clearRect(0, 0, c.width, c.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, 8 * image.width, 8 * image.height);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 4;

    console.info("triangles:", triangles);
    ctx.fillStyle = "green";
    for (let polyline of polylineSet) {
        for (let i = 0; i < polyline.length - 1; ++i) {
            ctx.strokeStyle = i % 2 ? "black" : "red";
            ctx.beginPath();
            ctx.moveTo(8 * polyline[i].x, 8 * polyline[i].y);
            ctx.lineTo(8 * polyline[i + 1].x, 8 * polyline[i + 1].y);
            ctx.stroke();

            // ctx.fillRect(8 * polyline[i].x - 2, 8 * polyline[i].y - 2, 4, 4);
        }
    }

    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    let totalVerts = 0;
    let totalTris = 0;
    for (let i = 0; i < triangles.length; ++i) {
        const tri = triangles[i];
        const vertices = data2[i].vertices;
        totalVerts += data2[i].vertices.length;
        for (let j = 0; j < tri.length; j += 3) {
            ctx.beginPath();
            const i0 = tri[j];
            const i1 = tri[j + 1];
            const i2 = tri[j + 2];

            ctx.moveTo(8 * vertices[i0 * 2], 8 * vertices[i0 * 2 + 1]);
            ctx.lineTo(8 * vertices[i1 * 2], 8 * vertices[i1 * 2 + 1]);
            ctx.lineTo(8 * vertices[i2 * 2], 8 * vertices[i2 * 2 + 1]);
            ctx.lineTo(8 * vertices[i0 * 2], 8 * vertices[i0 * 2 + 1]);
            ctx.stroke();

            totalTris++;
        }
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
        drawMarch(flerp(0.04, 1, t * t), 0);
        ctx.fillText("MARCHING " + ((t * t * 100 + 1) | 0) + " %", 80, 80);
    }
    for (let i = 0; i < 30; ++i) {
        await waitNextFrame();
    }
    for (let i = 0; i < 200; ++i) {
        await waitNextFrame();
        let t = i / 200;
        drawMarch(1, flerp(0, 1, t * t));
        ctx.fillText("REDUCTION " + ((t * t * 100 + 1) | 0) + " %", 80, 80);
    }
}

start().then();