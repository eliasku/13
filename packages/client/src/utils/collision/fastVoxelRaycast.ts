import {abs, sqrt} from "../math.js";

export interface TraceHit {
    _t: number;
    _x: number;
    _y: number;
    _nx: number;
    _ny: number;
    _dx: number;
    _dy: number;
    _tile: number;
    _traversed: number[];
}

export const TRACE_HIT: TraceHit = {
    _t: 0,
    _x: 0,
    _y: 0,
    _dx: 0,
    _dy: 0,
    _nx: 0,
    _ny: 0,
    _tile: 0,
    _traversed: [],
};
// based on https://github.com/fenomas/fast-voxel-raycast/blob/master/index.js
export const traceRay = (
    tiles: number[],
    tilesRowCount: number,
    x: number,
    y: number,
    dx: number,
    dy: number,
    maxDistance: number,
    hit: TraceHit,
) => {
    hit._t = -1;
    hit._x = 0;
    hit._y = 0;
    hit._nx = 0;
    hit._ny = 0;
    hit._traversed.length = 0;

    const len = sqrt(dx * dx + dy * dy);
    if (len === 0) {
        return -1;
    }
    hit._dx = dx = dx / len;
    hit._dy = dy = dy / len;
    // const px = x / (TILE_SIZE * WORLD_SCALE);
    // const py = y / (TILE_SIZE * WORLD_SCALE);
    // maxDistance /= TILE_SIZE * WORLD_SCALE;

    // consider raycast vector to be parametrized by t
    //   vec = [px,py,pz] + t * [dx,dy,dz]

    // algo below is as described by this paper:
    // http://www.cse.chalmers.se/edu/year/2010/course/TDA361/grid.pdf

    let t = 0.0;
    let ix = x | 0;
    let iy = y | 0;

    const stepx = dx > 0 ? 1 : -1;
    const stepy = dy > 0 ? 1 : -1;

    // dx,dy,dz are already normalized
    const txDelta = abs(1 / dx);
    const tyDelta = abs(1 / dy);

    const xdist = stepx > 0 ? ix + 1 - x : x - ix;
    const ydist = stepy > 0 ? iy + 1 - y : y - iy;

    // location of the nearest voxel boundary, in units of t
    let txMax = isFinite(txDelta) ? txDelta * xdist : maxDistance;
    let tyMax = isFinite(tyDelta) ? tyDelta * ydist : maxDistance;

    let steppedIndex = -1;

    // main loop along raycast vector
    while (t <= maxDistance) {
        // exit check
        const b = ix >= 0 && iy >= 0 && ix < tilesRowCount && iy < tilesRowCount ? tiles[ix + iy * tilesRowCount] : 1;
        hit._traversed.push(ix, iy);
        if (b) {
            hit._tile = b;
            hit._t = t;
            hit._x = x + t * dx;
            hit._y = y + t * dy;
            if (steppedIndex === 0) hit._nx = -stepx;
            if (steppedIndex === 1) hit._ny = -stepy;
            return t;
        }

        // advance t to next nearest voxel boundary
        if (txMax < tyMax) {
            ix += stepx;
            t = txMax;
            txMax += txDelta;
            steppedIndex = 0;
        } else {
            iy += stepy;
            t = tyMax;
            tyMax += tyDelta;
            steppedIndex = 1;
        }
    }

    // no voxel hit found
    hit._x = x + t * dx;
    hit._y = y + t * dy;
    hit._t = t;
    return t;
};
