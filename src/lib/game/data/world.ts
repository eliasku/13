
export const GRAVITY = 0x100;
export const GRAVITY_WEAK = 0x80;

export const OBJECT_RADIUS = 8;
export const BULLET_RADIUS = 4;

export const PLAYER_HANDS_Z = 10;
export const JUMP_VEL = 0x50;

export const ANIM_HIT_OVER = 31;
export const ANIM_HIT_MAX = 15;


export const enum ObjectProp {

}
// Player = 0,
//     Barrel = 1,
//     Bullet = 2,
//     Item = 3,
//     // static game objects
//     Tree = 4,
export const OBJECT_RADIUS_BY_TYPE = [
    OBJECT_RADIUS,
    OBJECT_RADIUS,
    BULLET_RADIUS,
    OBJECT_RADIUS,
    OBJECT_RADIUS + OBJECT_RADIUS / 2,
];

export const OBJECT_HEIGHT_BY_TYPE = [
    OBJECT_RADIUS + OBJECT_RADIUS / 2,
    OBJECT_RADIUS,
    0,
    0,
    OBJECT_RADIUS * 2,
];

export const GROUND_LOSS_BY_TYPE = [512, 2, 512, 2, 512];
export const GROUND_FRICTION_BY_TYPE = [0, 512, 0, 512, 512];
export const WALL_COLLIDE_LOSS_BY_TYPE = [2, 2, 1, 2];
export const SHADOW_SCALE_BY_TYPE = [1, 1, 2, 1];
export const SHADOW_ADD_BY_TYPE = [0, 0, 1, 0];
export const SHADOW_COLOR_BY_TYPE = [0, 0, 0x333333, 0];

