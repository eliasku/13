import {ClientID} from "../../shared/types";
import {getClientId, getRemoteClients, setRTMessageHandler} from "../net/messaging";
import {gl} from "../graphics/gl";
import {play} from "../audio/context";
import {createAudioBuffer} from "../audio/sfxr";
import {termClear, termFlush, termPrint} from "../debug/log";
import {createAudioBufferFromSong} from "../audio/soundbox";
import {song} from "../songs/0bit";
import {inputPointers} from "../fluid/input";
import {beginRender, beginRenderGroup, camera, createTexture, draw, flush, Texture} from "../graphics/draw2d";
import {getSeed, random, seed} from "./rnd";

const muted = false;
let sndBuffer: AudioBuffer | null = null;
let musicBuffer: AudioBuffer | null = null;
let musicSource: AudioBufferSourceNode | null = null;
let imgSkull: Texture = null;
let imgBox: Texture = null;
let imgMap: Texture = null;
let imgMapSeed: number;
let particles: { t: number, x: number, y: number }[] = [];

export function loadTestGame() {
    sndBuffer = createAudioBuffer([2, 0, 0.032, 0.099, 0.0816678, 0.818264, 0, -0.241811, 0, 0.541487, 0.418269, 0, 0, 0, 0, 0, 0.175963, -0.27499, 1, 0, 0, 0.900178, 0]);
    musicBuffer = createAudioBufferFromSong(song);

    let image = new Image();
    image.onload = () => {
        imgSkull = createTexture(image, 0.5, false, false);
        imgSkull.x = 0.5;
        imgSkull.y = 0.95;
    };
    image.src = "./skull.png";

    const boxImage = new ImageData(1, 1);
    boxImage.data.fill(0xFF);
    imgBox = createTexture(boxImage, 0.5, false, false);
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
        const s = 0.1 * p.t * p.t;
        draw(imgSkull, p.x, p.y, 0.0, s, s, 0xFFFFFFFF, 0.0);
    }
}

function spawnPoints(points: number[]) {
    for (let i = 0; i < points.length;) {
        particles.push({
            t: 1.0, x: points[i++], y: points[i++],
        });
        i += 2;
    }
}

function drawGame() {
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    camera.scale = Math.min(w, h) / 800.0;
    camera.toX = 0.5;
    camera.toY = 0.5;
    const p0 = getMyPlayer();
    if (p0) {
        camera.atX = p0.x;
        // camera.atY = p0.y;
        camera.atY = 400;
    } else {
        camera.atX = 400;
        camera.atY = 400;
    }

    gl.clearColor(0.2, 0.2, 0.2, 1.0);
    beginRender(w, h);

    beginRenderGroup(false);
    // if (imgMap) {
    //     imgMap.x = 0.5;
    //     imgMap.y = 0.5;
    //     draw(imgMap, 0, 0, Math.PI / 4, 16, 16 / 2, 0xFFFFFFFF, 0);
    // }
    drawParticles();
    drawPlayers();
    flush();
}

function recreateMap(seed1: number) {
    const seed0 = getSeed();
    seed(seed1);
    // generate map
    imgMapSeed = seed1;
    // imgMap = createTexture(generateMap(), 0.5, false, false);
    seed(seed0);
}

function createSeedGameState() {
    startTick = 0;
    gameTic = 0;
    netTick = 0;
    startTime = prevTime = now();
    players[0] = {c: getClientId(), x: Math.random() * 800, y: 400, s: 1, vx: 0, vy: 0};
    recreateMap(1);
}

export function updateTestGame(dt: number) {
    termClear();

    if (startTick < 0 && getRemoteClients().length === 0) {
        createSeedGameState();
    }

    if (startTick >= 0 && clientActive) {
        tryRunTicks();
        checkInput();
        drawGame();
        trySendInput();
    }

    termPrint("Now touch and drag.\n\n");
    printRemoteClients();
    termFlush();
}

