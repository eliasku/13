import {ClientID} from "../../shared/types";
import {getClientId, getRemoteClient, getRemoteClients} from "../net/messaging";
import {gl} from "../graphics/gl";
import {play} from "../audio/context";
import {log, termPrint} from "../debug/log";
import {inputPointers, keyboardState} from "../fluid/input";
import {beginRender, beginRenderGroup, camera, createTexture, draw, flush, Texture} from "../graphics/draw2d";
import {getSeed, rand, random, seed} from "../utils/rnd";
import {channels_sendObjectData, getChannelPacketSize, setRTMessageHandler} from "../net/channels";
import {img_atlas, img_barrels, img_box, img_cirle, img_players, img_trees, img_weapons, snd_blip} from "./res";
import {Const, MUTE_ALL} from "./config";
import {generateMapBackground} from "./maze";
import {Actor, ActorType, Client, ClientEvent, Packet} from "./types";
import {pack, unpack} from "./packets";
import {reach} from "../utils/math";

let imgMap: Texture = null;
let imgMapSeed: number;

let clientActive = true;

let clients: Client[] = [];
let localEvents: ClientEvent[] = [];
let receivedEvents: ClientEvent[] = [];

// ticks received from all peers (min value), we could simulate to it
let netTick = 0;
let startTick = -1;
let gameTic = 0;
let prevTime = 0;
let startTime = 0;
let ackMin = 0;
let joined = false;

let lastFrameTs = 0;
let lastInputTic = 0;
let lastInputCmd = 0;

let lastState: Actor[];
let lastSeed: number;

let simulatedFrames = 0;

let actors: Actor[] = [];
let actorsSorted: Actor[] = [];
const boundsX0 = 0;
const boundsY0 = 0;
const boundsX1 = 512 * 4;
const boundsY1 = 512 * 4;
const jumpVel = 400;
const gravity = 1000;

let cameraShake = 0;

const objectRadiusUnit = 28;

function requireClient(id: ClientID) {
    if (!clients[id]) {
        clients[id] = {c: id, t: 0, acknowledgedTic_: 0};
    }
    return clients[id];
}

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

    camera.atX += ((((Math.random() - 0.5) * cameraShake * 8 * 4) | 0) / 4) | 0;
    camera.atY += ((((Math.random() - 0.5) * cameraShake * 8 * 4) | 0) / 4) | 0;
    gl.clearColor(0.1 * Math.random(), 0.0, 0.1, 1.0);
    beginRender(w, h);
    beginRenderGroup(false);
    if (imgMap) {
        draw(imgMap, 0, 0, 0, 4, 4, 0xFFFFFFFF, 0);
    }
    sortActorsView();
    drawShadows();
    drawActors();
    flush();

    draw(img_atlas, 0, 0, 0, 1, 1, 0xFFFFFFFF, 0);
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

    actors.push({type_: ActorType.Barrel, x: 0, y: objectRadiusUnit, z: 0, vx: 0, vy: 0, vz: 0, c: 0});
    actors.push({type_: ActorType.Barrel, x: 0, y: objectRadiusUnit * 3, z: 0, vx: 0, vy: 0, vz: 0, c: 1});

    for (let i = 0; i < 32; ++i) {
        actors.push({
            type_: ActorType.Tree,
            x: rand() % (512 * 4),
            y: rand() % (512 * 4),
            z: 0,
            vx: 0,
            vy: 0,
            vz: 0,
            c: rand() & 1
        });
    }

    for (let i = 0; i < 32; ++i) {
        actors.push({
            type_: ActorType.Barrel,
            x: rand() % (512 * 4),
            y: rand() % (512 * 4),
            z: 100,
            vx: 0,
            vy: 0,
            vz: 0,
            c: rand() & 1
        });
    }
    // if (!(rand() & 0xFF)) {
    //     const x = rand() % 1024;
    //     const y = rand() % 1024;
    //     actors.push({
    //         type_: ActorType.Barrel,
    //         c: rand() & 1,
    //         x, y, z: 200, vx: 0, vy: 0, vz: 0,
    //     })
    // }
}

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
            checkPlayerInput();
            checkJoinSync(gameTic - 1);
        }
        endPrediction();
        trySendInput();
        cleaningUpClients();
    }

    printRemoteClients();
}


let prevRenderTic = 0;

