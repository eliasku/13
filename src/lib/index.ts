import {connect, disconnect, getUserName, setUserName} from "./net/messaging";
import {initInput, isAnyKeyDown, updateInput} from "./utils/input";
import {termClear, termFlush, termPrint} from "./utils/log";
import {initTestGame, updateTestGame} from "./game/game";
import {initDraw2d} from "./graphics/draw2d";
import {loadAtlas} from "./assets/gfx";
import {play} from "./audio/context";
import {fps, updateFpsMeter} from "./utils/fpsMeter";
import {Bgm, bgm, loadMusic} from "./assets/bgm";
import {loadSounds} from "./assets/sfx";

initInput();
initDraw2d();

const enum StartState {
    Loading = 0,
    TapToConnect = 1,
    Connecting = 2,
    Connected = 3,
}

let state = StartState.Loading;
const onStart = async () => {
    if (state !== StartState.TapToConnect) return;
    state = StartState.Connecting;
    onbeforeunload = disconnect;
    await connect();

    play(bgm[Bgm.main], 0.5, 0, true);

    initTestGame();
    state = StartState.Connected;
};

const font = new FontFace("emoji", `url(emoji.ttf)`);
font.load().then(() => {
    document.fonts.add(font);
    loadMusic();
    loadSounds();
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
};

function doFrame(ts: number) {
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
            updateTestGame(ts);
            break;
    }
    termFlush();
}

requestAnimationFrame(raf);
