import {button, label, ui_begin, ui_finish, uiState} from "../graphics/gui.js";
import {clientName, setUserName} from "../net/messaging.js";
import {enableSettingsFlag, SettingFlag} from "../game/settings.js";
import {keyboardDown, KeyCode} from "../utils/input.js";
import {BuildClientVersion, GameModeFlag, NewGameParams, RoomsInfoResponse} from "@iioi/shared/types.js";
import {guiSettingsPanel} from "./settingsPanel.js";
import {guiDevModePanel} from "./devModePanel.js";
import {parseRadix64String} from "@iioi/shared/radix64.js";
import {logScreenView} from "../analytics.js";

const Menu = {
    Main: 0,
    Settings: 1,
    Dev: 2,
    Games: 3,
    Practice: 4,
    CreateGame: 5,
} as const;
type Menu = (typeof Menu)[keyof typeof Menu];

export const MenuCommand = {
    StartPractice: 0,
    QuickStart: 1,
    JoinGame: 2,
    CreateGame: 3,
    Replay: 4,
} as const;
export type MenuCommand = (typeof MenuCommand)[keyof typeof MenuCommand];

export interface MenuResult {
    _command: MenuCommand;
    _newGame?: NewGameParams;
    _joinByCode?: string;
}

let menu: Menu = Menu.Main;
let devLock = 0;

// create game options
const newGameSettings: MenuResult = {
    _command: MenuCommand.CreateGame,
    _newGame: {
        _flags: GameModeFlag.Public,
        _playersLimit: 8,
        _npcLevel: 2,
        _theme: 0,
    },
};

const newPracticeSettings: MenuResult = {
    _command: MenuCommand.StartPractice,
    _newGame: {
        _flags: GameModeFlag.Offline,
        _playersLimit: 1,
        _npcLevel: 2,
        _theme: 0,
    },
};