function printRemoteClients() {
    const remoteClients = getRemoteClients();
    let text = "";
    text += `┌ ${getClientId()} | game: ${gameTic}, net: ${netTick}\n`;
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
            text += `|+t: ${cl.t - gameTic}`;
            // text += ` | l: ${((gameTicks - cl.t) * 1000.0 / Const.NetFq) | 0}ms`;
            const dc = remoteClient.dc;
            text += "|p:x" + dc.bufferedAmount.toString(16);
            text += "|l: " + (((now() - prevTime) * Const.NetFq) | 0) + "\n";
            text += " --:-- " + ((prevTime * 1000) | 0) + " ms";
        }
        text += "\n";
    }
    termPrint(text + "\n");
}

function getMyPlayer(): Player | undefined {
    const c = getClientId();
    for (const p of players) {
        if (p.c === c) {
            return p;
        }
    }
}

function getPlayerByClient(c: ClientID): Player | undefined {
    for (const p of players) {
        if (p.c === c) {
            return p;
        }
    }
}

function checkPlayerInput() {
    const player = getMyPlayer();
    if (player) {
        const p = inputPointers.filter(x => x.active_ && x.down_);
        let btn = 0;
        if (p.length) {
            let x = p[0].x_;
            x = (x - gl.drawingBufferWidth * camera.toX) / camera.scale + camera.atX;
            if (x < player.x) {
                btn = -1;
            } else if (x > player.x) {
                btn = 1;
            }
        }
        localEvents.push({t: gameTic + inputDelayN, btn})
    }
}

function checkInputForDrawing() {

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
                // const len = Math.sqrt(fx * fx + fy * fy);
                // const n = (len | 0) + 1;
                const n = 1;

                let x = pointer.prevX_;
                let y = pointer.prevY_;
                let dx = (mx - pointer.prevX_) / n;
                let dy = (my - pointer.prevY_) / n;
                for (let i = 0; i < n + 1; ++i) {
                    let u = x;
                    let v = y;
                    const _x = camera.atX - gl.drawingBufferWidth * camera.toX;
                    const _y = camera.atY - gl.drawingBufferHeight * camera.toY;
                    const _c = camera.scale * Math.cos(camera.angle);
                    const _s = camera.scale * Math.sin(camera.angle);
                    u = (u - gl.drawingBufferWidth * camera.toX) / camera.scale + camera.atX;
                    v = (v - gl.drawingBufferHeight * camera.toY) / camera.scale + camera.atY;

                    points.push(u, v);
                    x += dx;
                    y += dy;
                }
            }
        }
    }
    if (points.length) {
        // game tic after execution set to next processing tic
        // lasttic = gametic - 1, nexttic = lasttic + 1
        const nextTic = gameTic;
        // collect all events in period of frames processed for tic, will be send on lastTic + 1
        localEvents.push({t: nextTic + inputDelayN, p: points});
    }
}

