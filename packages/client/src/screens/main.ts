import {getScreenScale} from "../game/gameState";
import {button, label, ui_begin, ui_finish} from "../graphics/ui";
import {gl} from "../graphics/draw2d";
import {clientName, setUserName} from "../net/messaging";
import {DEFAULT_FRAMERATE_LIMIT, setSetting, settings} from "../game/settings";
import {keyboardDown, KeyCode} from "../utils/input";
import {BuildVersion, RoomsInfoResponse} from "@eliasku/13-shared/src/types";
import {parseRadix64String} from "@eliasku/13-shared/src/radix64";

const enum Menu {
    Main = 0,
    Settings = 1,
    Dev = 2,
    Games = 3,
    CreateGame = 4,
}

export interface MenuResult {
    command: MenuCommand;
    createPrivate?: boolean;
    joinByCode?: string;
}

export const enum MenuCommand {
    StartPractice = 0,
    QuickStart = 1,
    JoinGame = 2,
    CreateGame = 3,
}

let menu: Menu = Menu.Main;
let devLock: number = 0;

// create game options
let isPrivate = false;

export function menuScreen(serverInfo: RoomsInfoResponse): MenuResult | undefined {
    let result: MenuResult | undefined;
    const scale = getScreenScale();
    ui_begin(scale);
    {
        const W = (gl.drawingBufferWidth / scale) | 0;
        const H = (gl.drawingBufferHeight / scale) | 0;
        const centerX = W >> 1;
        const centerY = H >> 1;

        if (menu === Menu.Main) {
            let totalPublicOnline = 0;
            for (const room of serverInfo.rooms) {
                totalPublicOnline += room.players;
            }

            label("Welcome back,", 7, centerX, 14);
            if (button("change_name", clientName + " ✏️", centerX - 64 / 2, 20)) {
                setUserName(prompt("your name", clientName));
            }

            if (serverInfo.players) {
                label(`${serverInfo.players} playing right now`, 7, centerX, centerY + 45);
            }

            if (button("dev_mode", "", centerX - 40, centerY - 40, {w: 80, h: 80, visible: false})) {
                if (++devLock > 3) {
                    setSetting("dev", 1);
                    menu = Menu.Dev;
                }
            }

            if (button("start", totalPublicOnline ? "⚔ FIGHT" : "⚔ CREATE GAME", centerX - 50, centerY + 50, {
                w: 100,
                h: 20
            })) {
                result = {command: MenuCommand.QuickStart};
            }

            if (button("custom", "☰", centerX + 60, centerY + 50, {
                w: 20,
                h: 20
            })) {
                menu = Menu.Games;
            }

            if (button("practice", "🏹 PRACTICE", centerX - 50, centerY + 75, {w: 100, h: 20})) {
                result = {command: MenuCommand.StartPractice};
            }
            if (button("settings", "⚙️ SETTINGS", centerX - 50, centerY + 108, {w: 100, h: 16})) {
                menu = Menu.Settings;
            }
        } else if (menu === Menu.Settings) {
            label("⚙️ SETTINGS", 20, centerX, 30);
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
                menu = Menu.Main;
            }
        } else if (menu === Menu.Dev) {
            label("⚙️ DEVELOPER", 20, centerX, 30);
            if (button("fps", "FPS: " + (settings.dev_fps ? "ON" : "OFF"), centerX - 50, centerY - 70, {
                w: 100,
                h: 20
            })) {
                setSetting("dev_fps", settings.dev_fps ? 0 : 1);
            }
            if (button("collision", "COLLISION: " + (settings.dev_collision ? "ON" : "OFF"), centerX - 50, centerY - 40, {
                w: 100,
                h: 20
            })) {
                setSetting("dev_collision", settings.dev_collision ? 0 : 1);
            }
            if (button("console", "LOGS: " + (settings.dev_console ? "ON" : "OFF"), centerX - 50, centerY - 10, {
                w: 100,
                h: 20
            })) {
                setSetting("dev_console", settings.dev_console ? 0 : 1);
            }
            if (button("info", "INFO: " + (settings.dev_info ? "ON" : "OFF"), centerX - 50, centerY + 20, {
                w: 100,
                h: 20
            })) {
                setSetting("dev_info", settings.dev_info ? 0 : 1);
            }
            if (button("dev_disable", "DISABLE", centerX - 30, centerY + 50, {
                w: 60,
                h: 10
            })) {
                setSetting("dev", 0);
                menu = Menu.Main;
            }

            if (button("back", "⬅ BACK", centerX - 50, centerY + 90, {
                w: 100,
                h: 20
            }) || keyboardDown[KeyCode.Escape]) {
                menu = Menu.Main;
            }
        } else if (menu === Menu.Games) {
            label("⚙️ GAMES", 20, centerX, 30);

            let y = -70;
            let i = 0;
            for (const room of serverInfo.rooms) {
                if (button("room" + room.code, `GAME #${room.code} (${room.players}/${room.max})`, centerX - 50, centerY + y, {
                    w: 100,
                    h: 20
                })) {
                    if (room.players < room.max) {
                        result = {command: MenuCommand.JoinGame, joinByCode: room.code};
                    }
                }
                y += 20;
                ++i;
                if (i > 5) {
                    break;
                }
            }

            if (button("join_code", "JOIN BY CODE", centerX - 50, centerY + 50, {
                w: 100,
                h: 20
            })) {
                const code = prompt("Enter Game Code", "0");
                const v = parseRadix64String(code);
                if (v) {
                    result = {command: MenuCommand.JoinGame, joinByCode: code};
                } else {
                    console.warn("bad game code");
                }
            }

            if (button("create", "CREATE MY GAME", centerX - 50, centerY + 70, {
                w: 100,
                h: 20
            })) {
                menu = Menu.CreateGame;
            }

            if (button("back", "⬅ BACK", centerX - 50, centerY + 90, {
                w: 100,
                h: 20
            }) || keyboardDown[KeyCode.Escape]) {
                menu = Menu.Main;
            }

        } else if (menu === Menu.CreateGame) {
            label("⚙️ CREATE GAME ROOM", 20, centerX, 30);
            if (button("visibility", "ACCESS: " + (isPrivate ? "🕵️ PRIVATE" : "👁️ PUBLIC"), centerX - 50, centerY - 70, {
                w: 100,
                h: 20
            })) {
                isPrivate = !isPrivate;
            }
            if (button("create", "⚔ START GAME", centerX - 50, centerY + 40, {
                w: 100,
                h: 20
            })) {
                result = {command: MenuCommand.CreateGame, createPrivate: isPrivate};
            }
            if (button("back", "⬅ BACK", centerX - 50, centerY + 90, {
                w: 100,
                h: 20
            }) || keyboardDown[KeyCode.Escape]) {
                menu = Menu.Games;
            }
        }

        if (button("version_tag", " " + BuildVersion, 2, H - 16, {w: 48, h: 14, visible: true})) {
            open("https://github.com/eliasku/13", "_blank");
        }
    }
    ui_finish();
    return result;
}