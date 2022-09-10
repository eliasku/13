import {_sseState, connect, clientName, setUserName} from "./net/messaging";
import {isAnyKeyDown, updateInput} from "./utils/input";
import {termPrint} from "./graphics/ui";
import {createSplashState, resetGame, updateTestGame} from "./game/game";
import {loadAtlas} from "./assets/gfx";
import {play, speak} from "./audio/context";
import {updateFpsMeter} from "./utils/fpsMeter";
import {Snd, snd} from "./assets/sfx";

const enum StartState {
    Loading = 0,
    TapToConnect = 1,
    Connecting = 2,
    Connected = 3,
}

let state = StartState.Loading;

const poem = "The horse ran faster than a gazelle.\n" +
    "It rasped and struggled, as if to battle;\n" +
    "At times it stopped,\n" +
    "And listened to the wind\n" +
    "And flared its nostrils;\n" +
    "And then, hitting the ground\n" +
    "With the ringing spikes of its hooves,\n" +
    "And shaking its disheveled mane,\n" +
    "It would take to running once again.\n" +
    "A silent rider sat upon the steed!\n" +
    "At times, he struggled in his seat,\n" +
    "Falling headfirst onto the horse's mane.\n" +
    "He no longer held the reins,\n" +
    "But his feet were still in the stirrups,\n" +
    "And one could see wide streams of blood\n" +
    "Upon his saddle cloth.\n" +
    "Valiant steed, you carried your master\n" +
    "Out of battle, swift as an arrow,\n" +
    "But an Ossetian wicked bullet\n" +
    "Found him in the dark!";

const goToSplash = () => {
    state = StartState.TapToConnect;
    createSplashState();
}

new FontFace("e", "url(e.ttf),local(Arial)").load().then((font) => {
    document.fonts.add(font);
    loadAtlas();
    goToSplash();
    if (!clientName) {
        setUserName(prompt("pick your name") || "guest");
    }
});

const raf = (ts: DOMHighResTimeStamp) => {
    ts /= 1000;
    //** DO FRAME **//
    l.innerText = updateFpsMeter(ts) + "\n";

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
        case StartState.Connecting:
            termPrint("╫╪"[ts * 9 & 0x1]);
            if (_sseState == 3) {
                state = StartState.Connected;
                play(snd[Snd.bgm], 0.5, 0, true);
                speak("Fight!");
            }
            break;
        default:
            updateTestGame(ts);
            if (!_sseState) {
                snd[Snd.bgm].currentSource_?.stop();
                goToSplash();
            }
            break;
    }

    updateInput();
    requestAnimationFrame(raf);
}

raf(0);
