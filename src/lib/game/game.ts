import {ClientID} from "../../shared/types";
import {getClientId, getRemoteClient, getRemoteClients} from "../net/messaging";
import {gl} from "../graphics/gl";
import {play} from "../audio/context";
import {log, termPrint} from "../debug/log";
import {inputPointers, keyboardState} from "../fluid/input";
import {beginRender, beginRenderGroup, camera, createTexture, draw, flush, Texture} from "../graphics/draw2d";
import {getSeed, random, seed} from "./rnd";
import {channels_sendObjectData, setRTMessageHandler} from "../net/channels";
import {img_box, img_cirle, img_players, snd_blip} from "./res";
import {Const, MUTE_ALL} from "./config";
import {generateMapBackground} from "./maze";

let imgMap: Texture = null;
let imgMapSeed: number;
let clientActive = true;

export function initTestGame() {
    log("init game");
    setRTMessageHandler(rtHandler);

    document.addEventListener("visibilitychange", () => {
        const active = !document.hidden;
        if (clientActive !== active) {
            clientActive = active;
        }
    });
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
        camera.atY = p0.y;
    } else {
        camera.atX = 400;
        camera.atY = 400;
    }
    gl.clearColor(0.1 * Math.random(), 0.0, 0.1, 1.0);
    beginRender(w, h);
    beginRenderGroup(false);
    if (imgMap) {
        draw(imgMap, 0, 0, 0, 4, 4, 0xFFFFFFFF, 0);
    }
    drawShadows();
    drawPlayers();
    flush();
}

function recreateMap(seed1: number) {
    const seed0 = getSeed();
    seed(seed1);
    // generate map
    imgMapSeed = seed1;
    const mapbg = generateMapBackground();
    imgMap = createTexture(mapbg, 0.5, false, false);
    seed(seed0);
}

function createSeedGameState() {
    startTick = 0;
    gameTic = 0;
    netTick = 0;
    startTime = prevTime = lastFrameTs;
    //players[0] = {c: getClientId(), x: Math.random() * 800, y: 400, z: 100, s: 1, vx: 0, vy: 0, vz: 0};
    recreateMap(1);
}

let lastFrameTs = 0;

export function updateTestGame(ts: number) {
    if (ts > lastFrameTs) {
        lastFrameTs = ts;
    }

    if (startTick < 0 && getRemoteClients().length === 0) {
        createSeedGameState();
    }

    if (startTick >= 0 && !document.hidden) {
        tryRunTicks(lastFrameTs);
        beginPrediction();
        {
            drawGame();
            checkInput();
        }
        endPrediction();
        trySendInput();
        cleaningUpClients();
    }

    printRemoteClients();
}

let prevRenderTic = 0;

