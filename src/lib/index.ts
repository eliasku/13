import {_sseState, connect, getUserName, setUserName} from "./net/messaging";
import {isAnyKeyDown, updateInput} from "./utils/input";
import {termPrint} from "./graphics/ui";
import {createSplashState, resetGame, updateTestGame} from "./game/game";
import {loadAtlas} from "./assets/gfx";
import {play} from "./audio/context";
import {updateFpsMeter} from "./utils/fpsMeter";
import {Snd, snd} from "./assets/sfx";

// initDraw2d();

const enum StartState {
    Loading = 0,
    TapToConnect = 1,
    Connecting = 2,
    Connected = 3,
}

let state = StartState.Loading;
const onStart = async () => {
    if (state !== StartState.TapToConnect) return;
    resetGame();
    state = StartState.Connecting;
    //onbeforeunload = disconnect;
    await connect();

    state = StartState.Connected;
    play(snd[Snd.bgm], 0.5, 0, true);
};

new FontFace("e", `url(e.ttf)`).load().then((font) => {
    document.fonts.add(font);
    // loadZZFX();
    // loadMusic();
    loadAtlas();
    goToSplash();
    if (!getUserName()) {
        const defaultName = "guest";
        setUserName(prompt("pick your name", defaultName) || defaultName);
    }
});

const goToSplash = () => {
    state = StartState.TapToConnect;
    createSplashState();
}

const raf = (ts: DOMHighResTimeStamp) => {
    doFrame(ts / 1000);
    updateInput();
    requestAnimationFrame(raf);
}

const doFrame = (ts: number) => {
    l.innerText = updateFpsMeter(ts) + "\n";

    switch (state) {
        case StartState.TapToConnect:
            updateTestGame(ts);
            //termPrint("\nTAP TO START\n");
            if (isAnyKeyDown()) {
                onStart();
            }
            break;
        case StartState.Loading:
        case StartState.Connecting:
            termPrint("╫╪"[ts * 9 & 0x1]);
            break;
        default:
            updateTestGame(ts);
            if (!_sseState) {
                snd[Snd.bgm].$?.stop();
                goToSplash();
            }
            break;
    }
}

requestAnimationFrame(raf);
