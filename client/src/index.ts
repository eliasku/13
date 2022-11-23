import {
    _sseState, clientId,
    clientName,
    connect,
    disconnect,
    loadCurrentOnlineUsers,
    processMessages, remoteClients,
    setUserName
} from "./net/messaging";
import {isAnyKeyDown, keyboardDown, KeyCode, updateInput} from "./utils/input";
import {button, resetPrinter, ui_begin, ui_finish} from "./graphics/ui";
import {createSeedGameState, createSplashState, gameMode, getScreenScale, resetGame, updateGame} from "./game/game";
import {loadAtlas} from "./assets/gfx";
import {speak} from "./audio/context";
import {updateStats} from "./utils/fpsMeter";
import {updateSong} from "./audio/gen";
import {drawTextShadowCenter, fnt, initFonts, updateFonts} from "./graphics/font";
import {beginRenderToMain, completeFrame, flush, gl} from "./graphics/draw2d";
import {BuildVersion} from "../../shared/types";
import {sin} from "./utils/math";
import {GL} from "./graphics/gl";

const enum StartState {
    Loading = 0,
    Loaded = 1,
    TapToConnect = 2,
    Connecting = 3,
    Connected = 4,
}

{
    let usersOnline = 0;
    let state = StartState.Loading;

    const goToSplash = () => {
        state = StartState.TapToConnect;
        resetGame();
        createSplashState();
        gameMode.title = true;
        gameMode.playersAI = true;
        gameMode.spawnNPC = true;
        speak("13 the game");
    }

    if (!clientName) {
        setUserName("Guest " + ((Math.random() * 1000) | 0));
    }
    Promise.all([
        new FontFace("m", "url(m.ttf)").load().then(font => document.fonts.add(font)),
        new FontFace("e", "url(e.ttf)").load().then(font => document.fonts.add(font))
    ]).then(_ => {
        initFonts();
        loadAtlas();
        state = StartState.Loaded;

        resetGame();
        createSplashState();
        gameMode.spawnNPC = false;
    });
    const _states: ((ts?: number) => void | undefined)[] = [
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
                state = StartState.TapToConnect;
                gameMode.playersAI = true;
                gameMode.spawnNPC = true;
                loadCurrentOnlineUsers().then((count) => {
                    usersOnline = count;
                });
            }
        },
        () => {
            const scale = getScreenScale();
            beginRenderToMain(0, 0, 0, 0, 0, scale);

            ui_begin(scale);
            {
                const W = (gl.drawingBufferWidth / scale) | 0;
                const H = (gl.drawingBufferHeight / scale) | 0;
                const centerX = W >> 1;
                const centerY = H >> 1;
                drawTextShadowCenter(fnt[0], "Welcome back,", 7, centerX, 14);
                if (button("change_name", clientName + " ✏️", centerX - 64 / 2, 20)) {
                    setUserName(prompt("your name", clientName));
                }

                drawTextShadowCenter(fnt[0], usersOnline + " playing right now", 7, centerX, centerY + 65);

                if (button("start", "⚔ FIGHT", centerX - 50, centerY + 70, {w: 100, h: 20})) {
                    state = StartState.Connecting;
                    resetGame();
                    gameMode.title = true;
                    connect();
                }

                if (button("practice", "🏹 PRACTICE", centerX - 50, centerY + 100, {w: 100, h: 20})) {
                    state = StartState.Connected;
                    resetGame();
                    gameMode.title = false;
                    connect(true);
                }

                if (button("version_tag", "🏷 v" + BuildVersion, 2, H - 16, {w: 48, h: 14, visible: true})) {
                    open("https://github.com/eliasku/13", "_blank");
                }
            }
            ui_finish();

            flush();
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
                state = StartState.Connected;
                speak("fight");
            } else if (!_sseState) {
                goToSplash();
            }
        },
        () => {
            // debug disconnect
            if (keyboardDown[KeyCode.Digit5]) {
                disconnect();
            }
            if (!_sseState) {
                goToSplash();
            }
        }
    ];

    const raf = (ts: DOMHighResTimeStamp) => {
        ts /= 1000;
        updateStats(ts);
        //** DO FRAME **//
        updateSong(state != StartState.Connected);
        if (state >= StartState.Loaded) {
            updateGame(ts);
        }
        _states[state]?.(ts);
        updateFonts();
        resetPrinter();
        updateInput();
        processMessages();

        completeFrame();
        requestAnimationFrame(raf);
    }

    raf(0);

}
