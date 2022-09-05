import {_sseState, connect, getUserName, setUserName} from "./net/messaging";
import {isAnyKeyDown, updateInput} from "./utils/input";
import {termClear, termFlush, termPrint} from "./utils/log";
import {resetGame, updateTestGame} from "./game/game";
import {loadAtlas} from "./assets/gfx";
import {play} from "./audio/context";
import {fps, updateFpsMeter} from "./utils/fpsMeter";
import {Bgm, bgm} from "./assets/bgm";

// initDraw2d();

const enum StartState {
    Loading = 0,
    TapToConnect = 1,
    Connecting = 2,
    Connected = 3,
}

let state = StartState.Loading;
let music: AudioBufferSourceNode;
const onStart = async () => {
    if (state !== StartState.TapToConnect) return;
    state = StartState.Connecting;
    //onbeforeunload = disconnect;
    await connect();
    music = play(bgm[Bgm.main], 0.5, 0, true);
    resetGame();
    state = StartState.Connected;
};

new FontFace("e", `url(e.ttf)`).load().then((font) => {
    document.fonts.add(font);
    // loadZZFX();
    // loadMusic();
    loadAtlas();
    if (!getUserName()) {
        const defaultName = "guest";
        setUserName(prompt("pick your name", defaultName) || defaultName);
    }
    state = StartState.TapToConnect;
});

const raf = (ts: DOMHighResTimeStamp) => {
    doFrame(ts / 1000);
    updateInput();
    requestAnimationFrame(raf);
}

const doFrame = (ts: number) => {
    updateFpsMeter(ts);
    termClear();
    termPrint(`FPS: ${fps}\n`);

    switch (state) {
        case StartState.TapToConnect:
            termPrint("\nTap to connect!\n");
            if (isAnyKeyDown()) {
                onStart();
            }
            break;
        case StartState.Loading:
            termPrint("\nLoading...\n");
            break;
        case StartState.Connecting:
            termPrint("Connecting...\n");
            break;
        default:
            if (_sseState) {
                updateTestGame(ts);
            } else {
                if (music) {
                    music.stop();
                }
                state = StartState.TapToConnect;
            }
            break;
    }
    termFlush();
}

requestAnimationFrame(raf);
