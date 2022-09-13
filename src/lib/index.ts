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

if (!clientName) {
    setUserName(prompt("your name") || "guest");
}

new FontFace("e", ([[], "url(e.ttf),"][0 | confirm("load emoji") as any as number]) + "local(Arial)").load().then((font) => {
    document.fonts.add(font);
    loadAtlas();
    //goToSplash();
    state = StartState.Loaded;
});

const raf = (ts: DOMHighResTimeStamp) => {
    ts /= 1000;
    //** DO FRAME **//
    l.innerText = updateFpsMeter(ts) + "\n";
    updateSong(state != StartState.Connected);
    if (state > StartState.Loaded) {
        updateTestGame(ts);
    }
    switch (state) {
        case StartState.TapToConnect:
            if (isAnyKeyDown()) {
                state = StartState.Connecting;
                resetGame();
                connect();
            }
            break;
        case StartState.Loaded:
            l.innerText = "tap to start";
            if (isAnyKeyDown()) {
                goToSplash();
            }
            break;
        case StartState.Connecting:
            termPrint(".".repeat((ts * 7) & 7));
            if (_sseState == 3) {
                state = StartState.Connected;
                speak("fight");
            } else if (!_sseState) {
                goToSplash();
            }
            break;

        case StartState.Connected:
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
