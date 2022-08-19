import {ClientID} from "../../shared/types";
import {getClientId, getRemoteClient, getRemoteClients} from "../net/messaging";
import {gl} from "../graphics/gl";
import {play} from "../audio/context";
import {createAudioBuffer} from "../audio/sfxr";
import {termClear, termFlush, termPrint} from "../debug/log";
import {createAudioBufferFromSong} from "../audio/soundbox";
import {song} from "../songs/0bit";
import {inputPointers} from "../fluid/input";
import {beginRender, beginRenderGroup, camera, createTexture, draw, flush, Texture} from "../graphics/draw2d";
import {getSeed, random, seed} from "./rnd";
import {channels_sendObjectData, setRTMessageHandler} from "../net/channels";

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
    beginPrediction();
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
    gl.clearColor(0.1 * Math.random(), 0.0, 0.1, 1.0);
    beginRender(w, h);
    beginRenderGroup(false);
    drawPlayers();
    flush();
    endPrediction();
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
    startTime = prevTime = frameTime;
    players[0] = {c: getClientId(), x: Math.random() * 800, y: 400, s: 1, vx: 0, vy: 0};
    recreateMap(1);
}

let frameTime = 0;
let frameDeltaTime = 0;

export function updateTestGame(dt: number) {
    const n = now();
    frameDeltaTime = n - frameTime;
    frameTime = n;

    termClear();

    if (startTick < 0 && getRemoteClients().length === 0) {
        createSeedGameState();
    }

    if (startTick >= 0 && clientActive) {
        tryRunTicks(frameTime);
        checkInput();
        drawGame();
        trySendInput();
        cleaningUpClients();
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
            text += `|+t: ${cl.t - (gameTic - 1)}`;
            // text += ` | l: ${((gameTicks - cl.t) * 1000.0 / Const.NetFq) | 0}ms`;
            const dc = remoteClient.dc;
            text += "|p:x" + dc.bufferedAmount.toString(16);
            text += "-> " + simFullFrames + "." + simPartFrames + "\n";
            text += "F: " + frameTime + "\n";
            text += "P: " + prevTime + "\n";
            text += "~ " + (gameTic * Const.NetDt) + "\n";
            text += (((prevTime - startTime) * 1000) | 0) + " ms";
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
    c: ClientID;
    // how many MY inputs are acknowledged by remote [remote-ack + 1 .. local tic]
    acknowledgedTic: number;
    // completed inputs received from remote
    t: number;
}

let clients: Client[] = [];

function requireClient(id: ClientID) {
    if (!clients[id]) {
        clients[id] = {c: id, t: 0, acknowledgedTic: 0};
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
    NetFq = 30.0,
    // NetFq = 20.0,
    NetDt = 1.0 / NetFq,
}

interface InitData {
    mapSeed: number;
    players: Player[];
}

// packet = remote_events[cl.ack + 1] ... remote_events[cl.tic]
interface Packet {
    c: ClientID;
    // seed for current tic
    _: number;
    // confirm the last tic we received from Sender
    receivedOnSender: number;
    // packet contains info tic and before
    t: number;
    // events are not confirmed
    e: ClientEvent[];

    // init state
    s?: InitData;
}

// ticks received from all peers (min value), we could simulate to it
let netTick = 0;
const inputDelayN = 8;
// const inputDelayN = 25;
let startTick = -1;
let gameTic = 0;
let prevTime = 0;
let startTime = 0;
let ackMin = 0;

function calcNetTick() {
    let tmin = 0xFFFFFFFF;
    let amin = 0xFFFFFFFF;
    for (const client of getRemoteClients()) {
        const cl = clients[client.id];
        if (cl) {
            if (cl.t < tmin) {
                tmin = cl.t;
            }
            if (!cl.acknowledgedTic) {
                amin = 0;
            } else if (cl.acknowledgedTic < amin) {
                amin = cl.acknowledgedTic;
            }
        }
    }
    if (tmin === 0xFFFFFFFF) {
        netTick = gameTic;
        ackMin = gameTic;
    } else {
        // netTick = Math.min(amin, tmin);
        netTick = tmin;
        ackMin = amin;
        // netTick = Math.min(tmin, amin);
    }
}

function now(): number {
    return performance.now() / 1000.0;
    // return Date.now() / 1000.0;
}

function tryRunTicks(ts: number): number {
    calcNetTick();
    const framesPassed = ((ts - prevTime) * Const.NetFq) | 0;
    let frameN = framesPassed;
    let framesProcessed = 0;
    // compensate
    // we must try to keep netTic >= gameTic + inputDelayN
    // if (frameN === 0 && (netTick - gameTic) < inputDelayN) frameN = 1;
    while (gameTic <= netTick && frameN > 0) {
        processTicCommands(getCommandsForTic(gameTic));
        simulateTic(Const.NetDt);
        ++gameTic;
        --frameN;
        ++framesProcessed;
    }
    let scale = 1.0;
    if ((netTick - gameTic) < inputDelayN * 0.5) scale = 1.25;
    // prevTime += framesPassed * Const.NetDt;
    prevTime += scale * framesProcessed * Const.NetDt;
    // prevTime = now();
    const lastTic = gameTic - 1;
    receivedEvents = receivedEvents.filter(v => v.t > lastTic);
    localEvents = localEvents.filter(v => v.t > Math.min(ackMin,  lastTic));
    return framesProcessed;
}

let joined = false;

function checkJoinSync(lastTic: number) {
    if (!joined && startTick >= 0) {
        const ticToSpawn = lastTic + inputDelayN + 1;
        if (netTick < lastTic) {
            return;
        }
        for (const rc of getRemoteClients()) {
            if (rc.dc && rc.dc.readyState === "open") {
                const cl = clients[rc.id];
                if (!cl || cl.t <= lastTic + 2) {
                    console.info("syncing...");
                    return;
                }
            }
        }
        joined = true;
        console.info("All in sync");
        console.info("Plan player spawn on " + ticToSpawn);
        for (const rc of getRemoteClients()) {
            if (rc.dc && rc.dc.readyState === "open") {
                const cl = clients[rc.id];
                console.info("======");
                console.info(cl.c);
                console.info("t:" + cl.t);
                console.info("ack:" + cl.acknowledgedTic);
                console.info("======");
            }
        }

        localEvents.push({
            t: ticToSpawn,
            spawn: {x: Math.random() * 800.0, y: 200 + 400 * Math.random()}
        });
        // }
    }
}

function trySendInput() {
    const lastTic = gameTic - 1;
    checkJoinSync(lastTic);
    for (const client of getRemoteClients()) {
        if (client.dc && client.dc.readyState === "open") {
            const packet: Packet = {
                c: getClientId(),
                _: getSeed(),
                t: lastTic + inputDelayN,
                receivedOnSender: 0,
                e: []
            };
            const cl = clients[client.id];

            if (cl) {
                // send to Client info that we know already
                packet.receivedOnSender = cl.t;
                // if (packet.t > cl.acknowledgedTic) {
                for (const e of localEvents) {
                    // if (e.t >= cl.t - inputDelayN && e.t <= packet.t /* buffer all inbetween frames current tic events */) {
                    if (e.t > cl.acknowledgedTic && e.t <= packet.t /* buffer all inbetween frames current tic events */) {
                        packet.e.push(e);
                        //console.info("add input  " + e.t);
                    }
                }
                channels_sendObjectData(client.dc, packet);
                // }
            } else {
                const init: Packet = {
                    c: getClientId(),
                    _: getSeed(),
                    t: lastTic,
                    receivedOnSender: lastTic,
                    e: [],
                    s: {
                        mapSeed: imgMapSeed,
                        players: players
                    }
                };
                for (const e of localEvents) {
                    // buffer all inbetween frames current tic events
                    if (e.t <= packet.t) {
                        packet.e.push(e);
                    }
                }
                for (const e of receivedEvents) {
                    packet.e.push(e);
                }
                channels_sendObjectData(client.dc, init);
            }
        }
    }
}

function cleaningUpClients() {
    for (const cl of clients) {
        if (cl) {
            const rc = getRemoteClient(cl.c);
            if (rc) {
                if (rc.dc.readyState === "open") {
                    // alive
                    continue;
                }
            }
            clients[cl.c] = undefined;
            const p = getPlayerByClient(cl.c);
            if (p) {
                players = players.filter(x => x.c !== cl.c);
            }
        }
    }
}

function rtHandler(from: ClientID, data: Packet) {
    const lastTic = gameTic - 1;
    if (data) {
        if (data.t) {
            if (startTick < 0 && data.s) {
                startTick = data.t;
                startTime = prevTime = frameTime;// - (inputDelayN * Const.NetDt);
                // prevTime = now() + ((inputDelayN - 1) * Const.NetDt);
                gameTic = data.t;//- inputDelayN;
                seed(data._);
                netTick = 0;
                players = data.s.players;
                recreateMap(data.s.mapSeed);

                const cl = requireClient(from);
                //cl.i = data.i;
                cl.t = data.t;
                if (data.e) {
                    for (const e of data.e) {
                        const cl = requireClient(e.c);
                        if (cl.t < e.t) {
                            cl.t = e.t;
                        }
                        //cl.i = data.t;
                        receivedEvents.push(e);
                    }
                }

                // localEvents.push({
                //     t: data.t + inputDelayN + 1,
                //     spawn: {x: Math.random() * 800.0, y: 200 + 400 * Math.random()}
                // });
            } else {
                const cl = requireClient(from);

                if (data.e) {
                    const spawnEvents = data.e.filter(x => !!x.spawn);
                    if (spawnEvents.length) {
                        console.log("detected spawn event to " + spawnEvents[0].t + " tic");
                        console.log("received tic: " + cl.t);
                        console.log("received on sender: " + data.receivedOnSender);
                        console.log("received ack: " + cl.acknowledgedTic);
                        console.log("new tic: " + data.t);
                        console.log(cl.t < data.t);
                        console.log("my last tic: " + lastTic);
                    }
                }
                if (data.t > lastTic) {
                    if (cl.t < data.t) {
                        if (data.e) {
                            for (const e of data.e) {
                                if (e.t > cl.t /*alreadyReceivedTic*/) {
                                    // populate each event with producer id
                                    if (!e.c) {
                                        e.c = data.c;
                                    }
                                    receivedEvents.push(e);
                                }
                            }
                        }
                        cl.t = data.t;
                    }
                }

                // just update last ack, now we know that Remote got `acknowledgedTic` amount of our tics,
                // then we will send only events from [acknowledgedTic + 1] index
                if (cl.acknowledgedTic < data.receivedOnSender) {
                    // update ack
                    cl.acknowledgedTic = data.receivedOnSender;
                }
            }
            if (!clientActive) {
                frameTime = now();
                tryRunTicks(frameTime);
                trySendInput();
                cleaningUpClients();
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
        }
    }
}

function simulateTic(dt: number) {
    updatePlayers(dt);
}

function reach(t0: number, t1: number, v: number): number {
    if (t0 < t1) {
        return Math.min(t0 + v, t1);
    } else if (t0 > t1) {
        return Math.max(t0 - v, t1);
    }
    return t0;
}

function updatePlayers(dt: number) {
    for (const player of players) {
        if (player.s) {
            player.x += player.vx * dt;
            player.y += player.vy * dt;
            player.vy += 800 * dt;

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
                if (grounded) {
                    player.y -= 1;
                    player.vy = jumpVel[2];
                    player.vx = -player.btn * jumpVel[1];
                    if (!muted) {
                        play(sndBuffer, false, 0.2 + 0.8 * random());
                    }
                }
            }
        }
    }
}

let renderedTic = 0;
let lastState: Player[];
let simFullFrames = 0;
let simPartFrames = 0;

function getCommandsForTic(tic: number):ClientEvent[] {
    return localEvents.filter(v => v.t === tic).map(v => {
        v.c = getClientId();
        return v;
    })
        .concat(receivedEvents.filter(v => v.t === tic));
}

function beginPrediction() {
    lastState = players;
    simFullFrames = 0;
    simPartFrames = 0;
    players = JSON.parse(JSON.stringify(players));
    let time = frameTime - prevTime;
    let tic = gameTic;
    while (time >= Const.NetDt) {
        processTicCommands(getCommandsForTic(tic));
        simulateTic(Const.NetDt);
        time -= Const.NetDt;
        ++simFullFrames;
        ++tic;
    }
    if(time > 0) {
        processTicCommands(getCommandsForTic(tic));
        simulateTic(time);
        ++simPartFrames;
        ++tic;
    }
}

function endPrediction() {
    players = lastState;
}

function drawPlayers() {
    let bgColor = 0x33669977;
    draw(imgBox, boundsX0, boundsY0, 0, boundsX1 - boundsX0, boundsY1 - boundsY0, bgColor, 0.1);
    let concolor = 0x00000077;
    if (renderedTic === gameTic) {
        concolor = 0xFF000044;
    }
    if (simPartFrames > 0) {
        concolor = 0x00FF0044;
    }
    if (simFullFrames > 0) {
        concolor = 0xFFFF0044;
    }
    renderedTic = gameTic;
    let i = 0;
    for (const player of players) {
        if (player.s) {
            const s = player.vy * 0.00005;
            const a = 0.0005 * player.vx;
            draw(imgSkull, player.x, player.y, a, 0.3 - s, 0.3 + s, player_colors[i], 0.0);
            draw(imgBox, player.x + player_x0, player.y + player_y0, 0, player_x1 - player_x0, player_y1 - player_y0, concolor, 0.1);
        }
        ++i;
    }
}
