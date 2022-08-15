import {play} from "./audio/context";
import {createAudioBuffer} from "./audio/sfxr";
import {createAudioBufferFromSong} from "./audio/soundbox";
import {song} from "./songs/0bit";
import {connect, disconnect, getClientId, getRemoteClients, setRTMessageHandler} from "./net/messaging";
import {Fluid2dGpu} from "./fluid/fluid2d-gpu";
import {initInput, inputPointers} from "./fluid/input";
import {initGL} from "./fluid/gl";
import {termClear, termFlush, termPrint} from "./debug/log";
import {ClientID} from "../shared/types";

document.body.style.margin = "0";
document.body.style.height = "100vh";
const canvas = document.createElement("canvas");
canvas.style.backgroundColor = "black";
let sw = 1000;
let sh = 1000;
let ss = 1.0;
document.body.prepend(canvas);

termPrint("Initialize.");
termFlush();

initInput(canvas);

termPrint(".");
termFlush();
initGL(canvas);

const muted = false;
let sndBuffer: AudioBuffer | null = null;
let musicBuffer: AudioBuffer | null = null;
let musicSource: AudioBufferSourceNode | null = null;
termPrint(".");
sndBuffer = createAudioBuffer([2, 0, 0.032, 0.099, 0.0816678, 0.818264, 0, -0.241811, 0, 0.541487, 0.418269, 0, 0, 0, 0, 0, 0.175963, -0.27499, 1, 0, 0, 0.900178, 0]);
termPrint(".");
musicBuffer = createAudioBufferFromSong(song);

termClear();
termPrint("Ready!\nTap to Start!\n");
termFlush();

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

    window.addEventListener("beforeunload", disconnect);
    setRTMessageHandler(rtHandler);
    await connect();
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

function printRemoteClients() {
    const remoteClients = getRemoteClients();
    let text = "";
    text += "$ " + getClientId() + "\n";
    for (const remoteClient of remoteClients) {
        text += "> " + remoteClient.id;
        const pc = remoteClient.pc;
        if (pc) {
            switch (pc.iceConnectionState) {
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
            text += ` | ${pc.signalingState} | ${pc.iceConnectionState}`;
        } else {
            text += "⭕"
        }
        text += "\n";
    }
    termPrint(text + "\n");
}

function testLoop() {
    const points: number[] = [];
    for (let i = 0; i < inputPointers.length; ++i) {
        const pointer = inputPointers[i];
        if (pointer.active_ && pointer.down_) {
            let mx = pointer.x_ | 0;
            let my = pointer.y_ | 0;
            const width = canvas.width;
            const height = canvas.height;
            if (pointer.down_ && (mx !== pointer.prevX_ || my !== pointer.prevY_)) {
                if (mx > 0 && mx < width - 1 && my > 0 && my < height - 1) {
                    const fx = mx - pointer.prevX_;
                    const fy = my - pointer.prevY_;
                    const len = Math.sqrt(fx * fx + fy * fy);
                    // const n = (len | 0) + 1;
                    const n = 1;

                    let x = pointer.prevX_;
                    let y = pointer.prevY_;
                    let dx = (mx - pointer.prevX_) / n;
                    let dy = (my - pointer.prevY_) / n;
                    for (let i = 0; i < n + 1; ++i) {
                        const u = x / width;
                        const v = 1.0 - y / height;
                        points.push(u, v, fx, -fy);
                        x += dx;
                        y += dy;
                    }
                }
            }
        }
    }
    if (points.length) {
        const remoteClients = getRemoteClients();
        for (let i = 0; i < remoteClients.length; ++i) {
            const rc = remoteClients[i];
            if (rc && rc.dc && rc.dc.readyState === "open") {
                rc.dc.send(JSON.stringify({points}));
            }
        }
        spawnPoints(points);
    }
}

function rtHandler(fromId: ClientID, data: any) {
    if (data && data.points) {
        spawnPoints(data.points);
    }
}

function spawnPoints(points: number[]) {
    for (let i = 0; i < points.length;) {
        glSim.splat_(
            points[i++],
            points[i++],
            points[i++],
            points[i++],
            glSim.color_
        );
    }
}

const doFrame = () => {
    if (!started) {
        return;
    }

    termClear();

    if (glSim) {
        glSim.update_(deltaTime);
        testLoop();
    }

    termPrint("Now touch and drag.\n\n");
    printRemoteClients();
    termFlush();
};

requestAnimationFrame(raf);