function checkInput() {
    checkPlayerInput();
    //checkInputForDrawing();
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

interface ClientEvent {
    t: number;
    p?: number[];
    spawn?: { x: number, y: number };
    btn?: number;
    // will be populated from packet info
    c?: ClientID;
}

let localEvents: ClientEvent[] = [];
let receivedEvents: ClientEvent[] = [];

const enum Const {
    NetFq = 60.0,
    // NetFq = 20.0,
    NetDt = 1.0 / NetFq,
}

interface InitData {
    mapSeed: number;
    players: Player[];
}

interface Packet {
    c: ClientID;
    // seed for current tic
    _: number;
    // active or not
    a: number;
    // last game-tick
    t: number;
    // shared start-time
    t0: number;
    // events are not confirmed
    e: ClientEvent[];

    // init state
    s?: InitData;
}

// ticks received from all peers (min value), we could simulate to it
let netTick = 0;
const inputDelayN = 8;
let startTick = -1;
let gameTic = 0;
let prevTime = 0;
let startTime = 0;

function calcNetTick() {
    let tmin = 0xFFFFFFFF;
    for (const client of getRemoteClients()) {
        const cl = clients[client.id];
        if (cl) {
            if (cl.t < tmin) {
                tmin = cl.t;
            }
        }
    }
    if (tmin === 0xFFFFFFFF) {
        netTick = gameTic;
    } else {
        netTick = tmin;
    }
    // if (tmin !== 0xFFFFFFFF) {
    //     netTick = tmin;
    // TODO:
    //localEvents = localEvents.filter(v => v.t >= netTick);
    // }
}

function now(): number {
    return performance.now() / 1000.0;
    // return Date.now() / 1000.0;
}

function tryRunTicks(): number {
    calcNetTick();
    let framesPassed = ((now() - prevTime) * Const.NetFq) | 0;
    let frameN = framesPassed;
    while (gameTic <= netTick && frameN > 0) {
        const cmds = localEvents.filter(v => v.t === gameTic).map(v => {
            v.c = getClientId();
            return v;
        })
            .concat(receivedEvents.filter(v => v.t === gameTic));
        processTicCommands(cmds);
        simulateTic();
        ++gameTic;
        --frameN;
    }
    prevTime += framesPassed * Const.NetDt;

    const lastTic = gameTic - 1;
    receivedEvents = receivedEvents.filter(v => v.t > lastTic);
    localEvents = localEvents.filter(v => v.t > lastTic);
    return framesPassed;
}

function trySendInput() {
    const lastTic = gameTic - 1;
    for (const client of getRemoteClients()) {
        if (client.dc && client.dc.readyState === "open") {
            const packet: Packet = {
                c: getClientId(),
                _: getSeed(),
                t0: startTick,
                t: lastTic + inputDelayN,
                a: +clientActive,
                e: []
            };
            const cl = clients[client.id];
            if (cl) {
                if (packet.t >= cl.t) {
                    for (const e of localEvents) {
                        if (e.t >= cl.t - inputDelayN && e.t <= packet.t /* buffer all inbetween frames current tic events */) {
                            packet.e.push(e);
                            //console.info("add input  " + e.t);
                        }
                    }
                    client.dc.send(JSON.stringify(packet) + "\n\n");
                }
            } else {
                const init: Packet = {
                    c: getClientId(),
                    _: getSeed(),
                    t0: startTick,
                    t: lastTic,
                    a: +clientActive,
                    e: [],
                    s: {
                        mapSeed: imgMapSeed,
                        players: players
                    }
                };
                client.dc.send(JSON.stringify(init) + "\n\n");
            }
        }
    }
}

function rtHandler(from: ClientID, data: Packet) {
    if (data) {
        if (data.t) {
            if (startTick < 0 && data.s) {
                startTick = data.t0;
                startTime = prevTime = now() - (inputDelayN * Const.NetDt);
                // prevTime = now() + ((inputDelayN - 1) * Const.NetDt);
                gameTic = data.t - inputDelayN;
                seed(data._);
                netTick = 0;
                players = data.s.players;
                recreateMap(data.s.mapSeed);
                // collect all events in period of frames processed for tic, will be send on lastTic + 1
                localEvents.push({
                    t: gameTic + 4 + inputDelayN,
                    spawn: {x: Math.random() * 800.0, y: 200 + 400 * Math.random()}
                });
            }
            const cl = requireClient(from);
            if (cl.t < data.t) {
                const alreadyReceivedTic = cl.t;
                cl.a = data.a;
                cl.t = data.t;
                if (data.e) {
                    for (const e of data.e) {
                        if (e.t > alreadyReceivedTic) {
                            // populate each event with producer id
                            e.c = data.c;
                            receivedEvents.push(e);
                        }
                    }
                }
            }
            if (tryRunTicks() && !clientActive) {
                trySendInput();
            }
        }
    }
}


/// Game logic


interface Player {
    c: ClientID;
    s: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    btn?: number;
}

let players: Player[] = [];
const boundsX0 = 0;
const boundsY0 = 0;
const boundsX1 = 800;
const boundsY1 = 800;
const jumpVel = [0, -600, -800];
const player_colors = [0xFF0000FF, 0x00FF00FF, 0x0000FFFF, 0xFFFF00FF, 0xFF00FFFF, 0x00FFFFFF, 0xFFFFFFFF];

const player_x0 = -30;
const player_x1 = 30;
const player_y0 = -100;
const player_y1 = 0;


function createGameState() {

}

function processTicCommands(commands: ClientEvent[]) {
    for (const cmd of commands) {
        if (cmd.p) {
            spawnPoints(cmd.p);
        }
        if (cmd.spawn) {
            const player: Player = {x: cmd.spawn.x, y: cmd.spawn.y, c: cmd.c, vx: 0, vy: 0, s: 1};
            players = players.filter(p => p.c !== player.c);
            players.push(player);
        }
        if (cmd.btn !== undefined) {
            const player = getPlayerByClient(cmd.c);
            if (player) {
                player.btn = cmd.btn;
            }
            if (cmd.btn) {
                player.btn = cmd.btn;
            }
        }
    }
}

function simulateTic() {
    // for (let i = 0; i < 10; ++i) {
    //     particles.push({
    //         t: 0.5, x: 800 * random(), y: 800 * random(),
    //     });
    // }
    // updateParticles();
    updatePlayers();
}

function reach(t0: number, t1: number, v: number): number {
    if (t0 < t1) {
        return Math.min(t0 + v, t1);
    } else if (t0 > t1) {
        return Math.max(t0 - v, t1);
    }
    return t0;
}

function updatePlayers() {
    const dt = Const.NetDt;
    for (const player of players) {
        if (player.s) {
            player.x += player.vx * dt;
            player.y += player.vy * dt;
            player.vy += 800 * dt;

            // if (player.dir !== undefined) {
            //     //if (player.dir !== 0) {
            //     const targetVel = 400 * player.dir;
            //     let speed = !player.dir ? 8 : 4;
            //     player.vx = reach(player.vx, targetVel, 400 * speed * dt);
            //     //}
            // }

            let grounded = false;
            if (player.y + player_y1 >= boundsY1) {
                player.y = boundsY1 - player_y1;
                player.vy = 0.0;
                grounded = true;
                player.vx = reach(player.vx, 0, 400 * dt);
                //player.jc = 2;
            }

            if (player.y + player_y0 <= boundsY0) {
                player.y = boundsY0 - player_y0;
                if (player.vy < 0) {
                    player.vy = -player.vy / 2;
                }
            }
            if (player.x + player_x0 <= boundsX0) {
                player.x = boundsX0 - player_x0;
                if (player.vx < 0) {
                    player.vx = -player.vx / 2;
                }
            }
            if (player.x + player_x1 >= boundsX1) {
                player.x = boundsX1 - player_x1;
                if (player.vx > 0) {
                    player.vx = -player.vx / 2;
                }
            }

            if (player.btn) {
                // if (+player.jc > 0) {
                //     player.vy = jumpVel[+player.jc];
                //     player.jc = +player.jc - 1;
                // }

                // player.jump = 0;
                if (grounded) {
                    player.y -= 1;
                    player.vy = jumpVel[2];
                    player.vx = -player.btn * jumpVel[1];
                    //player.jc = +player.jc - 1;
                    play(sndBuffer, false, 0.2 + 0.8 * random());
                }
            }
        }
    }
}


function drawPlayers() {
    draw(imgBox, boundsX0, boundsY0, 0, boundsX1 - boundsX0, boundsY1 - boundsY0, 0x33669977, 0.1);
    let i = 0;
    for (const player of players) {
        if (player.s) {
            //const d = Math.sqrt(player.vy * player.vy + player.vx * player.vx);
            const s = player.vy * 0.00005;
            const a = 0.0005 * player.vx;
            draw(imgSkull, player.x, player.y, a, 0.3 - s, 0.3 + s, player_colors[i], 0.0);
            //draw(imgBox, player.x, player.y, a, 0.3 - s, 0.3 + s, player_colors[i], 0.0);
            draw(imgBox, player.x + player_x0, player.y + player_y0, 0, player_x1 - player_x0, player_y1 - player_y0, 0x00000077, 0.1);
        }
        ++i;
    }
}
