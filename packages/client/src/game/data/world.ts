import {WORLD_SCALE} from "../../assets/params.js";
import {ActorType} from "../types.js";

export const OBJECT_RADIUS = 10 * WORLD_SCALE;
export const BULLET_RADIUS = 6 * WORLD_SCALE;

export const PLAYER_HANDS_PX_Z = 10;
export const PLAYER_HANDS_Z = PLAYER_HANDS_PX_Z * WORLD_SCALE;

export const ANIM_HIT_OVER = 31;
export const ANIM_HIT_MAX = 15;

export interface ActorProp {
    _radius: number;
    _height: number;
    _groundLoss: number,
    _boundsLoss: number,
    _groundFriction: number,
    _invMass: number;
    _shadowScale: number;
    _shadowAdd: number;
    _shadowColor: number;
    _lightRadiusK: number;
    _light: number;
}

export const actorsConfig: Record<ActorType, ActorProp> = [
    {
        _radius: OBJECT_RADIUS,
        _height: OBJECT_RADIUS + 4 * WORLD_SCALE,
        _groundLoss: 512,
        _boundsLoss: 2,
        _groundFriction: 0,
        _invMass: 1,
        _shadowScale: 1,
        _shadowAdd: 0,
        _shadowColor: 0,
        _lightRadiusK: 4,
        _light: 1,
    },
    {
        _radius: OBJECT_RADIUS,
        _height: OBJECT_RADIUS,
        _groundLoss: 2,
        _boundsLoss: 2,
        _groundFriction: 8,
        _invMass: 1,
        _shadowScale: 1,
        _shadowAdd: 0,
        _shadowColor: 0,
        _lightRadiusK: 0,
        _light: 0,
    },
    {
        _radius: BULLET_RADIUS,
        _height: 0,
        _groundLoss: 512,
        _boundsLoss: 1,
        _groundFriction: 0,
        _invMass: 1,
        _shadowScale: 2,
        _shadowAdd: 1,
        _shadowColor: 0x333333,
        _lightRadiusK: 1,
        _light: 1,
    },
    {
        _radius: OBJECT_RADIUS + 4 * WORLD_SCALE,
        _height: BULLET_RADIUS,
        _groundLoss: 2,
        _boundsLoss: 2,
        _groundFriction: 8,
        _invMass: 1,
        _shadowScale: 1,
        _shadowAdd: 0,
        _shadowColor: 0,
        _lightRadiusK: 1,
        _light: 0.5,
    },
    {
        _radius: OBJECT_RADIUS + 4 * WORLD_SCALE,
        _height: OBJECT_RADIUS + 4 * WORLD_SCALE,
        _groundLoss: 512,
        _boundsLoss: 0,
        _groundFriction: 8,
        _invMass: 0,
        _shadowScale: 1,
        _shadowAdd: 0,
        _shadowColor: 0,
        _lightRadiusK: 0,
        _light: 0,
    }
];
