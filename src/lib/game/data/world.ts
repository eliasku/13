export const GRAVITY = 0x100;
export const GRAVITY_WEAK = 0x80;

export const OBJECT_RADIUS = 8;
export const BULLET_RADIUS = 4;

export const PLAYER_HANDS_Z = 10;
export const JUMP_VEL = 0x50;

export const ANIM_HIT_OVER = 31;
export const ANIM_HIT_MAX = 15;

export const enum ObjectField {
    Radius,
    Height,
    GroundLoss,
    GroundFriction,
    WallLoss,
    ShadowScale,
    ShadowAdd,
    ShadowColor
}

export const OBJECT_RADIUS_BY_TYPE =
    [
        OBJECT_RADIUS,
        OBJECT_RADIUS,
        BULLET_RADIUS,
        OBJECT_RADIUS,
        OBJECT_RADIUS + OBJECT_RADIUS / 2,
    ];
export const OBJECT_HEIGHT = [
    OBJECT_RADIUS + OBJECT_RADIUS / 2,
    OBJECT_RADIUS,
    0,
    0,
    OBJECT_RADIUS * 2,
];
export const OBJECT_GROUND_LOSS = [512, 2, 512, 2, 512];
export const OBJECT_BOUNDS_LOSS = [2, 2, 1, 2];
export const OBJECT_GROUND_FRICTION = [0, 512, 0, 512, 512];


