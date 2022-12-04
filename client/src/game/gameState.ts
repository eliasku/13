import {min} from "../utils/math";
import {gl} from "../graphics/draw2d";
import {GAME_CFG} from "./config";
import {ClientID} from "../../../shared/types";
import {clientId, clientName, remoteClients} from "../net/messaging";

export let lastFrameTs = 0.0;

export const resetLastFrameTs = () => {
    lastFrameTs = 0.0;
}

export const updateFrameTime = (ts: number) => {
    if (ts > lastFrameTs) {
        lastFrameTs = ts;
    }
}

export const getScreenScale = () => min(gl.drawingBufferWidth, gl.drawingBufferHeight) / GAME_CFG.camera.size;

export const getNameByClientId = (client: ClientID) => client === clientId ? clientName : remoteClients.get(client)?.name_;
