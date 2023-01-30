import {_room, _sseState, clientName, connect, loadRoomsInfo, processMessages, setUserName} from "./net/messaging";
import {isAnyKeyDown, updateInput} from "./utils/input";
import {resetPrinter, ui_renderComplete} from "./graphics/gui";
import {createSplashState, enableReplayMode, gameMode, resetGame, updateGame} from "./game/game";
import {loadMainAtlas, loadSpotLightTexture} from "./assets/gfx";
import {speak} from "./audio/context";
import {updateStats} from "./utils/fpsMeter";
import {updateSong} from "./audio/music";
import {drawTextAligned, fnt, initFonts, updateFonts} from "./graphics/font";
import {beginRenderToMain, completeFrame, flush, gl} from "./graphics/draw2d";
import {BuildCommit, BuildHash, BuildVersion, GameModeFlag, RoomsInfoResponse} from "../../shared/src/types";
import {sin} from "./utils/math";
import {setupRAF} from "./utils/raf";
import {getScreenScale} from "./game/gameState";
import {completeLoading, setLoadingProgress} from "./preloader";
import {MenuCommand, menuScreen} from "./screens/main";
import {poki} from "./poki";
import {openReplayFile} from "./game/replay";
import {loadPlayerCode} from "./game/ai/common";

console.info(`13 game client ${BuildVersion} @${BuildCommit} ${BuildHash}`);

const enum StartState {
    Loading = 0,
    Loaded = 1,
    TapToStart = 2,
    Connecting = 3,
    Connected = 4,
}

type StateFunc = (ts?: number) => void | undefined;

async function start() {
    await poki._init();

    let state = StartState.Loading;
    let publicServerInfo: RoomsInfoResponse = {rooms: [], players: 0};

    const refreshRoomsInfo = async () => {
        if (state > StartState.Loaded && _sseState < 3) {
            publicServerInfo = await loadRoomsInfo();
        }
        setTimeout(refreshRoomsInfo, 2000);
    };
    const goToSplash = () => {
        state = StartState.TapToStart;
        resetGame();
        createSplashState();
        gameMode._title = true;
        gameMode._playersAI = true;
        gameMode._npcLevel = 3;
        speak("13 the game");
    }

    if (!clientName) {
        setUserName();
    }
    const itemsToLoad: Promise<any>[] = [];
    let loaded = 0;
    const updateProgress = (loaded: number) => {
        const total = itemsToLoad.length;
        setLoadingProgress(total ? (loaded / total) : 1.0);
    };
    const addLoadItem = <T>(task: Promise<T>): number => itemsToLoad.push(
        task.then(_ => updateProgress(++loaded))
    );
    addLoadItem(new FontFace("m", "url(m.ttf)").load().then(font => document.fonts.add(font)));
    addLoadItem(new FontFace("e", "url(e.ttf)").load().then(font => document.fonts.add(font)));
    addLoadItem(new FontFace("fa-brands-400", "url(fa-brands-400.ttf)").load().then(font => document.fonts.add(font)));
    addLoadItem(loadMainAtlas());
    addLoadItem(loadSpotLightTexture());
    updateProgress(loaded);
    Promise.all(itemsToLoad).then(_ => {
        initFonts();
        state = StartState.Loaded;
        resetGame();
        createSplashState();
        gameMode._npcLevel = 0;
        completeLoading();
        poki._gameLoadingFinished();

        // test load ai
        loadPlayerCode("./autoplay.js");
    });
    const preStates: StateFunc[] = [
        ,
        ,
        () => {
            const result = menuScreen(publicServerInfo);
            if (result) {
                if (result._command === MenuCommand.StartPractice) {
                    state = StartState.Connected;
                    resetGame();
                    connect(result._newGame);
                    gameMode._npcLevel = _room._npcLevel;
                } else if (result._command === MenuCommand.QuickStart) {
                    state = StartState.Connecting;
                    resetGame();
                    gameMode._title = true;
                    gameMode._tiltCamera = 0.05;
                    gameMode._bloodRain = true;
                    connect();
                } else if (result._command === MenuCommand.JoinGame) {
                    state = StartState.Connecting;
                    resetGame();
                    gameMode._title = true;
                    gameMode._tiltCamera = 0.05;
                    gameMode._bloodRain = true;
                    connect(undefined, result._joinByCode);
                } else if (result._command === MenuCommand.CreateGame) {
                    state = StartState.Connecting;
                    resetGame();
                    gameMode._title = true;
                    gameMode._tiltCamera = 0.05;
                    gameMode._bloodRain = true;
                    connect(result._newGame);
                } else if (result._command === MenuCommand.Replay) {
                    openReplayFile(replay => {
                        const replayRoom = replay._meta.room;
                        state = StartState.Connected;
                        resetGame();
                        connect({
                            _flags: replayRoom.flags | GameModeFlag.Offline,
                            _playersLimit: 1,
                            _npcLevel: replayRoom.npcLevel,
                            _theme: replayRoom.mapTheme + 1,
                        });
                        _room._mapSeed = replayRoom.mapSeed;
                        gameMode._npcLevel = _room._npcLevel;
                        enableReplayMode(replay);
                    });
                }
            }
        },
    ];
    const _states: StateFunc[] = [
        ,
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
                drawTextAligned(fnt[0], "PRESS ANY KEY", fontSize, centerX, centerY + 50, 0xd9ff66);
            }
            flush();
            if (isAnyKeyDown()) {
                state = StartState.TapToStart;
                // begin fetch rooms info
                refreshRoomsInfo();

                gameMode._playersAI = true;
                gameMode._npcLevel = 3;
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
            drawTextAligned(fnt[0], "CONNECTING", fontSize, centerX, centerY + 40, 0xd9ff66);
            drawTextAligned(fnt[0], ".".repeat((ts * 7) & 7), fontSize, centerX, centerY + 50, 0xdddddd);
            flush();
            if (_sseState == 3) {
                gameMode._title = false;
                gameMode._tiltCamera = 0.0;
                gameMode._bloodRain = false;
                gameMode._npcLevel = _room._npcLevel;
                state = StartState.Connected;
                speak("fight");
            } else if (!_sseState) {
                // failed to connect and start the room
                goToSplash();
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

start();