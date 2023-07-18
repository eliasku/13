import {_room, _sseState, clientName, connect, loadRoomsInfo, processMessages, setUserName} from "./net/messaging.js";
import {isAnyKeyDown, updateInput} from "./utils/input.js";
import {resetPrinter, ui_renderComplete} from "./graphics/gui.js";
import {createSplashState, resetGame, updateGame} from "./game/game.js";
import {loadMainAtlas, loadSpotLightTexture} from "./assets/gfx.js";
import {speak} from "./audio/context.js";
import {updateStats} from "./utils/fpsMeter.js";
import {updateSong} from "./audio/music.js";
import {drawTextAligned, fnt, initFonts, updateFonts} from "./graphics/font.js";
import {beginRenderToMain, completeFrame, flush, gl} from "./graphics/draw2d.js";
import {BuildClientVersion, BuildCommit, BuildHash, GameModeFlag, RoomsInfoResponse,} from "@iioi/shared/types.js";
import {sin} from "./utils/math.js";
import {setupRAF} from "./utils/raf.js";
import {gameMode} from "./game/gameState.js";
import {getScreenScale} from "./game/camera.js";
import {completeLoading, setLoadingProgress} from "./preloader.js";
import {MenuCommand, menuScreen} from "./screens/main.js";
import {poki} from "./poki.js";
import {openReplayFile} from "./game/replay/replayFile.js";
import {loadPlayerCode} from "./game/ai/common.js";
import {enableReplayMode} from "@iioi/client/game/replay/viewer.js";
import {setGameConfig} from "./game/config.js";
import {GameConfig} from "./data/config.js";
import {loadJSON} from "./utils/loaders.js";
import {logScreenView, logUserEvent} from "./analytics.js";
import {setRtcConfiguration} from "./net/iceServers.js";
import {initModals, modalPopup} from "./modals/index.js";
import {parseRadix64String} from "@iioi/shared/radix64.js";
import {L, loadInitialTranslations} from "./assets/text.js";

console.info(`13 game client ${BuildClientVersion} @${BuildCommit} ${BuildHash}`);
logScreenView("loading");

const StartState = {
    Loading: 0,
    Loaded: 1,
    Home: 2,
    Connecting: 3,
    Connected: 4,
} as const;
type StartState = (typeof StartState)[keyof typeof StartState];
type StateFunc = (ts?: number) => void | undefined;

