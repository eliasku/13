import {WORLD_SCALE} from "../../assets/params";

export const GRAVITY = 5;
export const GRAVITY_WEAK = 3;

export const OBJECT_RADIUS = 10 * WORLD_SCALE;
export const BULLET_RADIUS = 6 * WORLD_SCALE;

export const PLAYER_HANDS_PX_Z = 10;
export const PLAYER_HANDS_Z = PLAYER_HANDS_PX_Z * WORLD_SCALE;
export const JUMP_VEL = 0x50;

export const ANIM_HIT_OVER = 31;
export const ANIM_HIT_MAX = 15;

export const OBJECT_RADIUS_BY_TYPE = [
    OBJECT_RADIUS,
    OBJECT_RADIUS,
    BULLET_RADIUS,
    OBJECT_RADIUS,
    OBJECT_RADIUS + 4 * WORLD_SCALE,
];

export const OBJECT_HEIGHT = [
    OBJECT_RADIUS + 4 * WORLD_SCALE,
    OBJECT_RADIUS,
    0,
    // ITEM
    BULLET_RADIUS,
    OBJECT_RADIUS + 4 * WORLD_SCALE,
];
export const OBJECT_GROUND_LOSS = [512, 2, 512, 2, 512];
export const OBJECT_BOUNDS_LOSS = [2, 2, 1, 2];
export const OBJECT_GROUND_FRICTION = [0, 8, 0, 8, 8];


