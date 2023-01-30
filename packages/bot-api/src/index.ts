import {ActorType, newStateData, PlayerActor, StateData} from "../../client/src/game/types";
import {readState} from "../../client/src/game/packets";

export interface PlayerBot {
    update?: (state: StateData, player: PlayerActor) => number;
}

export let playerBot: PlayerBot = {};

onmessage = e => {
    const stateBuffer = e.data[0] as Int32Array;
    const clientId = e.data[1] as number;
    let input = 0;
    if (playerBot.update) {
        const state = newStateData();
        readState(state, stateBuffer, 0);
        const player = state._actors[ActorType.Player].find(p => p._client === clientId);
        if (player) {
            input = playerBot.update(state, player);
        }
    }
    postMessage([input, stateBuffer], {transfer: [stateBuffer.buffer]});
}

// export public types

export {
    Actor,
    ActorType,
    ControlsFlag,
    ItemType,
    packDirByte,
    PlayerActor,
    StateData
} from "../../client/src/game/types";
export {WORLD_BOUNDS_SIZE} from "../../client/src/assets/params";
export {itemContainsAmmo} from "../../client/src/game/actors";
export {sqrDistXY} from "../../client/src/game/phy";
export {weapons} from "../../client/src/game/data/weapons";
export {actorsConfig} from "../../client/src/game/data/world";
export {ClientID} from "../../shared/src/types";
