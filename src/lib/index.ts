import {connect, disconnect} from "./net/messaging";
import {initInput} from "./fluid/input";
import {initGL} from "./graphics/gl";
import {termClear, termFlush, termPrint} from "./debug/log";
import {initTestGame, loadTestGame, updateTestGame} from "./game/game";
import {initDraw2d} from "./graphics/draw2d";

document.body.style.margin = "0";
document.body.style.height = "100vh";
document.body.style.overflow = "hidden";
const canvas = document.createElement("canvas");
canvas.style.backgroundColor = "black";
let sw = 1000;
let sh = 1000;
let ss = 1.0;
document.body.prepend(canvas);

// termPrint("Initialize.");
// termFlush();

initInput(canvas);
initGL(canvas);
initDraw2d();
loadTestGame();

termClear();
termPrint("Ready!\nTap to Start!\n");
termFlush();

let started = false;
const onStart = async () => {
    canvas.removeEventListener("touchstart", onStart);
    canvas.removeEventListener("mousedown", onStart);

    window.addEventListener("beforeunload", disconnect);
    await connect();

    initTestGame();
    started = true;
};

canvas.addEventListener("touchstart", onStart);
canvas.addEventListener("mousedown", onStart);

let idxResize = 0;
const doResize = () => {
    if (0 >= --idxResize) {
        idxResize = 30;
        if (ss !== devicePixelRatio || sw !== document.body.clientWidth || sh !== document.body.clientHeight) {
            ss = devicePixelRatio;
            sw = document.body.clientWidth;
            sh = document.body.clientHeight;
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
    doFrame();

    tsPrev = ts;
    requestAnimationFrame(raf);
};

const doFrame = () => {
    if (!started) {
        return;
    }

    updateTestGame(deltaTime);
};

requestAnimationFrame(raf);
