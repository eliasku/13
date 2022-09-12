import {_sseState, connect, clientName, setUserName, processMessages} from "./net/messaging";
import {isAnyKeyDown, updateInput} from "./utils/input";
import {termPrint} from "./graphics/ui";
import {createSplashState, resetGame, updateTestGame} from "./game/game";
import {loadAtlas} from "./assets/gfx";
import {speak} from "./audio/context";
import {updateFpsMeter} from "./utils/fpsMeter";
import {updateSong} from "./audio/gen";

const enum StartState {
    Loading = 0,
    TapToConnect = 1,
    Connecting = 2,
    Connected = 3,
}

let state = StartState.Loading;

const goToSplash = () => {
    state = StartState.TapToConnect;
    resetGame();
    createSplashState();
}

new FontFace("e", "url(e.ttf),local(Arial)").load().then((font) => {
    document.fonts.add(font);
    loadAtlas();
    //goToSplash();
    if (!clientName) {
        setUserName(prompt("pick your name") || "guest");
    }
});

const raf = (ts: DOMHighResTimeStamp) => {
    ts /= 1000;
    //** DO FRAME **//
    l.innerText = updateFpsMeter(ts) + "\n";
    updateSong(state != StartState.Connected);

    switch (state) {
        case StartState.TapToConnect:
            updateTestGame(ts);
            if (isAnyKeyDown()) {
                resetGame();
                state = StartState.Connecting;
                connect();
            }
            break;
        case StartState.Loading:
            l.innerText += "tap to start";
            if(isAnyKeyDown()) {
                goToSplash();
            }
            break;
        case StartState.Connecting:
            termPrint("╫╪"[ts * 9 & 0x1]);
            updateTestGame(ts);
            if (_sseState == 3) {
                state = StartState.Connected;
                speak("Fight!");
            }
            else if(!_sseState) {
                goToSplash();
            }
            break;
        default:
            updateTestGame(ts);
            if (!_sseState) {
                goToSplash();
            }
            break;
    }

    updateInput();
    processMessages();
    requestAnimationFrame(raf);
}

raf(0);
