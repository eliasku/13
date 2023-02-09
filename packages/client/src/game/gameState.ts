import {min} from "../utils/math.js";
import {gl} from "../graphics/draw2d.js";
import {GAME_CFG} from "./config.js";
import {ClientID} from "@iioi/shared/types.js";
import {clientId, clientName, remoteClients} from "../net/messaging.js";
import {ReplayFile} from "./replayFile.js";

export let lastFrameTs = 0.0;

export const resetLastFrameTs = () => {
    lastFrameTs = 0.0;
};

export const updateFrameTime = (ts: number) => {
    if (ts > lastFrameTs) {
        lastFrameTs = ts;
    }
};

export const gameCamera: number[] = [0, 0, 1];

export const getScreenScale = () => min(gl.drawingBufferWidth, gl.drawingBufferHeight) / GAME_CFG._camera._size;

export function getNameByClientId(client: ClientID) {
    return client === clientId ? clientName : remoteClients.get(client)?._name;
}

export const GameMenuState = {
    InGame: 0,
    Paused: 1,
    Settings: 2,
} as const;
export type GameMenuState = (typeof GameMenuState)[keyof typeof GameMenuState];

export interface GameMode {
    _title: boolean;
    _runAI: boolean;
    _playersAI: boolean;
    _hasPlayer: boolean;
    _tiltCamera: number;
    _bloodRain: boolean;
    _npcLevel: number;
    _replay?: ReplayFile;
    _menu: GameMenuState;
}

export const gameMode: GameMode = {
    _title: false,
    _runAI: false,
    _playersAI: false,
    _hasPlayer: false,
    _tiltCamera: 0.0,
    _bloodRain: false,
    _npcLevel: 0,
    _menu: GameMenuState.InGame,
};
