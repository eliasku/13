import {_sseState, clientName, connect, disconnect, loadRoomsInfo, processMessages, setUserName} from "./net/messaging";
import {isAnyKeyDown, keyboardDown, KeyCode, updateInput} from "./utils/input";
import {resetPrinter, ui_renderComplete} from "./graphics/ui";
import {createSplashState, gameMode, resetGame, updateGame} from "./game/game";
import {loadMainAtlas, loadSpotLightTexture} from "./assets/gfx";
import {speak} from "./audio/context";
import {updateStats} from "./utils/fpsMeter";
import {updateSong} from "./audio/gen";
import {drawTextShadowCenter, fnt, initFonts, updateFonts} from "./graphics/font";
import {beginRenderToMain, completeFrame, flush, gl} from "./graphics/draw2d";
import {RoomsInfoResponse} from "../../shared/src/types";
import {sin} from "./utils/math";
import {setupRAF} from "./utils/raf";
import {getScreenScale} from "./game/gameState";
import {completeLoading, setLoadingProgress} from "./preloader";
import {MenuCommand, menuScreen} from "./screens/main";

const enum StartState {
    Loading = 0,
    Loaded = 1,
    TapToStart = 2,
    Connecting = 3,
    Connected = 4,
}

type StateFunc = (ts?: number) => void | undefined;

{
    let state: StartState = StartState.Loading;

    let publicServerInfo: RoomsInfoResponse = {rooms: [], players: 0};
    setInterval(async () => {
        if (state > StartState.Loaded && _sseState < 3) {
            publicServerInfo = await loadRoomsInfo();
        }
    }, 2000);

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
        gameMode.spawnNPC = false;
        completeLoading();
    });
    const preStates: StateFunc[] = [
        ,
        ,
        () => {
            const result = menuScreen(publicServerInfo);
            if (result) {
                if (result.command === MenuCommand.StartPractice) {
                    state = StartState.Connected;
                    resetGame();
                    connect(true);
                } else if (result.command === MenuCommand.QuickStart) {
                    state = StartState.Connecting;
                    resetGame();
                    gameMode.title = true;
                    gameMode.tiltCamera = 0.05;
                    gameMode.bloodRain = true;
                    connect(false);
                } else if (result.command === MenuCommand.JoinGame) {
                    state = StartState.Connecting;
                    resetGame();
                    gameMode.title = true;
                    gameMode.tiltCamera = 0.05;
                    gameMode.bloodRain = true;
                    connect(false, result.joinByCode);
                } else if (result.command === MenuCommand.CreateGame) {
                    state = StartState.Connecting;
                    resetGame();
                    gameMode.title = true;
                    gameMode.tiltCamera = 0.05;
                    gameMode.bloodRain = true;
                    connect(false, undefined, result.createPrivate ? "1" : "0");
                }
            }
        },
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
