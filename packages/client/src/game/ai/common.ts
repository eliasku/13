import {Actor, PlayerActor, StateData} from "../types.js";
import {WORLD_BOUNDS_SIZE} from "../../assets/params.js";
import {sqrDistXY} from "../phy.js";
import {weapons} from "../data/weapons.js";
import {ClientID} from "@iioi/shared/types.js";
import {writeState} from "../packets.js";

let autoplayWorker: Worker | undefined;
export let autoplayInput = 0;
let waitAutoplayResult = false;
let autoplayBuffer = new Int32Array(1024 * 256);

export const loadPlayerCode = (url: string) => {
    waitAutoplayResult = false;
    autoplayWorker = new Worker(url);
    autoplayWorker.onmessage = message => {
        autoplayInput = message.data[0] as number;
        //console.log("receive input:", autoplayInput);
        autoplayBuffer = message.data[1] as Int32Array;
        waitAutoplayResult = false;
    };
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
        const weapon = weapons[player._weapon];
        return !weapon._clipSize || player._clipAmmo || player._mags;
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
                minDistActor = a;
                minDistSqr = distSqr;
            }
        }
    }
    return minDistActor;
};
