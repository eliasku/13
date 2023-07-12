import {Actor, PlayerActor, StateData} from "../types.js";
import {WORLD_BOUNDS_SIZE, WORLD_SCALE} from "../../assets/params.js";
import {sqrDistXY} from "../phy.js";
import {ClientID} from "@iioi/shared/types.js";
import {writeState} from "../packets.js";
import {GAME_CFG} from "../config.js";
import {TRACE_HIT, traceRay} from "../../utils/collision/fastVoxelRaycast.js";
import {game} from "../gameState.js";
import {TILE_MAP_STRIDE, TILE_SIZE} from "../tilemap.js";

let autoplayWorker: Worker | undefined;
export let autoplayInput = 0;
let waitAutoplayResult = false;
let autoplayBuffer = new Int32Array(1024 * 256);

export const loadPlayerCode = (url: string) => {
    autoplayWorker = new Worker(url);
    autoplayWorker.onmessage = message => {
        if (message.data instanceof Array) {
            autoplayInput = message.data[0] as number;
            //console.log("receive input:", autoplayInput);
            autoplayBuffer = message.data[1] as Int32Array;
        }
        waitAutoplayResult = false;
    };
    // send init message
    waitAutoplayResult = true;
    autoplayWorker.postMessage(GAME_CFG);
};

export const updateAutoplay = (state: StateData, clientId: ClientID) => {
    if (autoplayWorker && !waitAutoplayResult) {
        waitAutoplayResult = true;
        //console.log("send state: ");
        writeState(state, autoplayBuffer, 0);
        autoplayWorker.postMessage([autoplayBuffer, clientId], {transfer: [autoplayBuffer.buffer]});
    }
};

export const hasAmmo = (player: PlayerActor) => {
    if (player._weapon) {
        const weapons = GAME_CFG.weapons;
        const weapon = weapons[player._weapon];
        return !weapon.clipSize || player._clipAmmo || player._mags;
    }
    return false;
};

export const findClosestActor = <T extends Actor>(
    player: PlayerActor,
    actors: T[],
    pred: (item: T) => boolean,
): T | undefined => {
    let minDistActor: T | undefined;
    let minDistSqr = WORLD_BOUNDS_SIZE * WORLD_BOUNDS_SIZE;
    for (const a of actors) {
        if (pred(a)) {
            const distSqr = sqrDistXY(player, a);

            if (distSqr < minDistSqr) {
                // raycast
                const dist = Math.sqrt(distSqr);
                const maxDistance = WORLD_BOUNDS_SIZE * 2.5;
                const dx = (a._x - player._x) / dist;
                const dy = (a._y - player._y) / dist;
                const d = traceRay(
                    game._blocks,
                    TILE_MAP_STRIDE,
                    player._x / (TILE_SIZE * WORLD_SCALE),
                    player._y / (TILE_SIZE * WORLD_SCALE),
                    dx,
                    dy,
                    maxDistance / (TILE_SIZE * WORLD_SCALE),
                    TRACE_HIT,
                );
                if (d * TILE_SIZE * WORLD_SCALE >= dist) {
                    minDistActor = a;
                    minDistSqr = distSqr;
                }
            }
        }
    }
    return minDistActor;
};
