import {WORLD_BOUNDS_SIZE_PX} from "../assets/params.js";

export const TILE_SIZE = 16;
export const TILE_SIZE_BITS = 4;
export const TILE_MAP_STRIDE = WORLD_BOUNDS_SIZE_PX >>> TILE_SIZE_BITS;
//export const TILE_MAP_STRIDE_BITS = (WORLD_BOUNDS_SIZE / WORLD_SCALE) >>> TILE_SIZE_BITS;
