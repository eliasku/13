import {_sseState, clientName, connect, loadCurrentOnlineUsers, processMessages, setUserName} from "./net/messaging";
import {isAnyKeyDown, updateInput} from "./utils/input";
import {button, resetPrinter, ui_begin, ui_finish} from "./graphics/ui";
import {createSplashState, getScreenScale, resetGame, updateGame} from "./game/game";
import {loadAtlas} from "./assets/gfx";
import {speak} from "./audio/context";
import {updateStats} from "./utils/fpsMeter";
import {updateSong} from "./audio/gen";
import {drawTextShadowCenter, fnt, updateFonts} from "./graphics/font";
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
        speak("13 the game");
    }

    if (!clientName) {
        setUserName("Guest " + ((Math.random() * 1000) | 0));
    }
    new FontFace("e", "url(e.ttf)").load().then((font) => {
        document.fonts.add(font);
        state = StartState.Loaded;
    });
    const _states: ((ts?: number) => void | undefined)[] = [
        ,
        (ts: number) => {
            const scale = getScreenScale();
            const W = (gl.drawingBufferWidth / scale) | 0;
            const H = (gl.drawingBufferHeight / scale) | 0;
            const centerX = W >> 1;
            const centerY = H >> 1;
            const f = 0.5 + 0.5 * sin(ts);
            gl.clearColor(0.2 * f, 0.2 * (1 - f), 0.0, 1.0);
            gl.clear(GL.COLOR_BUFFER_BIT);
            beginRenderToMain(0, 0, 0, 0, 0, scale);
            const fontSize = 10 + 0.5 * Math.sin(8 * ts);
            if (sin(ts * 4) <= 0) {
                drawTextShadowCenter(fnt[0], "PRESS ANY KEY", fontSize, centerX, centerY, 0xd9ff66);
            } else {
                drawTextShadowCenter(fnt[0], "GAME 13", fontSize, centerX, centerY, 0xd00000);
            }
            flush();
            if (isAnyKeyDown()) {
                loadAtlas();
                goToSplash();
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
                drawTextShadowCenter(fnt[0], usersOnline + " playing right now", 7, centerX, centerY - 50);

                if (button("start", "[ START ]", centerX - 100, centerY + 70, {w: 200, h: 48, visible: false})) {
                    state = StartState.Connecting;
                    resetGame();
                    connect();
                }

                if (button("version-tag", "v" + BuildVersion + " 🏷", 2, H - 16, {w: 48, h: 14, visible: true})) {
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
            const f = 0.5 + 0.5 * sin(ts);
            gl.clearColor(0.2 * f, 0.2 * (1 - f), 0.0, 1.0);
            gl.clear(GL.COLOR_BUFFER_BIT);
            beginRenderToMain(0, 0, 0, 0, 0, getScreenScale());
            const fontSize = 10 + 0.5 * Math.sin(4 * ts);
            drawTextShadowCenter(fnt[0], "CONNECTING", fontSize, centerX, centerY - 5, 0xd9ff66);
            drawTextShadowCenter(fnt[0], ".".repeat((ts * 7) & 7), fontSize, centerX, centerY + 5, 0xdddddd);
            flush();
            if (_sseState == 3) {
                state = StartState.Connected;
                speak("fight");
            } else if (!_sseState) {
                goToSplash();
            }
        },
        () => {
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
        if (state > StartState.Loaded) {
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
