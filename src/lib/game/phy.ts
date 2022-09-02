import {Actor, Pos, Vel} from "./types";
import {rand, random} from "../utils/rnd";
import {reach} from "../utils/math";
import {ControlsFlag} from "./controls";
import {Const} from "./config";
import {
    GRAVITY,
    GRAVITY_WEAK,
    OBJECT_BOUNDS_LOSS,
    OBJECT_GROUND_FRICTION,
    OBJECT_GROUND_LOSS,
    OBJECT_HEIGHT,
    OBJECT_RADIUS,
    OBJECT_RADIUS_BY_TYPE
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
    to.z = from.z + OBJECT_HEIGHT[from.type_];
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
    const isWeakGravity = !a.type_ ? (a.btn_ & ControlsFlag.Jump) : 0;
    updateBody(a, dt, isWeakGravity ? GRAVITY_WEAK : GRAVITY, OBJECT_GROUND_LOSS[a.type_]);
    collideWithBoundsA(a);
    if (a.z <= 0) {
        applyGroundFriction(a, dt * OBJECT_GROUND_FRICTION[a.type_]);
    }
    updateAnim(a, dt);
}

export function collideWithBoundsA(body: Actor): number {
    const loss = OBJECT_BOUNDS_LOSS[body.type_];
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

function sqrLength3(x: number, y: number, z: number) {
    return x * x + y * y + z * z;
}

export function testIntersection(a: Actor, b: Actor): boolean {
    const ta = a.type_;
    const tb = b.type_;
    const D = OBJECT_RADIUS_BY_TYPE[ta] + OBJECT_RADIUS_BY_TYPE[tb];
    return sqrLength3(a.x - b.x, a.y - b.y, a.z + OBJECT_HEIGHT[ta] - b.z - OBJECT_HEIGHT[tb]) < D * D;
}

const OBJECT_IMASS = [1, 1, 1, 1, 0];

export function updateBodyCollisions(a: Actor, list: Actor[], ioffset: number) {
    const ra = OBJECT_RADIUS_BY_TYPE[a.type_];
    const ha = OBJECT_HEIGHT[a.type_];
    const ima = OBJECT_IMASS[a.type_];
    for (let j = ioffset; j < list.length; ++j) {
        const b = list[j];
        const bt = b.type_;
        let nx = a.x - b.x;
        let ny = (a.y - b.y) * 2;
        let nz = (a.z + ha) - (b.z + OBJECT_HEIGHT[bt]);
        const sqrDist = sqrLength3(nx, ny, nz);
        const D = ra + OBJECT_RADIUS_BY_TYPE[bt];
        if (sqrDist < D * D && sqrDist > 0) {
            const imb = OBJECT_IMASS[bt];
            const pen = (D / Math.sqrt(sqrDist) - 1) / 2;
            nx *= pen;
            ny *= pen;
            nz *= pen;
            a.x += nx * ima;
            a.y += ny * ima;
            a.z = Math.max(a.z + nz * ima, 0);
            b.x -= nx * imb;
            b.y -= ny * imb;
            b.z = Math.max(b.z - nz * imb, 0);
        }
    }
}

export function roundActors(list:Actor[]) {
    for(const a of list) {
        a.x = ((a.x * 1000) | 0) / 1000;
        a.y = ((a.y * 1000) | 0) / 1000;
        a.z = ((a.z * 1000) | 0) / 1000;
        a.u = ((a.u * 1000) | 0) / 1000;
        a.v = ((a.v * 1000) | 0) / 1000;
        a.w = ((a.w * 1000) | 0) / 1000;
        a.s = ((a.s * 1000) | 0) / 1000;
        a.t = ((a.t * 1000) | 0) / 1000;
    }
}