export const menuScreen = (roomsInfo: RoomsInfoResponse): MenuResult | undefined => {
    let result: MenuResult | undefined;
    ui_begin();
    {
        const W = uiState._width;
        const H = uiState._height;
        const centerX = W >> 1;
        const centerY = H >> 1;

        if (menu === Menu.Main) {
            let totalJoinCap = 0;
            for (const room of roomsInfo.rooms) {
                totalJoinCap += room.max - room.players;
            }

            label("Welcome back,", 7, centerX, 14);
            if (button("change_name", clientName + " ✏️", centerX - 64 / 2, 20)) {
                setUserName(prompt("your name", clientName));
            }

            if (button("replay", "📂 OPEN REPLAY", centerX - 80 / 2, centerY - 80, {w: 80})) {
                result = {_command: MenuCommand.Replay};
            }

            if (roomsInfo.players) {
                label(`${roomsInfo.players} playing right now`, 7, centerX, centerY + 45);
            }

            if (button("dev_mode", "", centerX - 40, centerY - 40, {w: 80, h: 80, visible: false})) {
                if (++devLock > 3) {
                    enableSettingsFlag(SettingFlag.DevMode);
                    menu = Menu.Dev;
                    logScreenView("dev_screen");
                }
            }

            if (
                button("start", totalJoinCap ? "⚔ FIGHT" : "⚔ CREATE GAME", centerX - 50, centerY + 50, {
                    w: 100,
                    h: 20,
                })
            ) {
                result = {_command: MenuCommand.QuickStart};
            }

            if (
                button("custom", "☰", centerX + 60, centerY + 50, {
                    w: 20,
                    h: 20,
                })
            ) {
                menu = Menu.Games;
            }

            if (button("practice", "🏹 PRACTICE", centerX - 50, centerY + 75, {w: 100, h: 20})) {
                // result = {_command: MenuCommand.StartPractice};
                menu = Menu.Practice;
            }
            if (button("settings", "⚙️", W - 40, 20, {w: 20, h: 20})) {
                menu = Menu.Settings;
                logScreenView("settings_screen");
            }
        } else if (menu === Menu.Settings) {
            label("⚙️ SETTINGS", 16, centerX, 30);
            guiSettingsPanel(centerX, centerY - 20);
            if (
                button("back", "⬅ BACK", centerX - 50, centerY + 90, {
                    w: 100,
                    h: 20,
                }) ||
                keyboardDown[KeyCode.Escape]
            ) {
                menu = Menu.Main;
            }
        } else if (menu === Menu.Dev) {
            label("⚙️ DEVELOPER", 20, centerX, 30);
            if (guiDevModePanel(centerX, centerY)) {
                menu = Menu.Main;
            }
            if (
                button("back", "⬅ BACK", centerX - 50, centerY + 90, {
                    w: 100,
                    h: 20,
                }) ||
                keyboardDown[KeyCode.Escape]
            ) {
                menu = Menu.Main;
            }
        } else if (menu === Menu.Games) {
            label("⚙️ GAMES", 20, centerX, 30);

            let y = -70;
            let i = 0;
            for (const room of roomsInfo.rooms) {
                if (
                    button(
                        "room" + room.code,
                        `GAME #${room.code} (${room.players}/${room.max})`,
                        centerX - 50,
                        centerY + y,
                        {
                            w: 100,
                            h: 20,
                        },
                    )
                ) {
                    if (room.players < room.max) {
                        result = {_command: MenuCommand.JoinGame, _joinByCode: room.code};
                    }
                }
                y += 20;
                ++i;
                if (i > 5) {
                    break;
                }
            }

            y = centerY + 30;
            if (
                button("join_code", "JOIN BY CODE", centerX - 50, y, {
                    w: 100,
                    h: 20,
                })
            ) {
                const code = prompt("Enter Game Code", "") ?? "";
                const v = parseRadix64String(code);
                if (v) {
                    result = {_command: MenuCommand.JoinGame, _joinByCode: code};
                } else {
                    console.warn("bad game code");
                    ui_finish();
                    return;
                }
            }
            y += 30;

            if (
                button("create", "CREATE MY GAME", centerX - 50, y, {
                    w: 100,
                    h: 20,
                })
            ) {
                menu = Menu.CreateGame;
            }
            y += 30;
            if (
                button("back", "⬅ BACK", centerX - 50, y, {
                    w: 100,
                    h: 20,
                }) ||
                keyboardDown[KeyCode.Escape]
            ) {
                menu = Menu.Main;
            }
        } else if (menu === Menu.Practice) {
            label("🏹 PRACTICE", 20, centerX, 30);

            let y = centerY - 70;
            y += 25;
            const NPC_LEVELS = ["NONE", "RARE", "NORMAL", "CROWD"];
            if (
                button("npc_level", "NPC: " + NPC_LEVELS[newPracticeSettings._newGame._npcLevel], centerX - 50, y, {
                    w: 100,
                    h: 20,
                })
            ) {
                ++newPracticeSettings._newGame._npcLevel;
                if (newPracticeSettings._newGame._npcLevel >= NPC_LEVELS.length) {
                    newPracticeSettings._newGame._npcLevel = 0;
                }
            }
            y += 25;
            const THEME_NAMES = ["? RANDOM", "🌲 FOREST", "🌵 DESERT", "❄ SNOW"];
            if (
                button("map_theme", "MAP: " + THEME_NAMES[newPracticeSettings._newGame._theme], centerX - 50, y, {
                    w: 100,
                    h: 20,
                })
            ) {
                ++newPracticeSettings._newGame._theme;
                if (newPracticeSettings._newGame._theme > 3) {
                    newPracticeSettings._newGame._theme = 0;
                }
            }
            y += 25;
            y += 25;
            if (
                button("create", "⚔ START GAME", centerX - 50, y, {
                    w: 100,
                    h: 20,
                })
            ) {
                result = newPracticeSettings;
            }
            y += 25;
            if (
                button("back", "⬅ BACK", centerX - 50, y, {
                    w: 100,
                    h: 20,
                }) ||
                keyboardDown[KeyCode.Escape]
            ) {
                menu = Menu.Main;
            }
        } else if (menu === Menu.CreateGame) {
            label("⚙️ CREATE GAME ROOM", 20, centerX, 30);
            let y = centerY - 70;
            if (
                button(
                    "visibility",
                    "ACCESS: " + (newGameSettings._newGame._flags & GameModeFlag.Public ? "👁️ PUBLIC" : "🕵️ PRIVATE"),
                    centerX - 50,
                    y,
                    {
                        w: 100,
                        h: 20,
                    },
                )
            ) {
                newGameSettings._newGame._flags ^= GameModeFlag.Public;
            }
            y += 25;
            if (
                button("players_limit", "MAX PLAYERS: " + newGameSettings._newGame._playersLimit, centerX - 50, y, {
                    w: 100,
                    h: 20,
                })
            ) {
                const MAX_PLAYERS = 8;
                ++newGameSettings._newGame._playersLimit;
                if (newGameSettings._newGame._playersLimit > MAX_PLAYERS) {
                    newGameSettings._newGame._playersLimit = 2;
                }
            }
            y += 25;
            const NPC_LEVELS = ["NONE", "RARE", "NORMAL", "CROWD"];
            if (
                button("npc_level", "NPC: " + NPC_LEVELS[newGameSettings._newGame._npcLevel], centerX - 50, y, {
                    w: 100,
                    h: 20,
                })
            ) {
                ++newGameSettings._newGame._npcLevel;
                if (newGameSettings._newGame._npcLevel >= NPC_LEVELS.length) {
                    newGameSettings._newGame._npcLevel = 0;
                }
            }
            y += 25;
            const THEME_NAMES = ["? RANDOM", "🌲 FOREST", "🌵 DESERT", "❄ SNOW"];
            if (
                button("map_theme", "MAP: " + THEME_NAMES[newGameSettings._newGame._theme], centerX - 50, y, {
                    w: 100,
                    h: 20,
                })
            ) {
                ++newGameSettings._newGame._theme;
                if (newGameSettings._newGame._theme > 3) {
                    newGameSettings._newGame._theme = 0;
                }
            }
            y += 25;
            y += 25;
            if (
                button("create", "⚔ START GAME", centerX - 50, y, {
                    w: 100,
                    h: 20,
                })
            ) {
                result = newGameSettings;
            }
            y += 25;
            if (
                button("back", "⬅ BACK", centerX - 50, y, {
                    w: 100,
                    h: 20,
                }) ||
                keyboardDown[KeyCode.Escape]
            ) {
                menu = Menu.Games;
            }
        }

        if (button("version_tag", " " + BuildClientVersion, 2, H - 16, {w: 48, h: 14, visible: true})) {
            open("https://github.com/eliasku/13", "_blank");
        }
    }
    ui_finish();
    return result;
};