function printRemoteClients() {
    let text = "";
    let c = "🌐";
    if (prevRenderTic === gameTic) c = "🥶";
    const fr = simulatedFrames - (simulatedFrames | 0);
    if (fr > 0) c = "✨";
    if ((simulatedFrames | 0) > 0) c = "🔮";
    prevRenderTic = gameTic;
    text += c + ` b:${(((lastFrameTs - prevTime) / Const.NetDt) | 0)}`;
    text += " r:" + (simulatedFrames | 0) + (fr > 0 ? "." : "") + "\n";
    text += "d " + (lastFrameTs - prevTime).toFixed(2) + "\n";
    text += "~ " + (gameTic * Const.NetDt).toFixed(2) + "\n";

    text += `┌ ${getClientId()} | game: ${gameTic}, net: ${netTick}\n`;
    const remoteClients = getRemoteClients();
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
        const dc = remoteClient.dc;
        if (dc) {
            switch (dc.readyState) {
                case "connecting":
                    text += "🟡";
                    break;
                case "open":
                    text += "🟢";
                    break;
                case "closed":
                    text += "🔴";
                    break;
                case "closing":
                    text += "❌";
                    break;
            }
        } else {
            text += "🧿"
        }
        const cl = clients[remoteClient.id];
        if (cl) {
            text += `+${cl.t - (gameTic - 1)}`;
            text += "| x" + (+remoteClient.B).toString(16) + " | x" + remoteClient.dc.bufferedAmount.toString(16);
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

function getLocalEvent(tic: number): ClientEvent {
    for (const e of localEvents) {
        if (e.t === tic) {
            return e;
        }
    }
    const e: ClientEvent = {t: tic};
    localEvents.push(e);
    return e;
}

let lastInputTic = 0;
let lastInputCmd = 0;

function checkPlayerInput() {
    const simTic = ((lastFrameTs - prevTime) * Const.NetFq) | 0;
    const inputTic = gameTic + Math.max(Const.InputDelay, simTic);
    if (lastInputTic >= inputTic) {
        return;
    }
    lastInputTic = inputTic;
    // localEvents = localEvents.filter((x) => x.t < inputTic || x.spawn);

    let btn = 0;
    const player = getMyPlayer();
    if (player) {
        const p = inputPointers.filter(x => x.active_ && x.down_);
        let dx = 0;
        let dy = 0;

        // clear flags
        if (keyboardState["KeyW"] || keyboardState["ArrowUp"]) --dy;
        if (keyboardState["KeyS"] || keyboardState["ArrowDown"]) ++dy;
        if (keyboardState["KeyD"] || keyboardState["ArrowRight"]) ++dx;
        if (keyboardState["KeyA"] || keyboardState["ArrowLeft"]) --dx;

        if (!dx && !dy) {
            if (p.length) {
                let x = p[0].x_;
                let y = p[0].y_;
                x = (x - gl.drawingBufferWidth * camera.toX) / camera.scale + camera.atX;
                y = (y - gl.drawingBufferHeight * camera.toY) / camera.scale + camera.atY;
                dx = x - player.x;
                dy = y - player.y;
            }
        }

        if (dx || dy) {
            btn = (Const.AnglesRes * (Math.PI + Math.atan2(dy, dx)) / (2 * Math.PI)) | 0;
            btn |= 0x100;
        }

        if (keyboardState["Space"] || p.length > 1) {
            btn |= 0x200;
        }
    }
    if (lastInputCmd !== btn) {
        getLocalEvent(inputTic).btn = btn;
        lastInputCmd = btn;
    }
}


let joined = false;

function checkJoinSync(lastTic: number) {
    if (!joined && startTick >= 0) {
        const simTic = ((lastFrameTs - prevTime) * Const.NetFq) | 0;
        // IMPORTANT TO +1!!
        const ticToSpawn = lastTic + Math.max(Const.InputDelay, simTic) + 1;
        for (const rc of getRemoteClients()) {
            if (rc.dc && rc.dc.readyState === "open") {
                const cl = clients[rc.id];
                if (!cl || !cl.ready) {
                    log("syncing...");
                    return;
                }
            }
        }
        joined = true;
        log("All in sync");
        getLocalEvent(ticToSpawn).spawn = {
            x: Math.random() * 800.0,
            y: 200 + 400 * Math.random(),
            z: 100 * Math.random()
        };
    }
}

function checkInput() {
    checkPlayerInput();
    checkJoinSync(gameTic - 1);
}

interface Client {
    c: ClientID;
    // how many MY inputs are acknowledged by remote [remote-ack + 1 .. local tic]
    acknowledgedTic: number;
    // completed inputs received from remote
    t: number;

    // client starts play my events
    ready?: boolean;

    // I playing client's events
    isPlaying?: boolean;
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
    spawn?: { x: number, y: number, z: number };
    btn?: number;
    // will be populated from packet info
    c?: ClientID;
}

let localEvents: ClientEvent[] = [];
let receivedEvents: ClientEvent[] = [];

interface InitData {
    mapSeed: number;
    startSeed: number;
    players: Player[];
}

// packet = remote_events[cl.ack + 1] ... remote_events[cl.tic]
interface Packet {
    sync: boolean;

    c: ClientID;
    // seed for current tic
    //_: number;
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
        netTick = tmin;
        ackMin = amin;
    }
}

function tryRunTicks(ts: number): number {
    calcNetTick();
    const framesPassed = ((ts - prevTime) * Const.NetFq) | 0;
    let frameN = framesPassed;
    let framesProcessed = 0;
    while (gameTic <= netTick && frameN > 0) {
        processTicCommands(getCommandsForTic(gameTic));
        simulateTic(Const.NetDt);
        ++gameTic;
        --frameN;
        ++framesProcessed;
    }
    // compensate
    // we must try to keep netTic >= gameTic + Const.InputDelay
    prevTime += framesProcessed * Const.NetDt;

    // we played all available net-events
    const dropRate = 1;
    const k = 0.01;
    if (gameTic > netTick) {
        // slow down a bit in case if we predict a lot
        const allowFramesToPredict = Const.InputDelay;
        if (ts - prevTime > allowFramesToPredict * Const.NetDt) {
            // console.info("slow down");

            // prevTime += Const.NetDt * dropRate;
            // prevTime += 0.1 * (ts - prevTime);
            prevTime = (1-k) * prevTime + k * (ts - allowFramesToPredict * Const.NetDt);

            // prevTime = ts - allowFramesToPredict * Const.NetDt;
        }
    } else {
        // we got packets to go
        if (gameTic + Const.InputDelay < netTick) {
            // speed up
            // console.info("speed up");
            // prevTime -= Const.NetDt * dropRate;
            prevTime = (1-k) * prevTime + k * (ts - Const.InputDelay * Const.NetDt);

            // prevTime = ts - Const.InputDelay * Const.NetDt;
        }
    }

    const lastTic = gameTic - 1;
    receivedEvents = receivedEvents.filter(v => v.t > lastTic);
    localEvents = localEvents.filter(v => v.t > Math.min(ackMin, lastTic));
    return framesProcessed;
}

function trySendInput() {
    const simTic = ((lastFrameTs - prevTime) * Const.NetFq) | 0;
    const lastTic = gameTic - 1;
    for (const client of getRemoteClients()) {
        if (client.dc && client.dc.readyState === "open") {
            const cl = clients[client.id];

            if (cl) {
                const packet: Packet = {
                    c: getClientId(),
                    // t: lastTic + simTic + Const.InputDelay,
                    t: lastTic + Math.max(Const.InputDelay, simTic),
                    // send to Client info that we know already
                    receivedOnSender: cl.t,
                    e: [],
                    sync: cl.isPlaying,
                };
                if (packet.t > cl.acknowledgedTic) {
                    for (const e of localEvents) {
                        if (e.t > cl.acknowledgedTic && e.t <= packet.t /* buffer all inbetween frames current tic events */) {
                            packet.e.push(e);
                        }
                    }
                    channels_sendObjectData(client, pack(packet));
                }
            } else {
                const init: Packet = {
                    sync: false,
                    c: getClientId(),
                    t: lastTic,
                    // important to wait for ack on who is initializing
                    receivedOnSender: lastTic,
                    e: [],
                    s: {
                        mapSeed: imgMapSeed,
                        startSeed: getSeed(),
                        players: players
                    },
                };
                for (const e of localEvents) {
                    // buffer all inbetween frames current tic events
                    if (e.t > lastTic) {
                        init.e.push(e);
                    }
                }
                for (const e of receivedEvents) {
                    if (e.t > lastTic) {
                        init.e.push(e);
                    }
                }
                channels_sendObjectData(client, pack(init));
            }
        }
    }
}


function rtHandler(from: ClientID, buffer: ArrayBuffer) {
    const data = unpack(buffer);
    const lastTic = gameTic - 1;
    if (data.t) {
        if (startTick < 0 && data.s) {
            startTick = data.t + 1;
            startTime = prevTime = lastFrameTs;
            gameTic = data.t + 1;
            seed(data.s.startSeed);
            netTick = 0;
            players = data.s.players;
            recreateMap(data.s.mapSeed);

            const cl = requireClient(from);
            cl.t = data.t;
            cl.acknowledgedTic = data.receivedOnSender;
            for (const e of data.e) {
                const cld = requireClient(e.c);
                if (cld.t < e.t) {
                    cld.t = e.t;
                }
                cld.acknowledgedTic = data.receivedOnSender;
                receivedEvents.push(e);
            }
        } else {
            const cl = requireClient(from);
            cl.ready = data.sync;
            // ignore old packets
            if (data.t > cl.t) {
                cl.isPlaying = true;
                for (const e of data.e) {
                    if (e.t > cl.t /*alreadyReceivedTic*/) {
                        receivedEvents.push(e);
                    }
                }
                cl.t = data.t;
            }
            // IMPORTANT TO NOT UPDATE ACK IF WE GOT OLD PACKET!! WE COULD TURN REMOTE TO THE PAST
            // just update last ack, now we know that Remote got `acknowledgedTic` amount of our tics,
            // then we will send only events from [acknowledgedTic + 1] index
            if (cl.acknowledgedTic < data.receivedOnSender) {
                // update ack
                cl.acknowledgedTic = data.receivedOnSender;
            }
        }
        // if (!clientActive) {
        lastFrameTs = performance.now() * 0.001;
        if (tryRunTicks(lastFrameTs)) {
            trySendInput();
            cleaningUpClients();
        }
        // }
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

/// Game logic

interface Player {
    c: ClientID;
    s: number;
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    btn?: number;
}

let players: Player[] = [];
const boundsX0 = 0;
const boundsY0 = 0;
const boundsX1 = 512 * 4;
const boundsY1 = 512 * 4;
const jumpVel = 400;
const gravity = -1000;

const player_x0 = -24;
const player_x1 = 24;
const player_y0 = -24;
const player_y1 = 24;

function createGameState() {

}

function processTicCommands(commands: ClientEvent[]) {
    for (const cmd of commands) {
        const source = cmd.c ?? getClientId();
        if (cmd.spawn) {
            const player: Player = {
                x: cmd.spawn.x,
                y: cmd.spawn.y,
                z: cmd.spawn.z,
                c: source,
                vx: 0,
                vy: 0,
                vz: 0,
                s: 1
            };
            players = players.filter(p => p.c !== player.c);
            players.push(player);
        }
        if (cmd.btn !== undefined) {
            const player = getPlayerByClient(source);
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
            player.z += player.vz * dt;
            player.vz += gravity * dt;

            let grounded = false;
            if (player.z <= 0) {
                player.z = 0;
                if (player.vz < 0.0) {
                    player.vz = 0.0;
                }
                grounded = true;
            }

            if (player.y + player_y1 >= boundsY1) {
                player.y = boundsY1 - player_y1;
                if (player.vy > 0) {
                    player.vy = -player.vy / 2;
                }
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

            if (player.btn === undefined) {
                player.btn = 0;
            }

            if (player.btn & 0x300) {
                const dir = 2 * Math.PI * (player.btn & 0xFF) / Const.AnglesRes - Math.PI;
                if (grounded) {
                    if (player.btn & 0x200) {
                        player.z = 1;
                        player.vz = jumpVel;
                        grounded = false;
                        if (!MUTE_ALL) {
                            play(snd_blip, false, 0.2 + 0.8 * random());
                        }
                    }
                }
                if (player.btn & 0x100) {
                    player.vx = reach(player.vx, 500 * Math.cos(dir), 500 * dt * 16);
                    player.vy = reach(player.vy, 500 * Math.sin(dir), 500 * dt * 16);
                }
            } else {
                let c = grounded ? 16 : 8;
                player.vx = reach(player.vx, 0, 400 * dt * c);
                player.vy = reach(player.vy, 0, 400 * dt * c);
            }
        }
    }
}

let lastState: Player[];
let simulatedFrames = 0;

function getCommandsForTic(tic: number): ClientEvent[] {
    return localEvents.filter(v => v.t === tic)
        .concat(receivedEvents.filter(v => v.t === tic));
}

function beginPrediction() {
    lastState = players;
    simulatedFrames = 0;
    if (!Const.Prediction) return;
    players = JSON.parse(JSON.stringify(players));
    let time = lastFrameTs - prevTime;
    // let time = lastFrameTs - prevTime;
    let tic = gameTic;
    while (time > 0) {
        const dt = Math.min(time, Const.NetDt);
        processTicCommands(getCommandsForTic(tic));
        simulateTic(dt);
        time -= dt;
        simulatedFrames += dt / Const.NetDt;
        ++tic;
    }
}

function endPrediction() {
    players = lastState;
}

function drawShadows() {
    let i = 0;
    for (const player of players) {
        if (player.s) {
            const shadowScale = (16 - player.z / 8.0) / 8.0;
            draw(img_cirle, player.x, player.y, 0, 4 * shadowScale, shadowScale, 0x00000077, 0.0);
        }
        ++i;
    }
}

function drawBody(p: Player) {
    const x = p.x;
    const y = p.y - p.z;

    const speed = Math.hypot(p.vx, p.vy, p.vz);
    const walk = Math.min(1, speed / 400.0);
    let base = -2 * walk * 0.5 * (1.0 + Math.sin(40 * lastFrameTs));
    const idle_base = (1 - walk) * 2 * (Math.pow(1 + Math.sin(15 * lastFrameTs), 2) / 4);
    base += idle_base;
    const leg1 = 20 - 15 * walk * 0.5 * (1.0 + Math.sin(40 * lastFrameTs));
    const leg2 = 20 - 15 * walk * 0.5 * (1.0 + Math.sin(40 * lastFrameTs + Math.PI));
    const sw1 = walk * Math.sin(20 * lastFrameTs);
    const sw2 = walk * Math.cos(20 * lastFrameTs);
    img_box.x = 0.5;
    img_box.y = 0;
    draw(img_box, x + 16, y - 16 - 20 - 4 + base, -Math.PI / 4 + sw1, 8, 20, 0x888888FF, 0);
    draw(img_box, x - 16, y - 16 - 20 - 4 + base, Math.PI / 4 + sw2, 8, 20, 0x888888FF, 0);
    draw(img_box, x - 10, y + 16 - 32 - 4, 0, 10, leg1, 0x888888FF, 0);
    draw(img_box, x + 10, y + 16 - 32 - 4, 0, 10, leg2, 0x888888FF, 0);
    img_box.x = 0.5;
    img_box.y = 0.5;
    draw(img_box, x, y - 24 - 4 + base, 0, 32, 24, 0x444444FF, 0);

    {
        const s = p.vz * 0.0005;
        const a = 0.0005 * p.vx;
        draw(img_players[p.c % img_players.length], x, y - 56 + base * 2, a, 4 * (1 - s), 4 * (1 + s), 0xFFFFFFFF, 0.0);
    }
}

function drawPlayers() {
    const pl = players.concat();
    pl.sort((a, b) => a.y - b.y);
    for (const player of pl) {
        if (player.s) {
            drawBody(player);
        }
    }
}

function unpack(data: ArrayBuffer): Packet {
    const u32 = new Uint32Array(data);
    const f32 = new Float32Array(data);
    let ptr = 0;
    const packet: Packet = {
        sync: u32[ptr++] !== 0,
        c: u32[ptr++],
        receivedOnSender: u32[ptr++],
        t: u32[ptr++],
        e: []
    };
    const eventsCount = u32[ptr++];
    let event_t = u32[ptr++];
    const hasInit = u32[ptr++];
    for (let i = 0; i < eventsCount; ++i) {
        const e: ClientEvent = {
            t: event_t++,
        };
        const flags = u32[ptr++];
        const hasBtn = flags & 1;
        const hasSpawn = flags & 2;
        const hasClientID = flags & 4;
        if (hasBtn) {
            e.btn = u32[ptr++];
        }
        if (hasSpawn) {
            e.spawn = {
                x: f32[ptr++],
                y: f32[ptr++],
                z: f32[ptr++],
            };
        }
        e.c = hasClientID ? u32[ptr++] : packet.c;
        packet.e.push(e);
    }
    if (hasInit) {
        const init: InitData = {
            mapSeed: u32[ptr++],
            startSeed: u32[ptr++],
            players: [],
        };
        const playersCount = u32[ptr++];
        for (let i = 0; i < playersCount; ++i) {
            const p: Player = {
                c: u32[ptr++],
                btn: u32[ptr++],
                s: u32[ptr++],

                x: f32[ptr++],
                y: f32[ptr++],
                z: f32[ptr++],

                vx: f32[ptr++],
                vy: f32[ptr++],
                vz: f32[ptr++],
            };
            init.players.push(p);
        }
        packet.s = init;
    }
    return packet;
}

const packBufferU32 = new Uint32Array(256);
const packBufferF32 = new Float32Array(packBufferU32.buffer);

function pack(packet: Packet): ArrayBuffer {
    const u32 = packBufferU32;
    const f32 = packBufferF32;
    let ptr = 0;
    u32[ptr++] = packet.sync ? 1 : 0;
    u32[ptr++] = packet.c;
    u32[ptr++] = packet.receivedOnSender;
    u32[ptr++] = packet.t;

    packet.e.sort((a, b) => a.t - b.t);
    let event_t = packet.e.length > 0 ? packet.e[0].t : 0;
    const event_end = packet.e.length > 0 ? packet.e[packet.e.length - 1].t : -1;
    const eventsCount = event_end - event_t + 1;
    u32[ptr++] = eventsCount;
    u32[ptr++] = event_t;

    // has init
    const hasInit = !!packet.s;
    u32[ptr++] = hasInit ? 1 : 0;

    let i = 0;
    while (event_t <= event_end) {
        const e = packet.e[i];
        const t = event_t++;
        if (t < e.t) {
            u32[ptr++] = 0;
            continue;
        }
        ++i;
        let flags = 0;
        if (e.btn !== undefined) flags |= 1;
        if (e.spawn) flags |= 2;
        if (!!e.c) flags |= 4;
        u32[ptr++] = flags;

        if (e.btn !== undefined) {
            u32[ptr++] = e.btn;
        }
        if (e.spawn) {
            f32[ptr++] = e.spawn.x;
            f32[ptr++] = e.spawn.y;
            f32[ptr++] = e.spawn.z;
        }
        if (!!e.c) {
            u32[ptr++] = e.c;
        }
    }
    if (hasInit) {
        u32[ptr++] = packet.s.mapSeed;
        u32[ptr++] = packet.s.startSeed;
        u32[ptr++] = packet.s.players.length;
        for (let i = 0; i < packet.s.players.length; ++i) {
            const p = packet.s.players[i];

            u32[ptr++] = p.c;
            u32[ptr++] = p.btn;
            u32[ptr++] = p.s;
            f32[ptr++] = p.x;
            f32[ptr++] = p.y;
            f32[ptr++] = p.z;
            f32[ptr++] = p.vx;
            f32[ptr++] = p.vy;
            f32[ptr++] = p.vz;
        }
    }
    const buffer = u32.slice(0, ptr).buffer;

    return buffer;
}
