import {WORLD_SCALE} from "../../assets/params";
import {ActorType} from "../types";

export const OBJECT_RADIUS = 10 * WORLD_SCALE;
export const BULLET_RADIUS = 6 * WORLD_SCALE;

export const PLAYER_HANDS_PX_Z = 10;
export const PLAYER_HANDS_Z = PLAYER_HANDS_PX_Z * WORLD_SCALE;

export const ANIM_HIT_OVER = 31;
export const ANIM_HIT_MAX = 15;

export interface ActorProp {
    radius: number;
    height: number;
    groundLoss: number,
    boundsLoss: number,
    groundFriction: number,
    imass: number;
    shadowScale: number;
    shadowAdd: number;
    shadowColor: number;
    lightRadiusK: number;
    light: number;
}

export const actorsConfig: Record<ActorType, ActorProp> = [
    {
        radius: OBJECT_RADIUS,
        height: OBJECT_RADIUS + 4 * WORLD_SCALE,
        groundLoss: 512,
        boundsLoss: 2,
        groundFriction: 0,
        imass: 1,
        shadowScale: 1,
        shadowAdd: 0,
        shadowColor: 0,
        lightRadiusK: 4,
        light: 1,
    },
    {
        radius: OBJECT_RADIUS,
        height: OBJECT_RADIUS,
        groundLoss: 2,
        boundsLoss: 2,
        groundFriction: 8,
        imass: 1,
        shadowScale: 1,
        shadowAdd: 0,
        shadowColor: 0,
        lightRadiusK: 0,
        light: 0,
    },
    {
        radius: BULLET_RADIUS,
        height: 0,
        groundLoss: 512,
        boundsLoss: 1,
        groundFriction: 0,
        imass: 1,
        shadowScale: 2,
        shadowAdd: 1,
        shadowColor: 0x333333,
        lightRadiusK: 1,
        light: 1,
    },
    {
        radius: OBJECT_RADIUS + 4 * WORLD_SCALE,
        height: BULLET_RADIUS,
        groundLoss: 2,
        boundsLoss: 2,
        groundFriction: 8,
        imass: 1,
        shadowScale: 1,
        shadowAdd: 0,
        shadowColor: 0,
        lightRadiusK: 1,
        light: 0.5,
    },
    {
        radius: OBJECT_RADIUS + 4 * WORLD_SCALE,
        height: OBJECT_RADIUS + 4 * WORLD_SCALE,
        groundLoss: 512,
        boundsLoss: 0,
        groundFriction: 8,
        imass: 0,
        shadowScale: 1,
        shadowAdd: 0,
        shadowColor: 0,
        lightRadiusK: 0,
        light: 0,
    }
];
