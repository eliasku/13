import {Actor, ActorType, Pos, Vel} from "./types";
import {rand, random} from "../utils/rnd";
import {reach} from "../utils/math";
import {ControlsFlag} from "./controls";
import {Const} from "./config";
import {
    GRAVITY,
    GRAVITY_WEAK, GROUND_LOSS_BY_TYPE,
    GROUND_FRICTION_BY_TYPE,
    OBJECT_HEIGHT_BY_TYPE,
    OBJECT_RADIUS, OBJECT_RADIUS_BY_TYPE, WALL_COLLIDE_LOSS_BY_TYPE
} from "./data/world";
import {BOUNDS_SIZE} from "../assets/params";

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

export function updateBody(body: Pos & Vel, dt: number, gravity: number, loss: number) {
    body.x += body.u * dt;
    body.y += body.v * dt;
    body.z += body.w * dt;
    if (body.z > 0) {
        body.w -= gravity * dt;
    } else {
        body.z = 0;
        if (body.w < 0) {
            body.w = -(body.w / loss) | 0;
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
    updateBody(a, dt, isWeakGravity ? GRAVITY_WEAK : GRAVITY, GROUND_LOSS_BY_TYPE[a.type_]);
    collideWithBoundsA(a);
    if (a.z <= 0) {
        applyGroundFriction(a, dt * GROUND_FRICTION_BY_TYPE[a.type_]);
    }
    updateAnim(a, dt);
}

export function collideWithBoundsA(body: Actor): number {
    const loss = WALL_COLLIDE_LOSS_BY_TYPE[body.type_];
    const R = OBJECT_RADIUS_BY_TYPE[body.type_];
    return collideWithBounds(body, R, loss);
}

export function collideWithBounds(body: Vel & Pos, radius: number, loss: number): number {
    let has = 0;
    if (body.y > BOUNDS_SIZE - radius) {
        body.y = BOUNDS_SIZE - radius;
        has = 1;
        reflectVelocity(body, 0, -1, loss);
    } else if (body.y < radius) {
        body.y = radius;
        has = 1;
        reflectVelocity(body, 0, 1, loss);
    }
    if (body.x > BOUNDS_SIZE - radius) {
        body.x = BOUNDS_SIZE - radius;
        has = 1;
        reflectVelocity(body, -1, 0, loss);
    } else if (body.x < radius) {
        body.x = radius;
        has = 1;
        reflectVelocity(body, 1, 0, loss);
    }
    return has;
}

export function addRadialVelocity(vel: Vel, velXYLen: number, velZ: number) {
    const a = random(Math.PI * 2);
    addVelocityDir(vel, velXYLen * Math.cos(a), velXYLen * Math.sin(a) / 2, velZ);
}

export function reflectVelocity(v: Vel, nx: number, ny: number, loss: number) {
    // r = d - 2(d⋅n)n
    const Z = 2 * (v.u * nx + v.v * ny);
    v.u = ((v.u - Z * nx) / loss) | 0;
    v.v = ((v.v - Z * ny) / loss) | 0;
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