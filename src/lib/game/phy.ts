import {Actor, ActorType, Pos, Vel} from "./types";
import {rand, random} from "../utils/rnd";
import {reach} from "../utils/math";
import {ControlsFlag} from "./controls";
import {Const} from "./config";

export const GRAVITY = 0x100;
export const GRAVITY_WEAK = 0x80;

export const BOUNDS_SIZE = 0x400;
export const OBJECT_RADIUS = 8;
export const BULLET_RADIUS = 4;
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

export const GROUND_BOUNCE_BY_TYPE = [
    0, -0.5, 0, -0.5, 0,
];

export const GROUND_FRICTION_BY_TYPE = [
    0, 512, 0, 512, 512,
];

export const WALL_BOUNCE_BY_TYPE = [
    0.5, 0.5, 1, 0.5,
];

export function setRandomPosition(actor: Actor): Actor {
    actor.x = OBJECT_RADIUS + rand(BOUNDS_SIZE - OBJECT_RADIUS * 2);
    actor.y = OBJECT_RADIUS + rand(BOUNDS_SIZE - OBJECT_RADIUS * 2);
    return actor;
}

export function copyPosFromActorCenter(to: Pos, from: Actor) {
    to.x = from.x;
    to.y = from.y;
    to.z = from.z + OBJECT_HEIGHT_BY_TYPE[from.type_];
}

export function updateBody(body: Pos & Vel, dt: number, gravity: number, bounce: number) {
    body.x += body.u * dt;
    body.y += body.v * dt;
    body.z += body.w * dt;
    if (body.z > 0) {
        body.w -= gravity * dt;
    } else {
        body.z = 0;
        if (body.w < 0) {
            body.w = (body.w * bounce) | 0;
            return true;
        }
    }
    return false;
}

export function updateAnim(actor: Actor, dt: number) {
    if (actor.animHit_) {
        actor.animHit_ = Math.max(0, actor.animHit_ - 2 * dt * Const.NetFq);
    }
}

export function updateActorPhysics(a: Actor, dt: number) {
    if (a.type_ === ActorType.Bullet) return;
    const isWeakGravity = !a.type_ ? (a.btn_ & ControlsFlag.Jump) : 0;
    updateBody(a, dt, isWeakGravity ? GRAVITY_WEAK : GRAVITY, GROUND_BOUNCE_BY_TYPE[a.type_]);
    collideWithBoundsA(a);
    if (a.z <= 0) {
        applyGroundFriction(a, dt * GROUND_FRICTION_BY_TYPE[a.type_]);
    }
    updateAnim(a, dt);
}

export function collideWithBoundsA(body: Actor): number {
    const bounce = WALL_BOUNCE_BY_TYPE[body.type_];
    const R = OBJECT_RADIUS_BY_TYPE[body.type_];
    return collideWithBounds(body, R, bounce);
}

export function collideWithBounds(body: Vel & Pos, radius: number, bounce: number): number {
    let has = 0;
    if (body.y > BOUNDS_SIZE - radius) {
        body.y = BOUNDS_SIZE - radius;
        has = 1;
        reflectVelocity(body, 0, -1, bounce);
    } else if (body.y < radius) {
        body.y = radius;
        has = 1;
        reflectVelocity(body, 0, 1, bounce);
    }
    if (body.x > BOUNDS_SIZE - radius) {
        body.x = BOUNDS_SIZE - radius;
        has = 1;
        reflectVelocity(body, -1, 0, bounce);
    } else if (body.x < radius) {
        body.x = radius;
        has = 1;
        reflectVelocity(body, 1, 0, bounce);
    }
    return has;
}

export function addRadialVelocity(vel: Vel, velXYLen: number, velZ: number) {
    const a = random(Math.PI * 2);
    addVelocityDir(vel, velXYLen * Math.cos(a), velXYLen * Math.sin(a) / 2, velZ);
}

export function reflectVelocity(v: Vel, nx: number, ny: number, amount: number) {
    // r = d - 2(d⋅n)n
    const Z = 2 * (v.u * nx + v.v * ny);
    v.u = ((v.u - Z * nx) * amount) | 0;
    v.v = ((v.v - Z * ny) * amount) | 0;
}

export function applyGroundFriction(p: Actor, amount: number) {
    let v0 = Math.hypot(p.u, p.v);
    if (v0 > 0) {
        const k = reach(v0, 0, amount) / v0;
        p.u *= k;
        p.v *= k;
    }
}

export function addVelFrom(to: Vel, from: Vel, scale: number = 1) {
    addVelocityDir(to, from.u, from.v, from.w, scale);
}

export function addVelocityDir(v: Vel, x: number, y: number, z: number, scale: number = 1) {
    v.u += scale * x;
    v.v += scale * y;
    v.w += scale * z;
}

export function addPos(to: Pos, x: number, y: number, z: number, scale: number = 1) {
    to.x += scale * x;
    to.y += scale * y;
    to.z += scale * z;
}