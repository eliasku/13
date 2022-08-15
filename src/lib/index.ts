import {play} from "./audio/context";
import {createAudioBuffer} from "./audio/sfxr";
import {createAudioBufferFromSong} from "./audio/soundbox";
import {song} from "./songs/0bit";
import {connect, disconnect, getLocalNode, getRemoteNodes} from "./net/messaging";
import {Fluid2dGpu} from "./fluid/fluid2d-gpu";
import {initInput, inputPointers} from "./fluid/input";
import {initGL} from "./fluid/gl";
import {debugOverlay, flushOverlayText, log} from "./debug/log";
import {connectToRemotes, peerConnections, setRTMessageHandler} from "./net/realtime";
import {ClientID} from "../shared/types";

document.body.style.margin = "0";
document.body.style.height = "100vh";
const canvas = document.createElement("canvas");
let sw = 1000;
let sh = 1000;
let ss = 1.0;
document.body.prepend(canvas);
initInput(canvas);
initGL(canvas);

const muted = true;
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
    log("connected to signal server");
    await connectToRemotes();
    log("connected to initial remotes");
    started = true;
    glSim = new Fluid2dGpu(canvas);
    setRTMessageHandler(rtHandler);
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

function printConnections() {
    const cons = peerConnections;
    let text = "";
    text += "$ " + getLocalNode() + "\n";
    const nodes = getRemoteNodes();
    for (const node of nodes) {
        text += "> " + node;
        const con = cons[node];
        if (con) {
            switch (con.pc.iceConnectionState) {
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
            text += ` | ${con.pc.connectionState} | ${con.pc.signalingState} | ${con.pc.iceConnectionState}`;
        } else {
            text += "⭕"
        }
        text += "\n";
    }
    debugOverlay(text + "\n");
}

function testLoop() {
    const points:number[] = [];
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
                    //const n = (len | 0) + 1;
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
    if(points.length) {
        for(let i = 0; i < peerConnections.length; ++i) {
            const con = peerConnections[i];
            if(con && con.channel && con.channel.readyState === "open") {
                con.channel.send(JSON.stringify({points}));
            }
        }
        spawnPoints(points);
    }
}

function rtHandler(fromId: ClientID, data:any) {
    if(data && data.points) {
        spawnPoints(data.points);
    }
}

function spawnPoints(points: number[]) {
    for(let i = 0; i < points.length; ) {
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

    if (glSim) {
        glSim.update_(deltaTime);
        testLoop();
    }

    printConnections();
    flushOverlayText();
};

requestAnimationFrame(raf);
