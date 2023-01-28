import {button, ui_begin, ui_finish, uiState} from "../graphics/ui";
import {settings} from "./settings";
import {keyboardDown, KeyCode} from "../utils/input";
import {disconnect} from "../net/messaging";
import {GAME_CFG} from "./config";
import {guiSettingsPanel} from "../screens/settings";

export const enum GameMenuState {
    InGame = 0,
    Paused = 1,
    Settings = 2,
}

export interface GameMenu {
    _state: GameMenuState;
}

export function onGameMenu(menu: GameMenu): void {
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
        } else if (menu._state === GameMenuState.Paused) {
            if (button("settings", "⚙️ SETTINGS", centerX - 50, centerY + 20, {w: 100, h: 20})) {
                menu._state = GameMenuState.Settings;
            }
            if (button("back_to_game", "⬅ BACK", centerX - 50, centerY + 50, {
                w: 100,
                h: 20
            }) || keyboardDown[KeyCode.Escape]) {
                menu._state = GameMenuState.InGame;
            }
            if (button("quit_room", "🏃 QUIT", centerX - 50, centerY + 80, {w: 100, h: 20})) {
                disconnect();
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