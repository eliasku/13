import {remoteClients} from "../../net/messaging.js";
import {game, gameMode} from "../gameState.js";
import {cloneStateData} from "../types.js";
import {_SEEDS} from "../../utils/rnd.js";
import {ReplayFile} from "./replayFile.js";
import {Const} from "@iioi/client/game/config.js";

export function enableReplayMode(replay: ReplayFile) {
    remoteClients.clear();
    for (const sid in replay._meta.clients) {
        const id = parseInt(sid);
        const name = replay._meta.clients[id];
        remoteClients.set(id, {_id: id, _name: name});
    }
    gameMode._replay = replay;
    rewindReplayToStart();
}

export function rewindReplayToStart() {
    game._state = cloneStateData(gameMode._replay._state);
    game._localEvents = gameMode._replay._stream.concat();
    game._startTic = -1;
    _SEEDS[0] = game._state._seed;
    game._lastInputTic = 0;
    game._lastInputCmd = 0;
    game._lastAudioTic = 0;
}

export const runReplayTics = (ts: number, onSimulateTic: () => void) => {
    const ticsPerSecond = Const.NetFq * (gameMode._replay._playbackSpeed ?? 1);
    let frames = ((ts - game._prevTime) * ticsPerSecond) | 0;
    const end = gameMode._replay._meta.end;
    const paused = gameMode._replay._paused;
    if (paused) {
        game._prevTime = ts;
        frames = 0;
    }
    if (gameMode._replay._rewind != null) {
        const toTic = gameMode._replay._rewind;
        if (toTic > game._gameTic) {
            frames = toTic - game._gameTic + 3;
            game._prevTime = ts - frames / ticsPerSecond;
            game._lastInputTic = toTic;
            game._lastInputCmd = toTic;
            game._lastAudioTic = toTic;
        } else {
            //rewindReplayToStart();
            game._state = cloneStateData(gameMode._replay._state);
            game._localEvents = gameMode._replay._stream.concat();
            _SEEDS[0] = game._state._seed;
            game._gameTic = game._state._tic;
            frames = toTic + 1;
            game._prevTime = ts - frames / ticsPerSecond;
            game._lastInputTic = game._state._tic + toTic;
            game._lastInputCmd = game._state._tic + toTic;
            game._lastAudioTic = game._state._tic + toTic;
        }
        gameMode._replay._rewind = undefined;
    }
    if (game._gameTic >= end) {
        game._prevTime = ts;
        frames = 0;
        rewindReplayToStart();
    }
    while (game._gameTic <= end && frames--) {
        onSimulateTic();
        game._prevTime += 1 / ticsPerSecond;
    }
};
