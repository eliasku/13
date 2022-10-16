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

{
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
    new FontFace("e", "url(e.ttf)").load().then((font) => {
        document.fonts.add(font);
        state = StartState.Loaded;
    });
    const _states: ((ts?: number) => void | undefined)[] = [
        ,
        () => {
            l.innerText = "tap to start";
            if (isAnyKeyDown()) {
                loadAtlas();
                goToSplash();
            }
        },
        () => {
            if (isAnyKeyDown()) {
                state = StartState.Connecting;
                resetGame();
                connect();
            }
        },
        (ts: number) => {
            termPrint(".".repeat((ts * 7) & 7));
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
        //** DO FRAME **//
        updateSong(state != StartState.Connected);
        if (state > StartState.Loaded) {
            l.innerText = updateFpsMeter(ts) + "\n";
            updateTestGame(ts);
        }
        _states[state]?.(ts);
        updateInput();
        processMessages();
        requestAnimationFrame(raf);
    }

    raf(0);

}
