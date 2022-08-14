// main app entry point

import {play} from "./audio/context";
import {createAudioBuffer} from "./audio/sfxr";
import {createAudioBufferFromSong} from "./audio/soundbox";
import {song} from "./songs/0bit";
import {connect, disconnect, getLocalNode, getRemoteNodes, peerConnections} from "./net/messaging";
import {Fluid2dGpu} from "./fluid/fluid2d-gpu";
import {initInput} from "./fluid/input";
import {initGL} from "./fluid/gl";
import {log} from "./debug/log";

document.body.style.margin = "0";
document.body.style.height = "100vh";
const canvas = document.createElement("canvas");
let sw = 1000;
let sh = 1000;
let ss = 1.0;
document.body.prepend(canvas);
initInput(canvas);
initGL(canvas);

let textTerminal = document.createElement("label");
textTerminal.style.position = "fixed";

textTerminal.style.font = "24px monospace bold";
textTerminal.style.top = "0px";
textTerminal.style.left = "0px";
textTerminal.style.width = "100%";
textTerminal.style.height = "100%";
textTerminal.style.color = "white";
textTerminal.style.backgroundColor = "transparent";
textTerminal.style.background = "transparent";
textTerminal.style.touchAction = "none";
textTerminal.style.pointerEvents = "none";
document.body.appendChild(textTerminal);

const muted = false;
let sndBuffer: AudioBuffer | null = null;
let musicBuffer: AudioBuffer | null = null;
let musicSource: AudioBufferSourceNode | null = null;
sndBuffer = createAudioBuffer([2, 0, 0.032, 0.099, 0.0816678, 0.818264, 0, -0.241811, 0, 0.541487, 0.418269, 0, 0, 0, 0, 0, 0.175963, -0.27499, 1, 0, 0, 0.900178, 0]);
musicBuffer = createAudioBufferFromSong(song);

let glSim: Fluid2dGpu | undefined = undefined;
let started = false;
const onStart = async () => {
    canvas.removeEventListener("touchstart", onStart);
    canvas.removeEventListener("mousedown", onStart);
    if (!muted) {
        play(sndBuffer);
        if (musicSource == null) {
            musicSource = play(musicBuffer, true, 0.05);
        }
    }

    window.addEventListener("unload", () => {
        disconnect();
    });
    await connect();
    log("connected");
    started = true;
    glSim = new Fluid2dGpu(canvas);
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
    // ctx.resetTransform();
    // ctx.scale(ss, ss);

    if (!started) {
        // ctx.fillStyle = "#333";
        // ctx.fillRect(0, 0, sw, sh);
        //
        // ctx.font = "bold 24px serif";
        // ctx.fillStyle = "green";
        // ctx.fillText("Tap to start!", sw / 2, sh / 2);
        return;
    }
    if (glSim) {
        glSim.update_(deltaTime);
    }
    // const r = (0.1 * Math.random() * 255) | 0;
    // const g = (0.1 * Math.random() * 255) | 0;
    // const b = (0.1 * Math.random() * 255) | 0;
    //
    // // ctx.fillStyle = `rgb(${r},${g},${b})`;
    //

    const cons = peerConnections;
    let text = "";
    text += "$ " + getLocalNode() + "\n";
    // ctx.fillStyle = `rgb(${r},${g},${b})`;
    // ctx.fillRect(0, 0, sw, sh);
    // //ctx.fillRect(Math.random() * sw * ss, Math.random() * sh * ss, 10, 10);
    //
    // let y = 30;
    // ctx.font = "bold 24px serif";
    // ctx.fillStyle = "green";
    // ctx.fillText(getLocalNode(), 10, y);
    // y += 30;
    const nodes = getRemoteNodes();
    // ctx.fillStyle = "white";
    for (const node of nodes) {
        text += "> " + node;
        const con = cons[node];
        if (con) {
            switch(con.pc.connectionState) {
                case "disconnected":
                case "failed":
                case "closed":
                    text += "🔴";
                    break;
                case "connected":
                    text += "🟢";
                    break;
                default:
                    text += "🟡";
                    break;
            }
        }
        else {
            text += "⭕"
        }
        text += "\n";
    }
    textTerminal.innerText = text;
};

requestAnimationFrame(raf);
