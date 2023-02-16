import {WORLD_BOUNDS_SIZE, WORLD_SCALE} from "../assets/params.js";
import {Actor} from "./types.js";
import {max} from "../utils/math.js";

export const GRID_R = 16 * WORLD_SCALE;
export const GRID_D = GRID_R * 2;
export const GRID_STRIDE = WORLD_BOUNDS_SIZE / GRID_D;
export const GRID_D_BITS = 11; //Math.log2(GRID_D);
export const GRID_STRIDE_BITS = 5; //Math.log2(GRID_STRIDE);

// export const gridAddr = (x: number, y: number) =>
//     (x >> GRID_D_BITS) + ((y >> GRID_D_BITS) << GRID_STRIDE_BITS);
//
const NEIGHBOURS = [0, 1, GRID_STRIDE, GRID_STRIDE + 1];

export const addToGrid = (grid: Actor[][], a: Actor) => {
    (grid[(a._x >> GRID_D_BITS) + ((a._y >> GRID_D_BITS) << GRID_STRIDE_BITS)] ??= []).push(a);
};

export const queryGridCollisions = (
    actor: Actor,
    grid: Actor[][],
    callback: (a: Actor, b: Actor) => void,
    disableMask = 1,
) => {
    const cx = max(0, actor._x - GRID_R) >> GRID_D_BITS;
    const cy = max(0, actor._y - GRID_R) >> GRID_D_BITS;
    const h = cx + (cy << GRID_STRIDE_BITS);
    for (let i = 0; i < 4; ++i) {
        const cell = grid[h + NEIGHBOURS[i]];
        if (cell) {
            for (const b of cell) {
                if ((b._localStateFlags | disableMask) & 1) {
                    callback(actor, b);
                }
            }
        }
    }
};
