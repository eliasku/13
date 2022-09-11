import {Actor, Pos, Vel} from "./types";
import {rand} from "../utils/rnd";
import {M, reach} from "../utils/math";
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

export const setRandomPosition = (actor: Actor) => {
    actor.x_ = OBJECT_RADIUS + rand(BOUNDS_SIZE - OBJECT_RADIUS * 2);
    actor.y_ = OBJECT_RADIUS + rand(BOUNDS_SIZE - OBJECT_RADIUS * 2);
}

export const copyPosFromActorCenter = (to: Pos, from: Actor) => {
    to.x_ = from.x_;
    to.y_ = from.y_;
    to.z_ = from.z_ + OBJECT_HEIGHT[from.type_];
}

export const updateBody = (body: Pos & Vel, gravity: number, loss: number) => {
    addPos(body, body.u_, body.v_, body.w_, 1 / Const.NetFq);
    if (body.z_ > 0) {
        body.w_ -= gravity;
    } else {
        body.z_ = 0;
        if (body.w_ < 0) {
            body.w_ = -(body.w_ / loss) | 0;
            return true;
        }
    }
    return false;
}

export const updateAnim = (actor: Actor) =>
    actor.animHit_ = M.max(0, actor.animHit_ - 2);

export const updateActorPhysics = (a: Actor) => {
    const isWeakGravity = a.type_ ? 0 : (a.btn_ & ControlsFlag.Jump);
    updateBody(a, isWeakGravity ? GRAVITY_WEAK : GRAVITY, OBJECT_GROUND_LOSS[a.type_]);
    collideWithBoundsA(a);
    if (a.z_ <= 0) {
        applyGroundFriction(a, OBJECT_GROUND_FRICTION[a.type_]);
    }
    updateAnim(a);
}

export const collideWithBoundsA = (body: Actor): number =>
    collideWithBounds(body, OBJECT_RADIUS_BY_TYPE[body.type_], OBJECT_BOUNDS_LOSS[body.type_]);

export const collideWithBounds = (body: Vel & Pos, radius: number, loss: number): number => {
    let has = 0;
    if (body.y_ > BOUNDS_SIZE - radius) {
        body.y_ = BOUNDS_SIZE - radius;
        has = 1;
        reflectVelocity(body, 0, -1, loss);
    } else if (body.y_ < radius) {
        body.y_ = radius;
        has = 1;
        reflectVelocity(body, 0, 1, loss);
    }
    if (body.x_ > BOUNDS_SIZE - radius) {
        body.x_ = BOUNDS_SIZE - radius;
        has = 1;
        reflectVelocity(body, -1, 0, loss);
    } else if (body.x_ < radius) {
        body.x_ = radius;
        has = 1;
        reflectVelocity(body, 1, 0, loss);
    }
    return has;
}

export const addRadialVelocity = (vel: Vel, a: number, velXYLen: number, velZ: number) =>
    addVelocityDir(vel, velXYLen * M.cos(a), velXYLen * M.sin(a) / 2, velZ);

export const reflectVelocity = (v: Vel, nx: number, ny: number, loss: number) => {
    // r = d - 2(d⋅n)n
    const Z = 2 * (v.u_ * nx + v.v_ * ny);
    v.u_ = ((v.u_ - Z * nx) / loss) | 0;
    v.v_ = ((v.v_ - Z * ny) / loss) | 0;
}

export const applyGroundFriction = (p: Actor, amount: number) => {
    let v0 = p.u_ * p.u_ + p.v_ * p.v_;
    if (v0 > 0) {
        v0 = M.sqrt(v0);
        const k = reach(v0, 0, amount) / v0;
        p.u_ *= k;
        p.v_ *= k;
    }
}

export const addVelFrom = (to: Vel, from: Vel, scale: number = 1) =>
    addVelocityDir(to, from.u_, from.v_, from.w_, scale);

export const addVelocityDir = (v: Vel, x: number, y: number, z: number, scale: number = 1) => {
    v.u_ += scale * x;
    v.v_ += scale * y;
    v.w_ += scale * z;
}

export const addPos = (to: Pos, x: number, y: number, z: number, scale: number = 1) => {
    to.x_ += scale * x;
    to.y_ += scale * y;
    to.z_ += scale * z;
}

export const sqrLength3 = (x: number, y: number, z: number) => x * x + y * y + z * z;

export const testIntersection = (a: Actor, b: Actor): boolean => {
    const ta = a.type_;
    const tb = b.type_;
    const D = OBJECT_RADIUS_BY_TYPE[ta] + OBJECT_RADIUS_BY_TYPE[tb];
    return sqrLength3(a.x_ - b.x_, a.y_ - b.y_, a.z_ + OBJECT_HEIGHT[ta] - b.z_ - OBJECT_HEIGHT[tb]) < D * D;
}

const OBJECT_IMASS = [1, 1, 1, 1, 0];

export const updateBodyCollisions = (a: Actor, list: Actor[], ioffset: number) => {
    const ra = OBJECT_RADIUS_BY_TYPE[a.type_];
    const ha = OBJECT_HEIGHT[a.type_];
    const ima = OBJECT_IMASS[a.type_];
    for (let j = ioffset; j < list.length; ++j) {
        const b = list[j];
        const bt = b.type_;
        let nx = a.x_ - b.x_;
        let ny = (a.y_ - b.y_) * 2;
        let nz = (a.z_ + ha) - (b.z_ + OBJECT_HEIGHT[bt]);
        const sqrDist = sqrLength3(nx, ny, nz);
        const D = ra + OBJECT_RADIUS_BY_TYPE[bt];
        if (sqrDist < D * D && sqrDist > 0) {
            const pen = (D / M.sqrt(sqrDist) - 1) / 2;
            addPos(a, nx, ny, nz, ima * pen);
            addPos(b, nx, ny, nz, -OBJECT_IMASS[bt] * pen);
        }
    }
}

export const testRayWithSphere = (from: Actor, target: Actor, dx: number, dy: number): boolean => {
    const R = OBJECT_RADIUS_BY_TYPE[target.type_];
    const fromZ = from.z_;
    const targetZ = target.z_ + OBJECT_HEIGHT[target.type_];
    let Lx = target.x_ - from.x_;
    let Ly = target.y_ - from.y_;
    let Lz = targetZ - fromZ;
    const len = Lx * dx + Ly * dy;
    if (len < 0) return false;

    Lx = from.x_ + dx * len;
    Ly = from.y_ + dy * len;
    Lz = fromZ;
    const dSq = sqrLength3(target.x_ - Lx, target.y_ - Ly, targetZ - Lz);
    const rSq = R * R;
    return dSq <= rSq;
}

const f_16_16 = (x: number): number => ((x * Const.NetPrecision) | 0) / Const.NetPrecision;

export const roundActors = (list: Actor[]) => {
    for (const a of list) {
        a.x_ = f_16_16(a.x_);
        a.y_ = f_16_16(a.y_);
        a.z_ = f_16_16(a.z_);
        a.u_ = f_16_16(a.u_);
        a.v_ = f_16_16(a.v_);
        a.w_ = f_16_16(a.w_);
        a.s_ = f_16_16(a.s_);
        a.t_ = f_16_16(a.t_);
    }
}
