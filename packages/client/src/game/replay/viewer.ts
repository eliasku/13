import {disconnect, remoteClients} from "../../net/messaging.js";
import {game, gameMode, JoinState} from "../gameState.js";
import {cloneStateData} from "../types.js";
import {_SEEDS} from "../../utils/rnd.js";
import {ReplayFile} from "./replayFile.js";
import {Const, GAME_CFG} from "@iioi/client/game/config.js";
import {button, label, uiProgressBar, uiState} from "../../graphics/gui.js";
import {keyboardDown, KeyCode} from "../../utils/input.js";

export const enableReplayMode = (replay: ReplayFile) => {
    remoteClients.clear();
    for (const sid in replay._meta.clients) {
        const id = parseInt(sid);
        const name = replay._meta.clients[id];
        remoteClients.set(id, {_id: id, _name: name});
    }
    gameMode._replay = replay;
    rewindReplayToStart();
};

export const rewindReplayToStart = () => {
    game._state = cloneStateData(gameMode._replay._state);
    game._localEvents = gameMode._replay._stream.concat();
    game._joinState = JoinState.Wait;
    game._lastInputTic = 0;
    game._lastInputCmd = 0;
    game._lastAudioTic = 0;
};

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

// replay viewer
const MM_SS = (seconds: number) => {
    seconds = Math.ceil(seconds);
    const min = (seconds / 60) | 0;
    const sec = seconds % 60;
    return (min < 10 ? "0" + min : min) + ":" + (sec < 10 ? "0" + sec : sec);
};

export const guiReplayViewer = (replay: ReplayFile, tic: number) => {
    const W = uiState._width;
    const H = uiState._height;

    const t0 = replay._meta.start;
    const t1 = replay._meta.end;
    const len = t1 - t0;
    const rewindTo = uiProgressBar("replay_timeline", tic - t0, len, 10 + 40, H - 20, W - 50 - 10, 8);
    const totalTime = Math.ceil(len / Const.NetFq);
    const currentTime = Math.ceil((tic - t0) / Const.NetFq);
    label(MM_SS(currentTime) + "/" + MM_SS(totalTime), 9, 10, H - 28, 0);

    const paused = replay._paused ?? false;
    if (button("replay_play", paused ? "►" : "▮▮", 10, H - 24, {w: 16, h: 16}) || keyboardDown[KeyCode.Space]) {
        replay._paused = !paused;
    }

    const curPlaybackSpeed = replay._playbackSpeed ?? 1;
    let nextPlaybackSpeed = curPlaybackSpeed;
    if (
        button("replay_playback_speed", (nextPlaybackSpeed < 1 ? ".5" : nextPlaybackSpeed) + "⨯", 30, H - 24, {
            w: 16,
            h: 16,
        })
    ) {
        nextPlaybackSpeed *= 2;
        if (nextPlaybackSpeed > 4) {
            nextPlaybackSpeed = 0.5;
        }
        if (curPlaybackSpeed !== nextPlaybackSpeed) {
            replay._playbackSpeed = nextPlaybackSpeed;
        }
    }

    if (rewindTo != null) {
        if (rewindTo >= 0) {
            replay._rewind = Math.round(rewindTo * len);
        } else {
            const r = -(rewindTo + 1);
            const t = (r * len) | 0;
            label(MM_SS(Math.ceil(t / Const.NetFq)), 8, 10 + 40 + r * (W - 50 - 10), H - 20 - 4);
        }
    }

    if (
        button("close_replay", "❌", W - 16 - GAME_CFG.minimap.size - 4, 2, {
            w: 16,
            h: 16,
        }) ||
        keyboardDown[KeyCode.Escape]
    ) {
        disconnect();
    }
};
