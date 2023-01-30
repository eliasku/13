import {Actor, ActorType, ControlsFlag, PlayerActor, Pos, Vel} from "./types";
import {rand} from "../utils/rnd";
import {clamp, cos, reach, sin, sqrt} from "../utils/math";
import {actorsConfig, OBJECT_RADIUS} from "./data/world";
import {WORLD_BOUNDS_SIZE} from "../assets/params";
import {GAME_CFG} from "./config";

export const setRandomPosition = (actor: Actor) => {
    actor._x = OBJECT_RADIUS + rand(WORLD_BOUNDS_SIZE - OBJECT_RADIUS * 2);
    actor._y = OBJECT_RADIUS + rand(WORLD_BOUNDS_SIZE - OBJECT_RADIUS * 2);
}

export const copyPosFromActorCenter = (to: Pos, from: Actor) => {
    to._x = from._x;
    to._y = from._y;
    to._z = from._z + actorsConfig[from._type]._height;
}

export const updateBody = (body: Pos & Vel, gravity: number, loss: number) => {
    addPos(body, body._u, body._v, body._w);
    if (body._z > 0) {
        body._w -= gravity;
    } else {
        body._z = 0;
        if (body._w < 0) {
            body._w = -body._w / loss;
            return true;
        }
    }
    return false;
}

export const updateAnim = (actor: Actor) => {
    actor._animHit = reach(actor._animHit, 0, 2);
}

export const updateActorPhysics = (a: Actor) => {
    const prop = actorsConfig[a._type];
    const world = GAME_CFG._world;
    const isWeakGravity = a._type === ActorType.Player ? ((a as PlayerActor)._input & ControlsFlag.Jump) : 0;
    updateBody(a, isWeakGravity ? world._gravityWeak : world._gravity, prop._groundLoss);
    collideWithBoundsA(a);
    if (a._z <= 0) {
        applyGroundFriction(a, prop._groundFriction);
    }
    updateAnim(a);
}

export const collideWithBoundsA = (body: Actor): number => {
    const props = actorsConfig[body._type];
    return collideWithBounds(body, props._radius, props._boundsLoss);
}

export const collideWithBounds = (body: Vel & Pos, radius: number, loss: number): number => {
    let has = 0;
    if (body._y > WORLD_BOUNDS_SIZE - radius) {
        body._y = WORLD_BOUNDS_SIZE - radius;
        has |= 2;
        reflectVelocity(body, 0, 1, loss);
    } else if (body._y < radius) {
        body._y = radius;
        has |= 2;
        reflectVelocity(body, 0, 1, loss);
    }
    if (body._x > WORLD_BOUNDS_SIZE - radius) {
        body._x = WORLD_BOUNDS_SIZE - radius;
        has |= 4;
        reflectVelocity(body, 1, 0, loss);
    } else if (body._x < radius) {
        body._x = radius;
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
    const Z = 2 * (v._u * nx + v._v * ny);
    v._u = (v._u - Z * nx) / loss;
    v._v = (v._v - Z * ny) / loss;
}

export const limitVelocity = (v: Vel, len: number) => {
    let l = v._u * v._u + v._v * v._v;
    if (l > len * len) {
        l = len / sqrt(l);
        v._u *= l;
        v._v *= l;
    }
}

export const applyGroundFriction = (p: Actor, amount: number) => {
    let v0 = p._u * p._u + p._v * p._v;
    if (v0 > 0) {
        v0 = sqrt(v0);
        v0 = reach(v0, 0, amount) / v0;
        p._u *= v0;
        p._v *= v0;
    }
}

export const addVelFrom = (to: Vel, from: Vel, scale: number = 1) =>
    addVelocityDir(to, from._u, from._v, from._w, scale);

export const addVelocityDir = (v: Vel, x: number, y: number, z: number, scale: number = 1) => {
    v._u += scale * x;
    v._v += scale * y;
    v._w += scale * z;
}

export const addPos = (to: Pos, x: number, y: number, z: number, scale: number = 1) => {
    to._x += scale * x;
    to._y += scale * y;
    to._z += scale * z;
}

export const sqrLength3 = (x: number, y: number, z: number) => x * x + y * y + z * z;
export const sqrDistXY = (a: Actor, b: Actor) => {
    const dx = a._x - b._x;
    const dy = a._y - b._y;
    return dx * dx + dy * dy;
}

export const testIntersection = (a: Actor, b: Actor): boolean => {
    const ca = actorsConfig[a._type];
    const cb = actorsConfig[b._type];
    const D = ca._radius + cb._radius;
    return sqrLength3(a._x - b._x, a._y - b._y, a._z + ca._height - b._z - cb._height) < D * D;
}

export const checkBodyCollision = (a: Actor, b: Actor) => {
    const ca = actorsConfig[a._type];
    const cb = actorsConfig[b._type];
    let nx = a._x - b._x;
    let ny = (a._y - b._y) * 2;
    let nz = (a._z + ca._height) - (b._z + cb._height);
    const sqrDist = sqrLength3(nx, ny, nz);
    const D = ca._radius + cb._radius;
    if (sqrDist > 0 && sqrDist < D * D) {
        const pen = (D / sqrt(sqrDist) - 1) / 2;
        addPos(a, nx, ny, nz, ca._invMass * pen);
        addPos(b, nx, ny, nz, -cb._invMass * pen);
    }
};

export const testRayWithSphere = (from: Actor, target: Actor, dx: number, dy: number): boolean => {
    const Lx = target._x - from._x;
    const Ly = target._y - from._y;
    const len = Lx * dx + Ly * dy;
    const props = actorsConfig[target._type];
    const R = props._radius;
    return len >= 0 &&
        sqrLength3(Lx - dx * len, Ly - dy * len, target._z + props._height - from._z) <= R * R;
}

export const roundActors = (list: Actor[]) => {
    for (const a of list) {
        a._x = a._x & 0xFFFF;
        a._y = a._y & 0xFFFF;
        a._z = clamp(a._z | 0, 0, (1 << 16) - 1) & 0xFFFF;
        a._u = clamp(a._u | 0, -1024, 1024);
        a._v = clamp(a._v | 0, -1024, 1024);
        a._w = clamp(a._w | 0, -1024, 1024);
    }
}
