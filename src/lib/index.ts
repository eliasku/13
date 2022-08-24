import {connect, disconnect, getClientId, getRemoteClients} from "./net/messaging";
import {initInput, resetInput} from "./utils/input";
import {initGL} from "./graphics/gl";
import {termClear, termFlush, termPrint} from "./debug/log";
import {initTestGame, updateTestGame} from "./game/game";
import {initDraw2d} from "./graphics/draw2d";
import {loadResources, snd_blip, snd_music} from "./game/res";
import {play} from "./audio/context";
import {fps, updateFpsMeter} from "./utils/fpsMeter";

const canvas = document.getElementById("g") as HTMLCanvasElement;
let sw = 1000;
let sh = 1000;
let ss = 1.0;

initInput(canvas);
initGL(canvas);
initDraw2d();

let starting = false;
let started = false;
const onStart = async () => {
    if(starting || started) return;

    starting = true;
    canvas.removeEventListener("touchstart", onStart);
    canvas.removeEventListener("mousedown", onStart);

    window.addEventListener("beforeunload", disconnect);
    await connect();

    play(snd_music, true, 0.05);

    initTestGame();
    started = true;
};

loadResources();
canvas.addEventListener("touchstart", onStart, {passive: true});
canvas.addEventListener("mousedown", onStart);

let idxResize = 0;
function doResize() {
    if (0 >= --idxResize) {
        idxResize = 30;
        const b = document.body;
        if (ss !== devicePixelRatio || sw !== b.clientWidth || sh !== b.clientHeight) {
            ss = devicePixelRatio;
            sw = b.clientWidth;
            sh = b.clientHeight;
            canvas.style.width = sw + "px";
            canvas.style.height = sh + "px";
            canvas.width = (sw * ss) | 0;
            canvas.height = (sh * ss) | 0;
        }
    }
};

let tsPrev = 0.0;
let rawDeltaTime = 0.0;
let deltaTime = 0.0;
const raf = (ts: DOMHighResTimeStamp) => {
    rawDeltaTime = (ts - tsPrev) * 0.001;
    deltaTime = Math.min(0.1, rawDeltaTime);

    doResize();
    doFrame(ts / 1000.0);
    resetInput();

    tsPrev = ts;
    requestAnimationFrame(raf);
};

function doFrame(ts: number) {
    updateFpsMeter(ts);
    termClear();
    termPrint(`FPS: ${fps}\n`);
    if (started) {
        updateTestGame(ts);
    } else {
        if(!starting) {
            termPrint("\nTap to connect!\n");
        }
        else {
            termPrint("Connecting...\n");
            termPrint("┌ " + getClientId() + "\n");
            for (const rc of getRemoteClients()) {
                termPrint("├ " + rc.id + " " + (rc.pc ? rc.pc.iceConnectionState : "x") + "\n");
            }
        }
    }
    termFlush();
}

requestAnimationFrame(raf);
