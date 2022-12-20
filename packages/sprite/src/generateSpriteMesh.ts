import {lerp} from "./scalar";
import {PolylineSet, polylineSetCollectSegment, polylineSimplifyCurves, polylineSimplifyVertexes} from "./polyline";
import {marchHard, marchSoft} from "./march";
import {Vec2, vec2_eq} from "./vec2";
import earcut from "earcut";
import polybool from "polybooljs";

//var buildLog = polybool.buildLog(true)
polybool.epsilon(1e-6);

const pickAlpha = (x: number, y: number, img: ImageData) => {
    if (x < 0 || x >= img.width || y < 0 || y >= img.height) return 0.0;
    return img.data[4 * ((x | 0) + (y | 0) * img.width) + 3] / 255;
}

export const sampleAlpha = (x: number, y: number, img: ImageData) => {
    x -= 0.5;
    y -= 0.5;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = Math.ceil(x);
    const y1 = Math.ceil(y);
    const fx = x - x0;
    const fy = y - y0;
    const p00 = pickAlpha(x0, y0, img);
    const p10 = pickAlpha(x1, y0, img);
    const p01 = pickAlpha(x0, y1, img);
    const p11 = pickAlpha(x1, y1, img);
    const v = lerp(lerp(p00, p10, fx), lerp(p01, p11, fx), fy);
    if (!isFinite(v)) {
        console.error(v);
    }
    return v;
}

const sampleAlphaHard = (x: number, y: number, img: ImageData) => {
    // x -= 0.5;
    // y -= 0.5;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    return pickAlpha(x0, y0, img);
}

export interface MeshSprite {
    indices: number[];
    vertices: number[];
}

/// BEGIN
export function generateMeshSprite(img: ImageData, soft: boolean, subsample: number, tol: number, threshold: number): MeshSprite {
    let polylineSet: PolylineSet = [];
    const marchFn = soft ? marchSoft : marchHard;
    const sample = soft ? sampleAlpha : sampleAlphaHard;
    marchFn({
        l: -0.5 / subsample,
        t: -0.5 / subsample,
        r: img.width + 0.5 / subsample,
        b: img.height + 0.5 / subsample
    }, subsample * (img.width + 1), subsample * (img.height + 1), threshold, (v0: Vec2, v1: Vec2, _: any) => {
        //console.info(v0, v1);
        if (!isFinite(v0.x)) console.error("bad v0.x", v0.x);
        if (!isFinite(v0.y)) console.error("bad v0.y", v0.y);
        if (!isFinite(v1.x)) console.error("bad v1.x", v1.x);
        if (!isFinite(v1.y)) console.error("bad v1.y", v1.y);
        polylineSetCollectSegment(v0, v1, polylineSet);
    }, {}, (point: Vec2, data: any) => {
        return sample(point.x, point.y, data);
    }, img);

    if (tol > 0.0) {
        for (let i = 0; i < polylineSet.length; ++i) {
            const before = polylineSet[i].length;
            if (soft) {
                polylineSet[i] = polylineSimplifyCurves(polylineSet[i], tol);
            } else {
                polylineSet[i] = polylineSimplifyVertexes(polylineSet[i], tol);
            }
            const after = polylineSet[i].length;
            console.info("reduce to " + after, "-" + (before - after));
        }
    }
    polylineSet.forEach(p => {
        if (p.length > 1 && vec2_eq(p[0], p[p.length - 1])) {
            p.pop();
        }
    });
    polylineSet = polylineSet.filter(p => p.length > 1);
    let polygon = {
        regions: polylineSet.map(p => p.map(v => [v.x, v.y])),
        inverted: false
    };

    //console.info(polygon);
    polygon = polybool.polygon(polybool.segments(polygon));
    const data = polybool.polygonToGeoJSON(polygon);

    if (!data.coordinates.length) {
        return {
            indices: [],
            vertices: [],
        };
    }

    const data2 = [];
    if (data.type === "Polygon") {
        data2.push(earcut.flatten(data.coordinates));
    } else {
        for (const coordinates of data.coordinates) {
            data2.push(earcut.flatten(coordinates));
        }
    }

    let vertices: number[] = [];
    const indices: number[] = [];
    for (const d of data2) {
        const subMeshTriangles = earcut(d.vertices, d.holes, d.dimensions);
        const baseIndex = vertices.length / 2;
        for (const tri of subMeshTriangles) {
            indices.push(tri + baseIndex);
        }
        vertices = vertices.concat(d.vertices);
    }

    if (!soft) {
        for (let i = 0; i < vertices.length; ++i) {
            vertices[i] = Math.abs(Math.round(vertices[i]));
        }
    }

    return {
        indices,
        vertices,
    };
}
