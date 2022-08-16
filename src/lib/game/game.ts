import {ClientID} from "../../shared/types";
import {getClientId, getRemoteClients, setRTMessageHandler} from "../net/messaging";
import {gl} from "../graphics/gl";
import {play} from "../audio/context";
import {createAudioBuffer} from "../audio/sfxr";
import {termClear, termFlush, termPrint} from "../debug/log";
import {createAudioBufferFromSong} from "../audio/soundbox";
import {song} from "../songs/0bit";
import {inputPointers} from "../fluid/input";
import {beginRender, beginRenderGroup, createTexture, draw, flush, Texture} from "../graphics/draw2d";

const muted = true;
let sndBuffer: AudioBuffer | null = null;
let musicBuffer: AudioBuffer | null = null;
let musicSource: AudioBufferSourceNode | null = null;
// let glSim: Fluid2dGpu | undefined = undefined;
let imgSkull: Texture = null;

let particles: { t: number, x: number, y: number }[] = [];

export function loadTestGame() {
    sndBuffer = createAudioBuffer([2, 0, 0.032, 0.099, 0.0816678, 0.818264, 0, -0.241811, 0, 0.541487, 0.418269, 0, 0, 0, 0, 0, 0.175963, -0.27499, 1, 0, 0, 0.900178, 0]);
    musicBuffer = createAudioBufferFromSong(song);

    let image = new Image();
    image.onload = () => {
        imgSkull = createTexture(image, 0.5, false, false);
        imgSkull.x = 0.5;
        imgSkull.y = 0.5;
    };
    image.src = "./skull.png";
}

let clientActive = true;

export function initTestGame() {
    if (!muted) {
        play(sndBuffer);
        if (musicSource == null) {
            musicSource = play(musicBuffer, true, 0.05);
        }
    }

    // glSim = new Fluid2dGpu(gl.canvas);

    setRTMessageHandler(rtHandler);

    document.addEventListener("visibilitychange", () => {
        const active = !document.hidden;
        if (clientActive !== active) {
            clientActive = active;
        }
    });
}

let localEvents: { t: number, points: number[] }[] = [];
let receivedEvents: { t: number, points: number[] }[] = [];

function updateParticles() {
    for (let i = 0; i < particles.length; ++i) {
        const p = particles[i];
        p.t -= 0.05 * Const.NetDt;
        if (p.t <= 0.0) {
            particles.splice(i, 1);
            --i;
        }
    }
}

function drawParticles() {
    if (!imgSkull) return;
    for (let i = 0; i < particles.length; ++i) {
        const p = particles[i];
        const s = p.t * p.t;
        draw(imgSkull, p.x, p.y, 0.0, s, s, 0xFFFFFFFF, 0.0);
    }
}

function spawnPoints(points: number[]) {
    for (let i = 0; i < points.length;) {
        particles.push({
            t: 1.0, x: points[i++], y: points[i++],
        });
        i += 2;
        // glSim.splat_(
        //     points[i++],
        //     points[i++],
        //     points[i++],
        //     points[i++],
        //     glSim.color_
        // );
    }
}

const enum Const {
    // NetFq = 60.0
    NetFq = 20.0,
    NetDt = 1.0 / NetFq,
}

interface Packet {
    // active or not
    a: number;
    // last game-tick
    t: number;
    // shared start-time
    t0: number;
    // events are not confirmed
    e: any[];
}

// ticks received from all peers (min value), we could simulate to it
let netTick = 0;
let startTick = -1;
let gameTicks = 0;
let timeAcc = 0.0;
let prevTime = 0;
let ts1 = 0;
let syncTs = 1;

function calcNetTick() {
    let tmin = 0xFFFFFFFF;
    for (const client of getRemoteClients()) {
        const cl = clients[client.id];
        if (cl) {
            if (tmin > cl.t) {
                tmin = cl.t;
            }
        }
    }
    if (tmin !== 0xFFFFFFFF) {
        netTick = tmin;
        localEvents = localEvents.filter(v => v.t >= netTick);
    }
}

function drawGame() {
    gl.clearColor(0.2, 0.2, 0.2, 1.0);
    beginRender(gl.canvas.width, gl.canvas.height);
    beginRenderGroup(true);

    if (imgSkull) {
        const toRad = 2 * Math.PI / 180.0;
        draw(imgSkull, 300, 300, gameTicks * Const.NetDt * toRad, 1, 1, (Math.random() * 0xFFFFFFFF) >>> 0, 0.0);
    }

    drawParticles();
    flush();

    // glSim.render_(null);
}

