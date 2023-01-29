import {button, ui_begin, ui_finish, uiProgressBar, uiState} from "../graphics/ui";
import {settings} from "./settings";
import {keyboardDown, KeyCode} from "../utils/input";
import {disconnect} from "../net/messaging";
import {GAME_CFG} from "./config";
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

export function onGameMenu(menu: GameMenu, replay?: ReplayFile, tic?: number): void {
    ui_begin();
    {
        const W = uiState._width;
        const H = uiState._height;
        const centerX = W >> 1;
        const centerY = H >> 1;

        if (menu._state === GameMenuState.InGame) {
            if (button("menu", "⏸️", W - 16 - GAME_CFG._minimap._size - 4, 2, {
                w: 16,
                h: 16
            }) || keyboardDown[KeyCode.Escape]) {
                menu._state = GameMenuState.Paused;
            }

            if (replay) {
                const t0 = replay._meta.start;
                const t1 = replay._meta.end;
                uiProgressBar((tic - t0) / (t1 - t0), 20, H - 20, W - 40, 8);
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
