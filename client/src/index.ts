import {
    _sseState,
    clientName,
    connect,
    disconnect,
    loadRoomsInfo,
    processMessages,
    RoomInfo,
    setUserName
} from "./net/messaging";
import {isAnyKeyDown, keyboardDown, KeyCode, updateInput} from "./utils/input";
import {button, label, resetPrinter, ui_begin, ui_finish, ui_renderComplete} from "./graphics/ui";
import {createSplashState, gameMode, resetGame, updateGame} from "./game/game";
import {loadMainAtlas, loadSpotLightTexture} from "./assets/gfx";
import {speak} from "./audio/context";
import {updateStats} from "./utils/fpsMeter";
import {updateSong} from "./audio/gen";
import {drawTextShadowCenter, fnt, initFonts, updateFonts} from "./graphics/font";
import {beginRenderToMain, completeFrame, flush, gl} from "./graphics/draw2d";
import {BuildVersion} from "../../shared/types";
import {sin} from "./utils/math";
import {DEFAULT_FRAMERATE_LIMIT, setSetting, settings} from "./game/settings";
import {setupRAF} from "./utils/raf";
import {getScreenScale} from "./game/gameState";
import {completeLoading, setLoadingProgress} from "./preloader";

const enum StartState {
    Loading = 0,
    Loaded = 1,
    TapToStart = 2,
    Connecting = 3,
    Connected = 4,
}

type StateFunc = (ts?: number) => void | undefined;

const enum Menu {
    Main = 0,
    Settings = 1,
    Dev = 2,
}

{
    let availableRooms: RoomInfo[] = [];
    const getTotalOnline = () => {
        let total = 0;
        for (const room of availableRooms) {
            total += room.players;
        }
        return total;
    }
    setInterval(async () => {
        if (state > StartState.Loaded && _sseState < 3) {
            availableRooms = await loadRoomsInfo();
        }
    }, 2000);
    let state: StartState = StartState.Loading;
    let menu: Menu = Menu.Main;
    let devLock: number = 0;
    const goToSplash = () => {
        state = StartState.TapToStart;
        resetGame();
        createSplashState();
        gameMode.title = true;
        gameMode.playersAI = true;
        gameMode.spawnNPC = true;
        speak("13 the game");
    }

    if (!clientName) {
        setUserName();
    }
    let loaded = 0;
    let total = 4;
    const updateProgress = () => {
        setLoadingProgress(loaded / total);
    };
    const wrapLoadItem = <T>(task: Promise<T>) => task.then((r) => {
        ++loaded;
        updateProgress();
        return r;
    });
    updateProgress();
    Promise.all([
        wrapLoadItem(new FontFace("m", "url(m.ttf)").load().then(font => document.fonts.add(font))),
        wrapLoadItem(new FontFace("e", "url(e.ttf)").load().then(font => document.fonts.add(font))),
        wrapLoadItem(loadMainAtlas()),
        wrapLoadItem(loadSpotLightTexture()),
    ]).then(_ => {
        initFonts();
        state = StartState.Loaded;
        resetGame();
        createSplashState();
        gameMode.spawnNPC = false;
        completeLoading();
    });
    const preStates: StateFunc[] = [
        ,
        ,
        () => {
            const scale = getScreenScale();
            ui_begin(scale);
            {
                const W = (gl.drawingBufferWidth / scale) | 0;
                const H = (gl.drawingBufferHeight / scale) | 0;
                const centerX = W >> 1;
                const centerY = H >> 1;

                if (menu === Menu.Main) {
                    label("Welcome back,", 7, centerX, 14);
                    if (button("change_name", clientName + " ✏️", centerX - 64 / 2, 20)) {
                        setUserName(prompt("your name", clientName));
                    }

                    const total = getTotalOnline();
                    if (total > 0) {
                        label(`${total} playing right now`, 7, centerX, centerY + 45);
                    }

                    if (button("dev_mode", "", centerX - 40, centerY - 40, {w: 80, h: 80, visible: false})) {
                        if (++devLock > 3) {
                            setSetting("dev", 1);
                            menu = Menu.Dev;
                        }
                    }

                    if (button("start", total ? "⚔ FIGHT" : "⚔ CREATE GAME", centerX - 50, centerY + 50, {
                        w: 100,
                        h: 20
                    })) {
                        state = StartState.Connecting;
                        resetGame();
                        gameMode.title = true;
                        gameMode.tiltCamera = 0.05;
                        gameMode.bloodRain = true;
                        connect();
                    }

                    if (button("practice", "🏹 PRACTICE", centerX - 50, centerY + 75, {w: 100, h: 20})) {
                        state = StartState.Connected;
                        resetGame();
                        connect(true);
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
                }

                if (button("version_tag", "🏷 v" + BuildVersion, 2, H - 16, {w: 48, h: 14, visible: true})) {
                    open("https://github.com/eliasku/13", "_blank");
                }
            }
            ui_finish();
        }
    ];
    const _states: StateFunc[] = [
        ,
        (ts: number) => {
            const scale = getScreenScale();
            const W = (gl.drawingBufferWidth / scale) | 0;
            const H = (gl.drawingBufferHeight / scale) | 0;
            const centerX = W >> 1;
            const centerY = H >> 1;
            beginRenderToMain(0, 0, 0, 0, 0, scale);
            const fontSize = 14 + 0.5 * Math.sin(8 * ts);
            if (sin(ts * 8) <= 0) {
                drawTextShadowCenter(fnt[0], "PRESS ANY KEY", fontSize, centerX, centerY + 50, 0xd9ff66);
            }
            flush();
            if (isAnyKeyDown()) {
                state = StartState.TapToStart;
                gameMode.playersAI = true;
                gameMode.spawnNPC = true;
            }
        },
        () => {
        },
        (ts: number) => {
            const scale = getScreenScale();
            const W = (gl.drawingBufferWidth / scale) | 0;
            const H = (gl.drawingBufferHeight / scale) | 0;
            const centerX = W >> 1;
            const centerY = H >> 1;
            beginRenderToMain(0, 0, 0, 0, 0, getScreenScale());
            const fontSize = 10 + 0.5 * Math.sin(4 * ts);
            drawTextShadowCenter(fnt[0], "CONNECTING", fontSize, centerX, centerY + 40, 0xd9ff66);
            drawTextShadowCenter(fnt[0], ".".repeat((ts * 7) & 7), fontSize, centerX, centerY + 50, 0xdddddd);
            flush();
            if (_sseState == 3) {
                gameMode.title = false;
                gameMode.tiltCamera = 0.0;
                gameMode.bloodRain = false;
                state = StartState.Connected;
                speak("fight");
            } else if (!_sseState) {
                goToSplash();
            }
        },
        () => {
            // exit room / disconnect
            if (keyboardDown[KeyCode.Escape]) {
                disconnect();
            }
            if (!_sseState) {
                goToSplash();
            }
        }
    ];

    setupRAF((ts: DOMHighResTimeStamp) => {
        ts /= 1000;
        updateStats(ts);
        //** DO FRAME **//
        updateSong(state !== StartState.Connected);

        preStates[state]?.(ts);
        if (state >= StartState.Loaded) {
            updateGame(ts);
        }
        _states[state]?.(ts);
        updateFonts();
        resetPrinter();
        updateInput();
        processMessages();
        ui_renderComplete();

        completeFrame();
    });
}
