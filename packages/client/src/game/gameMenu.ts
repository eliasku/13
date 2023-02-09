import {button, label, ui_begin, ui_finish, uiProgressBar, uiState} from "../graphics/gui.js";
import {keyboardDown, KeyCode} from "../utils/input.js";
import {_room, disconnect} from "../net/messaging.js";
import {Const, GAME_CFG} from "./config.js";
import {guiSettingsPanel} from "../screens/settings.js";
import {saveReplay} from "./replay.js";
import {ReplayFile} from "./replayFile.js";
import {poki} from "../poki.js";
import {GameMenuState, gameMode} from "@iioi/client/game/gameState.js";

export function onGameMenu(gameTic?: number): void {
    ui_begin();
    {
        const W = uiState._width;
        const H = uiState._height;
        const centerX = W >> 1;
        const centerY = H >> 1;

        if (gameMode._menu === GameMenuState.InGame) {
            if (gameMode._replay && gameTic != null) {
                onReplayViewer(gameMode._replay, gameTic);
            } else {
                if (
                    button("menu", "⏸️", W - 16 - GAME_CFG._minimap._size - 4, 2, {
                        w: 16,
                        h: 16,
                    }) ||
                    keyboardDown[KeyCode.Escape]
                ) {
                    gameMode._menu = GameMenuState.Paused;
                }
            }
        } else if (gameMode._menu === GameMenuState.Paused) {
            let y = centerY - 120;
            if (button("save-replay", "💾 SAVE REPLAY", centerX - 50, y, {w: 100, h: 20})) {
                saveReplay();
            }
            y += 25;
            if (button("copy_link", linkCopied ? "COPIED!" : "🔗 COPY LINK", centerX - 50, y, {w: 100, h: 20})) {
                if (!linkCopied) {
                    poki._shareableURL({r: _room._code})
                        .then(url => navigator.clipboard.writeText(url))
                        .then(() => {
                            linkCopied = true;
                            setTimeout(() => (linkCopied = false), 3000);
                        });
                }
            }
            y += 25;

            y = centerY + 40;
            if (button("settings", "⚙️ SETTINGS", centerX - 50, y, {w: 100, h: 20})) {
                gameMode._menu = GameMenuState.Settings;
            }
            y += 25;
            if (button("quit_room", "🏃 QUIT", centerX - 50, y, {w: 100, h: 20})) {
                disconnect();
            }
            y += 25;
            if (
                button("back_to_game", "⬅ BACK", centerX - 50, y, {
                    w: 100,
                    h: 20,
                }) ||
                keyboardDown[KeyCode.Escape]
            ) {
                gameMode._menu = GameMenuState.InGame;
            }
        } else if (gameMode._menu === GameMenuState.Settings) {
            guiSettingsPanel(centerX, centerY);

            if (
                button("back", "⬅ BACK", centerX - 50, centerY + 90, {
                    w: 100,
                    h: 20,
                }) ||
                keyboardDown[KeyCode.Escape]
            ) {
                gameMode._menu = GameMenuState.Paused;
            }
        }
    }
    ui_finish();
}

let linkCopied = false;

// replay viewer
function MM_SS(seconds: number) {
    seconds = Math.ceil(seconds);
    const min = (seconds / 60) | 0;
    const sec = seconds % 60;
    return (min < 10 ? "0" + min : min) + ":" + (sec < 10 ? "0" + sec : sec);
}

const onReplayViewer = (replay: ReplayFile, tic: number) => {
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
        button("close_replay", "❌", W - 16 - GAME_CFG._minimap._size - 4, 2, {
            w: 16,
            h: 16,
        }) ||
        keyboardDown[KeyCode.Escape]
    ) {
        disconnect();
    }
};
