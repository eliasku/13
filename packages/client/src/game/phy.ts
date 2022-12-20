import {Actor, Pos, Vel} from "./types";
import {rand} from "../utils/rnd";
import {clamp, cos, reach, sin, sqrt} from "../utils/math";
import {ControlsFlag} from "./controls";
import {actorsConfig, OBJECT_RADIUS} from "./data/world";
import {WORLD_BOUNDS_SIZE} from "../assets/params";
import {GAME_CFG} from "./config";

export const setRandomPosition = (actor: Actor) => {
    actor.x_ = OBJECT_RADIUS + rand(WORLD_BOUNDS_SIZE - OBJECT_RADIUS * 2);
    actor.y_ = OBJECT_RADIUS + rand(WORLD_BOUNDS_SIZE - OBJECT_RADIUS * 2);
}

export const copyPosFromActorCenter = (to: Pos, from: Actor) => {
    to.x_ = from.x_;
    to.y_ = from.y_;
    to.z_ = from.z_ + actorsConfig[from.type_].height;
}

export const updateBody = (body: Pos & Vel, gravity: number, loss: number) => {
    addPos(body, body.u_, body.v_, body.w_);
    if (body.z_ > 0) {
        body.w_ -= gravity;
    } else {
        body.z_ = 0;
        if (body.w_ < 0) {
            body.w_ = -body.w_ / loss;
            return true;
        }
    }
    return false;
}

export const updateAnim = (actor: Actor) => {
    actor.animHit_ = reach(actor.animHit_, 0, 2);
}

export const updateActorPhysics = (a: Actor) => {
    const prop = actorsConfig[a.type_];
    const world = GAME_CFG.world;
    const isWeakGravity = a.type_ ? 0 : (a.btn_ & ControlsFlag.Jump);
    updateBody(a, isWeakGravity ? world.gravityWeak : world.gravity, prop.groundLoss);
    collideWithBoundsA(a);
    if (a.z_ <= 0) {
        applyGroundFriction(a, prop.groundFriction);
    }
    updateAnim(a);
}

export const collideWithBoundsA = (body: Actor): number => {
    const props = actorsConfig[body.type_];
    return collideWithBounds(body, props.radius, props.boundsLoss);
}

export const collideWithBounds = (body: Vel & Pos, radius: number, loss: number): number => {
    let has = 0;
    if (body.y_ > WORLD_BOUNDS_SIZE - radius) {
        body.y_ = WORLD_BOUNDS_SIZE - radius;
        has |= 2;
        reflectVelocity(body, 0, 1, loss);
    } else if (body.y_ < radius) {
        body.y_ = radius;
        has |= 2;
        reflectVelocity(body, 0, 1, loss);
    }
    if (body.x_ > WORLD_BOUNDS_SIZE - radius) {
        body.x_ = WORLD_BOUNDS_SIZE - radius;
        has |= 4;
        reflectVelocity(body, 1, 0, loss);
    } else if (body.x_ < radius) {
        body.x_ = radius;
        has |= 4;
        reflectVelocity(body, 1, 0, loss);
    }
    return has;
}

export const addRadialVelocity = (vel: Vel, a: number, velXYLen: number, velZ: number) => {
    addVelocityDir(vel, velXYLen * cos(a), velXYLen * sin(a) / 2, velZ);
}

export const reflectVelocity = (v: Vel, nx: number, ny: number, loss: number) => {
    // r = d - 2(d⋅n)n
    const Z = 2 * (v.u_ * nx + v.v_ * ny);
    v.u_ = (v.u_ - Z * nx) / loss;
    v.v_ = (v.v_ - Z * ny) / loss;
}

export const limitVelocity = (v: Vel, len: number) => {
    let l = v.u_ * v.u_ + v.v_ * v.v_;
    if (l > len * len) {
        l = len / sqrt(l);
        v.u_ *= l;
        v.v_ *= l;
    }
}

export const applyGroundFriction = (p: Actor, amount: number) => {
    let v0 = p.u_ * p.u_ + p.v_ * p.v_;
    if (v0 > 0) {
        v0 = sqrt(v0);
        v0 = reach(v0, 0, amount) / v0;
        p.u_ *= v0;
        p.v_ *= v0;
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
export const sqrDistXY = (a: Actor, b: Actor) => {
    const dx = a.x_ - b.x_;
    const dy = a.y_ - b.y_;
    return dx * dx + dy * dy;
}

export const testIntersection = (a: Actor, b: Actor): boolean => {
    const ca = actorsConfig[a.type_];
    const cb = actorsConfig[b.type_];
    const D = ca.radius + cb.radius;
    return sqrLength3(a.x_ - b.x_, a.y_ - b.y_, a.z_ + ca.height - b.z_ - cb.height) < D * D;
}

export const checkBodyCollision = (a: Actor, b: Actor) => {
    const ca = actorsConfig[a.type_];
    const cb = actorsConfig[b.type_];
    let nx = a.x_ - b.x_;
    let ny = (a.y_ - b.y_) * 2;
    let nz = (a.z_ + ca.height) - (b.z_ + cb.height);
    const sqrDist = sqrLength3(nx, ny, nz);
    const D = ca.radius + cb.radius;
    if (sqrDist > 0 && sqrDist < D * D) {
        const pen = (D / sqrt(sqrDist) - 1) / 2;
        addPos(a, nx, ny, nz, ca.imass * pen);
        addPos(b, nx, ny, nz, -cb.imass * pen);
    }
};

export const testRayWithSphere = (from: Actor, target: Actor, dx: number, dy: number): boolean => {
    const Lx = target.x_ - from.x_;
    const Ly = target.y_ - from.y_;
    const len = Lx * dx + Ly * dy;
    const props = actorsConfig[target.type_];
    const R = props.radius;
    return len >= 0 &&
        sqrLength3(Lx - dx * len, Ly - dy * len, target.z_ + props.height - from.z_) <= R * R;
}

export const roundActors = (list: Actor[]) => {
    for (const a of list) {
        a.x_ = a.x_ & 0xFFFF;
        a.y_ = a.y_ & 0xFFFF;
        a.z_ = clamp(a.z_ | 0, 0, (1 << 16) - 1) & 0xFFFF;
        a.u_ = clamp(a.u_ | 0, -1024, 1024);
        a.v_ = clamp(a.v_ | 0, -1024, 1024);
        a.w_ = clamp(a.w_ | 0, -1024, 1024);
    }
}
