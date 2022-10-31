import {_sseState, clientName, connect, processMessages, setUserName} from "./net/messaging";
import {isAnyKeyDown, updateInput} from "./utils/input";
import {button, resetPrinter, ui_begin, ui_finish} from "./graphics/ui";
import {createSplashState, getScreenScale, resetGame, updateGame} from "./game/game";
import {loadAtlas} from "./assets/gfx";
import {speak} from "./audio/context";
import {updateFpsMeter} from "./utils/fpsMeter";
import {updateSong} from "./audio/gen";
import {drawText, fnt, updateFonts} from "./graphics/font";
import {beginRenderToMain, flush, gl} from "./graphics/draw2d";
import {BuildVersion} from "../shared/types";

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
        setUserName(prompt("your name"));
    }
    new FontFace("e", "url(e.ttf)").load().then((font) => {
        document.fonts.add(font);
        state = StartState.Loaded;
    });
    const _states: ((ts?: number) => void | undefined)[] = [
        ,
        (ts: number) => {
            beginRenderToMain(0, 0, 0, 0, 0, getScreenScale());
            drawText(fnt[0], "press any key...", 10 + Math.sin(ts), 2, 10, 0, 0);
            flush();
            if (isAnyKeyDown()) {
                loadAtlas();
                goToSplash();
            }
            fetch("i", {method: "POST"})
                .then(r => r.json())
                .then(j => usersOnline = Number.parseInt(j?.on))
                .catch(() => usersOnline = 0);
        },
        () => {
            const scale = getScreenScale();
            beginRenderToMain(0, 0, 0, 0, 0, scale);

            ui_begin(scale);
            {
                drawText(fnt[0], "name: " + clientName, 7, 2, 14, 0, 0);
                if (button("change_name", "change name", 2, 20)) {
                    setUserName(prompt("your name", clientName));
                }
                // if(usersOnline) {
                drawText(fnt[0], "online: " + usersOnline, 7, 2, 48, 0, 0);
                // }

                const centerX = (gl.drawingBufferWidth / scale) >> 1;
                const centerY = (gl.drawingBufferHeight / scale) >> 1;
                if (button("start", "[ START ]", centerX - 100, centerY + 90, {w: 200, h: 48, visible: false})) {
                    state = StartState.Connecting;
                    resetGame();
                    connect();
                }

                drawText(fnt[0], "version: " + BuildVersion, 7, 2, gl.drawingBufferHeight / scale - 1, 0, 0);
            }
            ui_finish();

            flush();
        },
        (ts: number) => {
            beginRenderToMain(0, 0, 0, 0, 0, getScreenScale());
            drawText(fnt[0], "connecting" + ".".repeat((ts * 7) & 7), 10 + Math.sin(ts), 2, 10, 0, 0);
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
        updateFpsMeter(ts);
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
        requestAnimationFrame(raf);
    }

    raf(0);

}