function tryRunTicks() {
    calcNetTick();
    let netTicksToGo = netTick - gameTicks;
    let framesPassed = ((performance.now() / 1000.0 - prevTime) * Const.NetFq)|0;
    let frameN = framesPassed;
    while (netTicksToGo >= 0 && frameN > 0) {
        const f1 = localEvents.filter(v => v.t === gameTicks);
        for (let i = 0; i < f1.length; ++i) {
            spawnPoints(f1[i].points);
        }

        const ff = receivedEvents.filter(v => v.t === gameTicks);
        for (let i = 0; i < ff.length; ++i) {
            //console.info("play remote points: " + ff[0].points.join(","));
            spawnPoints(ff[i].points);
        }
        receivedEvents = receivedEvents.filter(v => v.t > gameTicks);

        updateParticles();
        // glSim.update_(1.0 / Const.NetFq);
        ++gameTicks;
        --netTicksToGo;
        --frameN;
    }
    prevTime += framesPassed * Const.NetDt;
}

function trySendTicks() {
    for (const client of getRemoteClients()) {
        if (client.dc && client.dc.readyState === "open") {
            const packet: Packet = {
                a: +clientActive,
                t: gameTicks,
                t0: startTick,
                e: []
            };
            const cl = clients[client.id];
            if (cl) {
                for (const e of localEvents) {
                    if (e.t > cl.t) {
                        packet.e.push({t: e.t, points: e.points});
                    }
                }
            }
            client.dc.send(JSON.stringify(packet));
//            console.info("send " + gameTicks);
        }
    }
}

export function updateTestGame(dt: number) {
    termClear();

    if (startTick < 0 && getRemoteClients().length === 0) {
        startTick = 0;
        timeAcc = 0.0;
        gameTicks = 0;
        netTick = 0;
        prevTime = performance.now();
    }

    if (startTick >= 0 && clientActive) {
        tryRunTicks();
        checkInput();
        drawGame();
        trySendTicks();
    }


    termPrint("Now touch and drag.\n\n");
    printRemoteClients();
    termFlush();
}

function printRemoteClients() {
    const remoteClients = getRemoteClients();
    let text = "";
    text += `┌ ${getClientId()} | ${netTick}->${gameTicks}\n`;
    for (const remoteClient of remoteClients) {
        text += "├ " + remoteClient.id;
        const pc = remoteClient.pc;
        if (pc) {
            switch (pc.iceConnectionState) {
                case "disconnected":
                    text += "⭕";
                    break;
                case "closed":
                    text += "🔴";
                    break;
                case "failed":
                    text += "❌";
                    break;
                case "connected":
                    text += "🟢";
                    break;
                case "completed":
                    text += "✅";
                    break;
                case "new":
                    text += "🆕";
                    break;
                case "checking":
                    text += "🟡";
                    break;
                default:
                    text += "❓";
                    break;
            }
        } else {
            text += "🧿"
        }
        const cl = clients[remoteClient.id];
        if (cl) {
            text += ` | l: ${((gameTicks - cl.t) * 1000.0 / Const.NetFq) | 0}ms`;
        }
        text += "\n";
    }
    termPrint(text + "\n");
}

function checkInput() {
    const points: number[] = [];
    for (let i = 0; i < inputPointers.length; ++i) {
        const pointer = inputPointers[i];
        if (pointer.active_ && pointer.down_) {
            let mx = pointer.x_ | 0;
            let my = pointer.y_ | 0;
            // TODO: convert to world
            if (pointer.down_ && (mx !== pointer.prevX_ || my !== pointer.prevY_)) {
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
                    const u = x;
                    const v = y;
                    points.push(u, v, fx, -fy);
                    x += dx;
                    y += dy;
                }
            }
        }
    }
    if (points.length) {
        localEvents.push({t: gameTicks + 1, points});
    }
}

interface Client {
    t: number;
    // flags, for example active or not
    a: number;
}

let clients: Client[] = [];

function requireClient(id: ClientID) {
    if (!clients[id]) {
        clients[id] = {t: 0, a: 1};
    }
    return clients[id];
}

function rtHandler(from: ClientID, data: any) {
    if (data) {
        if (data.t) {
            if (startTick < 0) {
                startTick = data.t0;
                prevTime = performance.now();
                gameTicks = data.t;
                timeAcc = 0.0;
                netTick = 0;
            }
            const cl = requireClient(from);
            if (cl.t < data.t) {
                cl.a = data.a;
                cl.t = data.t;

                if (data.e) {
                    for (const e of data.e) {
                        if (e.t >= gameTicks && e.points) {
                            //console.info("got points");
                            receivedEvents.push({t: e.t, points: e.points});
                        }
                    }
                }
            }
            tryRunTicks();
            if (!clientActive) {
                trySendTicks();
            }
        }
    }
}

