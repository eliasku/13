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
    Loaded = 1,
    TapToConnect = 2,
    Connecting = 3,
    Connected = 4,
}

let state = StartState.Loading;

const goToSplash = () => {
    state = StartState.TapToConnect;
    resetGame();
    createSplashState();
    speak("13 the game");
}

new FontFace("e", "url(e.ttf),local(Arial)").load().then((font) => {
    document.fonts.add(font);
    loadAtlas();
    //goToSplash();
    if (!clientName) {
        setUserName(prompt("pick your name") || "guest");
    }
    state = StartState.Loaded;
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
                state = StartState.Connecting;
                resetGame();
                connect();
            }
            break;
        case StartState.Loading:
            l.innerText = "loading" + ".".repeat((ts * 8) & 7);
            break;
        case StartState.Loaded:
            l.innerText = "tap to start";
            if(isAnyKeyDown()) {
                goToSplash();
            }
            break;
        case StartState.Connecting:
            updateTestGame(ts);
            termPrint(".".repeat((ts * 8) & 7));
            if (_sseState == 3) {
                state = StartState.Connected;
                speak("fight");
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