const icons_iceState = {
    "disconnected": "⭕",
    "closed": "🔴",
    "failed": "❌",
    "connected": "🟢",
    "completed": "✅",
    "new": "🆕",
    "checking": "🟡",
};
const icons_channelState = {
    "connecting": "🟡",
    "open": "🟢",
    "closed": "🔴",
    "closing": "❌",
};

function printRemoteClients() {
    let text = "🌐";
    if (prevRenderTic === gameTic) text = "🥶";
    const fr = simulatedFrames - (simulatedFrames | 0);
    if (fr > 0) text = "✨";
    if ((simulatedFrames | 0) > 0) text = "🔮";
    prevRenderTic = gameTic;
    text += ` b:${(((lastFrameTs - prevTime) / Const.NetDt) | 0)}`;
    text += " r:" + (simulatedFrames | 0) + (fr > 0 ? "." : "") + "\n";
    text += "d " + (lastFrameTs - prevTime).toFixed(2) + "\n";
    text += "~ " + (gameTic * Const.NetDt).toFixed(2) + "\n";

    text += `┌ ${getClientId()} | game: ${gameTic}, net: ${netTick}\n`;
    const remoteClients = getRemoteClients();
    for (const remoteClient of remoteClients) {
        const pc = remoteClient.pc;
        const dc = remoteClient.dc;
        const cl = clients[remoteClient.id];
        text += "├ " + remoteClient.id;
        text += pc ? (icons_iceState[pc.iceConnectionState] ?? "❓") : "🧿";
        text += dc ? icons_channelState[dc.readyState] : "🧿";
        if (cl) {
            text += `+${cl.t - (gameTic - 1)}`;
            text += "| x" + getChannelPacketSize(remoteClient).toString(16);
        }
        text += "\n";
    }
    termPrint(text + "\n");
}

function getMyPlayer(): Actor | undefined {
    const c = getClientId();
    for (const p of actors) {
        if (p.c === c) {
            return p;
        }
    }
}

