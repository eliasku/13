import {getScreenScale} from "./gameState";
import {button, ui_begin, ui_finish} from "../graphics/ui";
import {gl} from "../graphics/draw2d";
import {DEFAULT_FRAMERATE_LIMIT, setSetting, settings} from "./settings";
import {keyboardDown, KeyCode} from "../utils/input";
import {disconnect} from "../net/messaging";
import {GAME_CFG} from "./config";

export const enum GameMenuState {
    InGame = 0,
    Paused = 1,
    Settings = 2,
}

export interface GameMenu {
    _state: GameMenuState;
}

export function onGameMenu(menu: GameMenu): void {
    const scale = getScreenScale();
    ui_begin(scale);
    {
        const W = (gl.drawingBufferWidth / scale) | 0;
        const H = (gl.drawingBufferHeight / scale) | 0;
        const centerX = W >> 1;
        const centerY = H >> 1;

        if (menu._state === GameMenuState.InGame) {
            if (button("menu", "⏸️", W - 16 - GAME_CFG._minimap._size - 4, 2, {w: 16, h: 16}) || keyboardDown[KeyCode.Escape]) {
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
            if (button("sounds", "🔊 SOUNDS: " + (settings.sound ? "ON" : "OFF"), centerX - 50, centerY - 70, {
                w: 100,
                h: 20
            })) {
                setSetting("sound", settings.sound ? 0 : 1);
            }
            if (button("music", "🎵 MUSIC: " + (settings.music ? "ON" : "OFF"), centerX - 50, centerY - 40, {
                w: 100,
                h: 20
            })) {
                setSetting("music", settings.music ? 0 : 1);
            }
            if (button("speech", "💬 SPEECH: " + (settings.speech ? "ON" : "OFF"), centerX - 50, centerY - 10, {
                w: 100,
                h: 20
            })) {
                setSetting("speech", settings.speech ? 0 : 1);
            }

            const bloodModeText = ["️‍🩹 FX: NONE", "🩸 FX: BLOOD", "🎨 FX: PAINT "];
            if (button("blood", bloodModeText[settings.blood], centerX - 65, centerY + 20, {
                w: 80,
                h: 20
            })) {
                setSetting("blood", (settings.blood + 1) % 3);
            }

            const pptext = settings.particles > 0 ? ("X" + settings.particles) : "OFF";
            if (button("particles", "️✨ " + pptext, centerX + 25, centerY + 20, {
                w: 40,
                h: 20
            })) {
                settings.particles *= 2;
                if (settings.particles <= 0) {
                    settings.particles = 0.5;
                }
                if (settings.particles > 4) {
                    settings.particles = 0;
                }
                setSetting("particles", settings.particles);
            }
            if (button("highDPI", "🖥️ HIGH-DPI: " + (settings.highDPI ? "ON" : "OFF"), centerX - 85, centerY + 50, {
                w: 80,
                h: 20
            })) {
                setSetting("highDPI", settings.highDPI ? 0 : 1);
            }

            if (button("frameRateCap", "FPS LIMIT: " + (settings.frameRateCap > 0 ? (settings.frameRateCap + "hz") : "OFF"), centerX + 5, centerY + 50, {
                w: 80,
                h: 20
            })) {
                setSetting("frameRateCap", settings.frameRateCap > 0 ? 0 : DEFAULT_FRAMERATE_LIMIT);
            }

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