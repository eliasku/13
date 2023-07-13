import {button, label, ui_begin, ui_finish, uiState} from "../graphics/gui.js";
import {keyboardDown, KeyCode} from "../utils/input.js";
import {_room, disconnect} from "../net/messaging.js";
import {Const, GAME_CFG} from "./config.js";
import {guiSettingsPanel} from "../screens/settingsPanel.js";
import {saveReplay} from "./replay/recorder.js";
import {poki} from "../poki.js";
import {game, GameMenuState, gameMode} from "@iioi/client/game/gameState.js";
import {guiReplayViewer} from "./replay/viewer.js";
import {logScreenView} from "../analytics.js";

let linkCopied = false;

export const onGameMenu = (gameTic?: number): void => {
    ui_begin();
    {
        const W = uiState._width;
        const H = uiState._height;
        const centerX = W >> 1;
        const centerY = H >> 1;

        if (gameMode._menu === GameMenuState.InGame) {
            if (gameMode._replay && gameTic != null) {
                guiReplayViewer(gameMode._replay, gameTic);
            } else {
                if (
                    button("menu", "⏸️", W - 16 - GAME_CFG.minimap.size - 4, 2, {
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

            y = centerY + 40;
            if (button("settings", "⚙️ SETTINGS", centerX - 50, y, {w: 100, h: 20})) {
                gameMode._menu = GameMenuState.Settings;
                logScreenView("settings_screen");
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
            guiSettingsPanel(centerX, centerY - 20);

            if (
                button("back", "⬅ BACK", centerX - 50, centerY + 90, {
                    w: 100,
                    h: 20,
                }) ||
                keyboardDown[KeyCode.Escape]
            ) {
                gameMode._menu = GameMenuState.Paused;
            }
        } else if (gameMode._menu === GameMenuState.Respawn) {
            label(`☠️ YOU DIED ☠️`, 14, centerX, centerY - 100, 0.5);

            let y = centerY + 30;

            y += 25;
            const cooldown = (gameTic - gameMode._respawnStartTic) / Const.NetFq;
            if (game._allowedToRespawn && cooldown > 5) {
                if (button("respawn", "♻️ RESPAWN", centerX - 50, y, {w: 100, h: 20}) || keyboardDown[KeyCode.Escape]) {
                    gameMode._menu = GameMenuState.InGame;
                    game._waitToAutoSpawn = true;
                }
            } else {
                const v = ((cooldown / 5) * 100) | 0;
                label(`♻️ REGENERATION: ${v}%`, 14, centerX - 80, centerY - 70, 0);
            }
            y += 40;
            if (button("quit_room", "🏃 ESCAPE", centerX - 50, y, {w: 100, h: 20})) {
                disconnect();
            }
        }
    }
    ui_finish();
};
