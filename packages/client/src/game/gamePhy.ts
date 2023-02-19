import {Actor, ActorType} from "./types.js";
import {game} from "./gameState.js";
import {raycastSphereActor} from "./phy.js";
import {WORLD_BOUNDS_SIZE, WORLD_SCALE} from "../assets/params.js";
import {testRayWithAABB} from "../utils/collision/collision.js";
import {sqrLength3, sqrt} from "../utils/math.js";
import {TILE_MAP_STRIDE, TILE_SIZE} from "./tilemap.js";
import {TRACE_HIT, traceRay} from "../utils/collision/fastVoxelRaycast.js";

export interface RaycastHit {
    _t: number;
    _type: number;
    _actor?: Actor;
}

export interface RaycastHits {
    _hasHits: number;
    _hits: RaycastHit[];
    _x: number;
    _y: number;
    _z: number;
    _dx: number;
    _dy: number;
    _dz: number;
}

export const RAYCAST_HITS = {
    _hasHits: 0,
    _hits: [],
    _x: 0,
    _y: 0,
    _z: 0,
    _dx: 0,
    _dy: 0,
    _dz: 0,
};

export const raycastWorld = (
    x: number,
    y: number,
    z: number,
    dx: number,
    dy: number,
    dz: number,
    hits: RaycastHits,
    bulletOwnerId = 0,
) => {
    const dirN = sqrt(sqrLength3(dx, dy, dz));
    hits._hits.length = 0;
    hits._x = x;
    hits._y = y;
    hits._z = z;
    hits._dx = dx /= dirN;
    hits._dy = dy /= dirN;
    hits._dz = dz /= dirN;
    hits._hasHits = 0;
    let has = 0;
    const boundsDist = testRayWithAABB(
        x,
        y,
        z,
        dx,
        dy,
        dz,
        0,
        0,
        WORLD_BOUNDS_SIZE,
        WORLD_BOUNDS_SIZE,
        0,
        WORLD_BOUNDS_SIZE,
    );
    if (boundsDist >= 0) {
        has |= 1;
        hits._hits.push({
            _type: 1,
            _t: boundsDist,
        });
    }
    for (const a of game._state._actors[ActorType.Player]) {
        if (a._client - bulletOwnerId) {
            const d = raycastSphereActor(x, y, z, dx, dy, dz, a);
            if (d >= 0) {
                has |= 2;
                hits._hits.push({
                    _type: 2,
                    _t: d,
                    _actor: a,
                });
            }
        }
    }
    for (const a of game._state._actors[ActorType.Barrel]) {
        const d = raycastSphereActor(x, y, z, dx, dy, dz, a);
        if (d >= 0) {
            has |= 2;
            hits._hits.push({
                _type: 2,
                _t: d,
                _actor: a,
            });
        }
    }
    for (const a of game._trees) {
        const d = raycastSphereActor(x, y, z, dx, dy, dz, a);
        if (d >= 0) {
            has |= 2;
            hits._hits.push({
                _type: 2,
                _t: d,
                _actor: a,
            });
        }
    }
    {
        const maxDistance = boundsDist >= 0 ? boundsDist : WORLD_BOUNDS_SIZE * 2.5;
        const d = traceRay(
            game._blocks,
            TILE_MAP_STRIDE,
            x / (TILE_SIZE * WORLD_SCALE),
            y / (TILE_SIZE * WORLD_SCALE),
            dx,
            dy,
            maxDistance / (TILE_SIZE * WORLD_SCALE),
            TRACE_HIT,
        );
        if (d >= 0) {
            has |= 4;
            hits._hits.push({
                _type: 4,
                _t: d * TILE_SIZE * WORLD_SCALE,
            });
        }
    }
    hits._hasHits = has;
    if (hits._hits.length > 1) {
        hits._hits.sort((a, b) => a._t - b._t);
    }
};