const start = async () => {
    await poki._init();

    initModals();

    let state: StartState = StartState.Loading;
    let publicRoomsInfo: RoomsInfoResponse = {v: BuildClientVersion, rooms: [], players: 0};

    const refreshRoomsInfo = async () => {
        if (state > StartState.Loaded && _sseState < 3) {
            publicRoomsInfo = await loadRoomsInfo();
        }
        setTimeout(refreshRoomsInfo, 2000);
    };
    const gotoHome = () => {
        state = StartState.Home;
        resetGame();
        createSplashState();
        gameMode._title = true;
        gameMode._playersAI = true;
        gameMode._npcLevel = 3;
        speak("13 the game");
        logScreenView("home_screen");
    };

    if (!clientName) {
        setUserName();
    }
    const itemsToLoad: Promise<void>[] = [];
    let loaded = 0;
    const updateProgress = (loaded: number) => {
        const total = itemsToLoad.length;
        setLoadingProgress(total ? loaded / total : 1.0);
    };
    const addLoadItem = <T>(task: Promise<T>): number => itemsToLoad.push(task.then(() => updateProgress(++loaded)));
    addLoadItem(loadJSON<GameConfig>("config.json").then(gameConfig => setGameConfig(gameConfig)));
    addLoadItem(loadJSON<RTCConfiguration>("ice.json").then(config => setRtcConfiguration(config)));
    addLoadItem(loadInitialTranslations());
    addLoadItem(new FontFace("m", "url(m.ttf)").load().then(font => document.fonts.add(font)));
    addLoadItem(new FontFace("e", "url(e.ttf)").load().then(font => document.fonts.add(font)));
    addLoadItem(new FontFace("fa-brands-400", "url(fa-brands-400.ttf)").load().then(font => document.fonts.add(font)));
    addLoadItem(loadMainAtlas());
    addLoadItem(loadSpotLightTexture());
    updateProgress(loaded);
    Promise.all(itemsToLoad).then(() => {
        initFonts();
        state = StartState.Loaded;
        resetGame();
        createSplashState();
        gameMode._npcLevel = 0;
        completeLoading();
        poki._gameLoadingFinished();

        // test load ai
        loadPlayerCode("./autoplay.js");

        logScreenView("splash_screen");
    });

    const preStates: StateFunc[] = [
        undefined,
        undefined,
        () => {
            const result = menuScreen(publicRoomsInfo);
            if (result) {
                if (result._command === MenuCommand.StartPractice) {
                    logUserEvent("start_practice");
                    state = StartState.Connected;
                    resetGame();
                    connect(result._newGame);
                    gameMode._npcLevel = _room._npcLevel;
                } else if (result._command === MenuCommand.QuickStart) {
                    logUserEvent("quick_start");
                    state = StartState.Connecting;
                    resetGame();
                    gameMode._title = true;
                    gameMode._tiltCamera = 0.05;
                    gameMode._bloodRain = true;
                    connect();
                } else if (result._command === MenuCommand.JoinGame) {
                    const joinRoomByCode = (code: string) => {
                        logUserEvent("join_game_by_code");
                        state = StartState.Connecting;
                        resetGame();
                        gameMode._title = true;
                        gameMode._tiltCamera = 0.05;
                        gameMode._bloodRain = true;
                        connect(undefined, code);
                    };
                    if (result._joinByCode) {
                        joinRoomByCode(result._joinByCode)
                    } else {
                        modalPopup({
                            title: L("popup_join_title"),
                            desc: L("popup_join_desc"),
                            value: ""
                        }).then((code) => {
                            const ri = code.lastIndexOf("r=");
                            if (ri) {
                                code = code.substring(ri + 2);
                            }
                            const v = parseRadix64String(code);
                            if (v) {
                                joinRoomByCode(code);
                            } else {
                                console.warn("bad game code");
                            }
                        }).catch(() => {
                            //
                        });
                    }
                } else if (result._command === MenuCommand.CreateGame) {
                    logUserEvent("create_new_game");
                    state = StartState.Connecting;
                    resetGame();
                    gameMode._title = true;
                    gameMode._tiltCamera = 0.05;
                    gameMode._bloodRain = true;
                    connect(result._newGame);
                } else if (result._command === MenuCommand.Replay) {
                    logUserEvent("open_replay_file");
                    openReplayFile(replay => {
                        const replayRoom = replay._meta.room;
                        if (replayRoom) {
                            logUserEvent("view_replay_file");
                            state = StartState.Connected;
                            resetGame();
                            connect({
                                _flags: replayRoom.flags | GameModeFlag.Offline,
                                _playersLimit: 1,
                                _npcLevel: replayRoom.npcLevel,
                                _theme: replayRoom.mapTheme + 1,
                            });
                            if (_room) {
                                _room._mapSeed = replayRoom.mapSeed;
                                gameMode._npcLevel = _room._npcLevel;
                                enableReplayMode(replay);
                            } else {
                                console.warn("internal error: room is not created");
                            }
                        } else {
                            console.warn("internal error: replay room is invalid");
                        }
                    });
                }
            }
        },
    ];
    const _states: StateFunc[] = [
        undefined,
        (ts: number) => {
            // game is loaded, user sees "PRESS ANY KEY" message and waits for first user click
            const scale = getScreenScale();
            const W = (gl.drawingBufferWidth / scale) | 0;
            const H = (gl.drawingBufferHeight / scale) | 0;
            const centerX = W >> 1;
            const centerY = H >> 1;
            beginRenderToMain(0, 0, 0, 0, 0, scale);
            const fontSize = 14 + 0.5 * Math.sin(8 * ts);
            if (sin(ts * 8) <= 0) {
                drawTextAligned(fnt[0], L("press_any_key"), fontSize, centerX, centerY + 50, 0xd9ff66);
            }
            flush();
            if (isAnyKeyDown()) {
                state = StartState.Home;
                // begin fetch rooms info
                refreshRoomsInfo();

                gameMode._playersAI = true;
                gameMode._npcLevel = 3;

                const code = poki._getURLParam("r");
                if (code) {
                    state = StartState.Connecting;
                    resetGame();
                    gameMode._title = true;
                    gameMode._tiltCamera = 0.05;
                    gameMode._bloodRain = true;
                    connect(undefined, code);
                }
            }
        },
        () => {
            /* do nothing */
        },
        (ts: number) => {
            const scale = getScreenScale();
            const W = (gl.drawingBufferWidth / scale) | 0;
            const H = (gl.drawingBufferHeight / scale) | 0;
            const centerX = W >> 1;
            const centerY = H >> 1;
            beginRenderToMain(0, 0, 0, 0, 0, getScreenScale());
            const fontSize = 10 + 0.5 * Math.sin(4 * ts);
            drawTextAligned(fnt[0], L("connecting"), fontSize, centerX, centerY + 40, 0xd9ff66);
            drawTextAligned(fnt[0], ".".repeat((ts * 7) & 7), fontSize, centerX, centerY + 50, 0xdddddd);
            flush();
            if (_sseState == 3) {
                gameMode._title = false;
                gameMode._tiltCamera = 0.0;
                gameMode._bloodRain = false;
                gameMode._npcLevel = _room._npcLevel;
                state = StartState.Connected;
                speak("fight");
                logUserEvent("room_connected");
            } else if (!_sseState) {
                // failed to connect and start the room
                gotoHome();
            }
        },
        () => {
            // exit room / disconnect
            // if (keyboardDown[KeyCode.Escape]) {
            //     disconnect();
            // }
            if (!_sseState) {
                // user disconnected or quit the game room
                poki._gameplayStop();
                gotoHome();
            }
        },
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
};

start().then();
