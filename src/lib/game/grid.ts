import {WORLD_BOUNDS_SIZE, WORLD_SCALE} from "../assets/params";
import {Actor} from "./types";

export const GRID_R = 16 * WORLD_SCALE;
export const GRID_D = GRID_R * 2;
export const GRID_STRIDE = WORLD_BOUNDS_SIZE / GRID_D;
export const GRID_D_BITS = 11;//Math.log2(GRID_D);
export const GRID_STRIDE_BITS = 5;//Math.log2(GRID_STRIDE);

// export const gridAddr = (x: number, y: number) =>
//     (x >> GRID_D_BITS) + ((y >> GRID_D_BITS) << GRID_STRIDE_BITS);
//
const NEIGHBOURS = [0, 1, GRID_STRIDE, GRID_STRIDE + 1];

export const addToGrid = (grid: Actor[][], a: Actor) => {
    (grid[(a.x_ >> GRID_D_BITS) + ((a.y_ >> GRID_D_BITS) << GRID_STRIDE_BITS)] ??= []).push(a);
}

export const queryGridCollisions = (actor: Actor, grid: Actor[][], callback: (a: Actor, b: Actor) => void, disableMask: number = 1) => {
    let cx = (actor.x_ - GRID_R) >> GRID_D_BITS;
    let cy = (actor.y_ - GRID_R) >> GRID_D_BITS;
    if (cx < 0) cx = 0;
    if (cy < 0) cy = 0;
    let h = (cy << GRID_STRIDE_BITS) + cx;
    for (let i = 0; i < 4; ++i) {
        const cell = grid[h + NEIGHBOURS[i]];
        if (cell) {
            for (const b of cell) {
                if ((b.fstate_ | disableMask) & 1) {
                    callback(actor, b);
                }
            }
        }
    }
}
