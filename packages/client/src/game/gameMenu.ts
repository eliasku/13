import {button, label, ui_begin, ui_finish, uiProgressBar, uiState} from "../graphics/gui";
import {settings} from "./settings";
import {keyboardDown, KeyCode} from "../utils/input";
import {disconnect} from "../net/messaging";
import {Const, GAME_CFG} from "./config";
import {guiSettingsPanel} from "../screens/settings";
import {ReplayFile, saveReplay} from "./replay";

export const enum GameMenuState {
    InGame = 0,
    Paused = 1,
    Settings = 2,
}

export interface GameMenu {
    _state: GameMenuState;
}

function MM_SS(seconds: number) {
    seconds = Math.ceil(seconds);
    const min = (seconds / 60) | 0;
    const sec = seconds % 60;
    return (min < 10 ? ("0" + min) : min) + ":" + (sec < 10 ? ("0" + sec) : sec);
}

export function onGameMenu(menu: GameMenu, replay?: ReplayFile, tic?: number): void {
    ui_begin();
    {
        const W = uiState._width;
        const H = uiState._height;
        const centerX = W >> 1;
        const centerY = H >> 1;

        if (menu._state === GameMenuState.InGame) {
            if (replay) {
                const t0 = replay._meta.start;
                const t1 = replay._meta.end;
                const len = t1 - t0;
                const rewindTo = uiProgressBar("replay_timeline", tic - t0, len, 10 + 40, H - 20, W - 50 - 10, 8);
                const totalTime = Math.ceil(len / Const.NetFq);
                const currentTime = Math.ceil((tic - t0) / Const.NetFq);
                label(MM_SS(currentTime) + "/" + MM_SS(totalTime), 9, 10, H - 28, 0);

                let paused = replay._paused ?? false;
                if (button("replay_play", paused ? "►" : "▮▮", 10, H - 24, {w: 16, h: 16}) ||
                    keyboardDown[KeyCode.Space]) {
                    replay._paused = !paused;
                }

                let curPlaybackSpeed = replay._playbackSpeed ?? 1;
                let nextPlaybackSpeed = curPlaybackSpeed;
                if (button("replay_playback_speed", (nextPlaybackSpeed < 1 ? ".5" : nextPlaybackSpeed) + "⨯", 30, H - 24, {
                    w: 16,
                    h: 16
                })) {
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

                if (button("close_replay", "❌", W - 16 - GAME_CFG._minimap._size - 4, 2, {
                    w: 16,
                    h: 16
                }) || keyboardDown[KeyCode.Escape]) {
                    disconnect();
                }
            } else {
                if (button("menu", "⏸️", W - 16 - GAME_CFG._minimap._size - 4, 2, {
                    w: 16,
                    h: 16
                }) || keyboardDown[KeyCode.Escape]) {
                    menu._state = GameMenuState.Paused;
                }
            }
        } else if (menu._state === GameMenuState.Paused) {
            let y = centerY + 20;
            if (button("settings", "⚙️ SETTINGS", centerX - 50, y, {w: 100, h: 20})) {
                menu._state = GameMenuState.Settings;
            }
            y += 30;
            if (button("save-replay", "💾 SAVE REPLAY", centerX - 50, y, {w: 100, h: 20})) {
                saveReplay();
            }
            y += 30;
            if (button("quit_room", "🏃 QUIT", centerX - 50, y, {w: 100, h: 20})) {
                disconnect();
            }
            y += 30;
            if (button("back_to_game", "⬅ BACK", centerX - 50, y, {
                w: 100,
                h: 20
            }) || keyboardDown[KeyCode.Escape]) {
                menu._state = GameMenuState.InGame;
            }
        } else if (menu._state === GameMenuState.Settings) {
            guiSettingsPanel(centerX, centerY);

            if (button("back", "⬅ BACK", centerX - 50, centerY + 90, {
                w: 100,
                h: 20
            }) || keyboardDown[KeyCode.Escape]) {
                menu._state = GameMenuState.Paused;
            }
        }
    }
    ui_finish();
}
