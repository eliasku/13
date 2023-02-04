import {min} from "../utils/math.js";
import {gl} from "../graphics/draw2d.js";
import {GAME_CFG} from "./config.js";
import {ClientID} from "@iioi/shared/types.js";
import {clientId, clientName, remoteClients} from "../net/messaging.js";

export let lastFrameTs = 0.0;

export const resetLastFrameTs = () => {
    lastFrameTs = 0.0;
}

export const updateFrameTime = (ts: number) => {
    if (ts > lastFrameTs) {
        lastFrameTs = ts;
    }
}

export const getScreenScale = () => min(gl.drawingBufferWidth, gl.drawingBufferHeight) / GAME_CFG._camera._size;

export function getNameByClientId(client: ClientID) {
    return client === clientId ? clientName : remoteClients.get(client)?._name;
}