function getPlayerByClient(c: ClientID): Actor | undefined {
    for (const p of actors) {
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

function getNextInputTic() {
    const simTic = ((lastFrameTs - prevTime) * Const.NetFq) | 0;
    return gameTic + Math.max(Const.InputDelay, simTic);
}

function checkPlayerInput() {
    const inputTic = getNextInputTic();
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
        getLocalEvent(inputTic).btn_ = btn;
        lastInputCmd = btn;
    }
}

function checkJoinSync(lastTic: number) {
    if (!joined && startTick >= 0) {
        const ticToSpawn = getNextInputTic();
        for (const rc of getRemoteClients()) {
            if (rc.dc && rc.dc.readyState === "open") {
                const cl = clients[rc.id];
                if (!cl || !cl.ready_) {
                    log("syncing...");
                    return;
                }
            }
        }
        joined = true;
        log("All in sync");
        getLocalEvent(ticToSpawn).spawn_ = {
            x: Math.random() * 800.0,
            y: 200 + 400 * Math.random(),
            z: 100 * Math.random()
        };
    }
}

function calcNetTick() {
    let tmin = 0xFFFFFFFF;
    let amin = 0xFFFFFFFF;
    for (const client of getRemoteClients()) {
        const cl = clients[client.id];
        if (cl) {
            if (cl.t < tmin) {
                tmin = cl.t;
            }
            if (!cl.acknowledgedTic_) {
                amin = 0;
            } else if (cl.acknowledgedTic_ < amin) {
                amin = cl.acknowledgedTic_;
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
            prevTime = (1 - k) * prevTime + k * (ts - allowFramesToPredict * Const.NetDt);

            // prevTime = ts - allowFramesToPredict * Const.NetDt;
        }
    } else {
        // we got packets to go
        if (gameTic + Const.InputDelay < netTick) {
            // speed up
            // console.info("speed up");
            // prevTime -= Const.NetDt * dropRate;
            prevTime = (1 - k) * prevTime + k * (ts - Const.InputDelay * Const.NetDt);

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
                    receivedOnSender_: cl.t,
                    e: [],
                    sync_: cl.isPlaying_,
                };
                if (packet.t > cl.acknowledgedTic_) {
                    for (const e of localEvents) {
                        if (e.t > cl.acknowledgedTic_ && e.t <= packet.t /* buffer all inbetween frames current tic events */) {
                            packet.e.push(e);
                        }
                    }
                    channels_sendObjectData(client, pack(packet));
                }
            } else {
                const init: Packet = {
                    sync_: false,
                    c: getClientId(),
                    t: lastTic,
                    // important to wait for ack on who is initializing
                    receivedOnSender_: lastTic,
                    e: [],
                    s: {
                        mapSeed_: imgMapSeed,
                        startSeed_: getSeed(),
                        actors_: actors
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
    if (startTick < 0 && data.s) {
        startTick = data.t;
        startTime = prevTime = lastFrameTs;
        gameTic = data.t + 1;
        seed(data.s.startSeed_);
        netTick = 0;
        actors = data.s.actors_;
        recreateMap(data.s.mapSeed_);

        const cl = requireClient(from);
        cl.t = data.t;
        cl.acknowledgedTic_ = data.receivedOnSender_;
        for (const e of data.e) {
            const cld = requireClient(e.c);
            if (cld.t < e.t) {
                cld.t = e.t;
            }
            cld.acknowledgedTic_ = data.receivedOnSender_;
            receivedEvents.push(e);
        }
    } else {
        const cl = requireClient(from);
        cl.ready_ = data.sync_;
        // ignore old packets
        if (data.t > cl.t) {
            cl.isPlaying_ = true;
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
        if (cl.acknowledgedTic_ < data.receivedOnSender_) {
            // update ack
            cl.acknowledgedTic_ = data.receivedOnSender_;
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
                actors = actors.filter(x => x.c !== cl.c);
            }
        }
    }
}

/// Game logic

function createGameState() {

}

function processTicCommands(commands: ClientEvent[]) {
    for (const cmd of commands) {
        const source = cmd.c ?? getClientId();
        if (cmd.spawn_) {
            const player: Actor = {
                type_: ActorType.Player,
                c: source,
                x: cmd.spawn_.x,
                y: cmd.spawn_.y,
                z: cmd.spawn_.z,
                vx: 0,
                vy: 0,
                vz: 0,
            };
            actors = actors.filter(p => p.c !== player.c);
            actors.push(player);
        }
        if (cmd.btn_ !== undefined) {
            const player = getPlayerByClient(source);
            if (player) {
                player.btn_ = cmd.btn_;
            }
        }
    }
}

function simulateTic(dt: number) {
    actors.sort((a, b) => (a.y * 512 * 4 + a.x - b.y * 512 * 4 - b.x));
    updateBodyCollisions();
    for (const actor of actors) {
        const type = actor.type_;
        updateBody(actor, dt);
        if (type === ActorType.Player) {
            updatePlayer(actor, dt);
        }
    }
    cameraShake = reach(cameraShake, 0, dt);
}

function updateBodyCollisions() {
    const max = actors.length;
    for (let i = 0; i < max; ++i) {
        const a = actors[i];
        for (let j = i + 1; j < max; ++j) {
            const b = actors[j];
            let nx = a.x - b.x;
            let ny = (a.y - b.y) * 2;
            let nz = a.z - b.z;
            const dist = Math.sqrt(nx * nx + ny * ny + nz * nz);
            if (dist < (24 + 24) && dist > 0) {
                const pen = (24 + 24 - dist) / 2;
                nx *= pen / dist;
                ny *= pen / dist;
                nz *= pen / dist;
                if (a.type_ !== ActorType.Tree) {
                    a.x += nx;
                    a.y += ny;
                    a.z += nz;
                }
                if (b.type_ !== ActorType.Tree) {
                    b.x -= nx;
                    b.y -= ny;
                    b.z -= nz;
                }
            }
        }
    }
}

function updateBody(body: Actor, dt: number) {
    body.x += body.vx * dt;
    body.y += body.vy * dt;
    body.z += body.vz * dt;
    body.vz -= gravity * dt;

    if (body.z <= 0) {
        body.z = 0;
        if (body.vz < 0.0) {
            body.vz = 0.0;
        }
    }

    if (body.y >= boundsY1 - objectRadiusUnit / 2) {
        body.y = boundsY1 - objectRadiusUnit / 2;
        if (body.vy > 0) {
            body.vy = -body.vy / 2;
        }
    }
    if (body.y <= boundsY0 + objectRadiusUnit / 2) {
        body.y = boundsY0 + objectRadiusUnit / 2;
        if (body.vy < 0) {
            body.vy = -body.vy / 2;
        }
    }
    if (body.x >= boundsX1 - objectRadiusUnit) {
        body.x = boundsX1 - objectRadiusUnit;
        if (body.vx > 0) {
            body.vx = -body.vx / 2;
        }
    }
    if (body.x <= boundsX0 + objectRadiusUnit) {
        body.x = boundsX0 + objectRadiusUnit;
        if (body.vx < 0) {
            body.vx = -body.vx / 2;
        }
    }
}

function updatePlayer(player: Actor, dt: number) {
    if (player.btn_ === undefined) {
        player.btn_ = 0;
    }

    let grounded = player.z === 0 && player.vz === 0;

    if (player.btn_ & 0x300) {
        const dir = 2 * Math.PI * (player.btn_ & 0xFF) / Const.AnglesRes - Math.PI;
        if (grounded) {
            if (player.btn_ & 0x200) {
                player.z = 1;
                player.vz = jumpVel;
                grounded = false;
                cameraShake += 1;
                if (!MUTE_ALL) {
                    play(snd_blip, false, 0.2 + 0.8 * random());
                }
            }
        }
        if (player.btn_ & 0x100) {
            player.vx = reach(player.vx, 500 * Math.cos(dir), 500 * dt * 16);
            player.vy = reach(player.vy, 500 * Math.sin(dir), 500 * dt * 16);
        }
    } else {
        let c = grounded ? 16 : 8;
        player.vx = reach(player.vx, 0, 400 * dt * c);
        player.vy = reach(player.vy, 0, 400 * dt * c);
    }
}

function getCommandsForTic(tic: number): ClientEvent[] {
    return localEvents.filter(v => v.t === tic)
        .concat(receivedEvents.filter(v => v.t === tic));
}

function beginPrediction() {
    lastState = actors;
    lastSeed = getSeed();
    simulatedFrames = 0;
    if (!Const.Prediction) return;
    actors = JSON.parse(JSON.stringify(actors));
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
    actors = lastState;
    seed(lastSeed);
}

function sortActorsView() {
    actorsSorted = actors.concat();
    actorsSorted.sort((a, b) => a.y - b.y);
}

function drawShadows() {
    for (const actor of actors) {
        const shadowScale = (16 - actor.z / 8.0) / 8.0;
        draw(img_cirle, actor.x, actor.y, 0, 4 * shadowScale, shadowScale, 0x00000077, 0.0);
    }
}

function drawActors() {
    for (const actor of actorsSorted) {
        const type = actor.type_;
        if (type === ActorType.Player) {
            drawPlayer(actor);
        } else if (type === ActorType.Barrel) {
            drawBarrel(actor);
        } else if (type === ActorType.Tree) {
            drawTree(actor);
        }
    }
}

function drawPlayer(p: Actor) {
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

    const lArmRot = Math.PI / 4 + sw2 + Math.PI / 2;
    const dx = Math.cos(lArmRot) * 20;
    const dy = Math.sin(lArmRot) * 20;

    const wi = p.c % 3;
    if(wi === 0) {
        img_weapons[0].x = 0.7;
        img_weapons[0].y = 0.3;
        draw(img_weapons[0], dx + x - 16, dy + y - 16 - 20 - 4 + base, +sw2 - Math.PI /1.5, 4, 4, 0xFFFFFFFF, 0);
    }
    else if(wi === 1) {
        img_weapons[1].x = 0.3;
        img_weapons[1].y = 0.3;
        draw(img_weapons[1], dx + x - 16, dy + y - 16 - 20 - 4 + base, +sw2, 2, 2, 0xFFFFFFFF, 0);
    }
    else if(wi === 2) {
        img_weapons[2].x = 0.5;
        img_weapons[2].y = 0.5;
        draw(img_weapons[2], dx + x - 16, dy + y - 16 - 20 - 4 + base, 0.5 * sw2 - 0.9, 2, 2, 0xFFFFFFFF, 0);
    }
}

function drawBarrel(p: Actor) {
    const x = p.x;
    const y = p.y - p.z;

    draw(img_barrels[p.c], x, y - 29, 0, 3.7, 3.7, 0xFFFFFFFF, 0.0);
}

function drawTree(p: Actor) {
    const x = p.x;
    const y = p.y - p.z;

    draw(img_trees[p.c], x, y - 48, 0, 4, 4, 0xFFFFFFFF, 0.0);
}
