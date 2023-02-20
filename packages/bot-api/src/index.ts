import {ActorType, newStateData, PlayerActor, StateData} from "@iioi/client/game/types.js";
import {readState} from "@iioi/client/game/packets.js";
import {GameConfig} from "@iioi/client/data/config.js";

export interface PlayerBot {
    config?: GameConfig;
    update?: (state: StateData, player: PlayerActor) => number;
}

export const playerBot: PlayerBot = {};

onmessage = e => {
    if (e.data instanceof Array) {
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
    } else {
        playerBot.config = e.data as GameConfig;
        postMessage(1);
    }
};

// export public types

export {ActorType, ControlsFlag, ItemType, packDirByte} from "@iioi/client/game/types.js";
export type {Actor, PlayerActor, StateData} from "@iioi/client/game/types.js";
export {WORLD_BOUNDS_SIZE} from "@iioi/client/assets/params.js";
export {itemContainsAmmo} from "@iioi/client/game/actors.js";
export {sqrDistXY} from "@iioi/client/game/phy.js";
export type {GameConfig, WeaponConfig} from "@iioi/client/data/config.js";
export type {ClientID} from "@iioi/shared/types.js";
