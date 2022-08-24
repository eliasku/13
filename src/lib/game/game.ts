import {ClientID} from "../../shared/types";
import {getClientId, getRemoteClient, getRemoteClients} from "../net/messaging";
import {GL, gl} from "../graphics/gl";
import {play} from "../audio/context";
import {log, termPrint} from "../debug/log";
import {beginRender, beginRenderGroup, camera, createTexture, draw, flush, Texture} from "../graphics/draw2d";
import {getSeed, rand, random, seed} from "../utils/rnd";
import {channels_sendObjectData, getChannelPacketSize, setRTMessageHandler} from "../net/channels";
import {
    img_barrels,
    img_box,
    img_cirle,
    img_items,
    img_players,
    img_trees,
    img_weapons,
    snd_blip,
    snd_heal,
    snd_med,
    snd_pick,
    snd_shoot
} from "./res";
import {Const} from "./config";
import {generateMapBackground} from "./maze";
import {Actor, ActorType, Client, ClientEvent, EffectItemType, InitData, ItemCategory, Packet} from "./types";
import {pack, unpack} from "./packets";
import {reach, toRad} from "../utils/math";
import {
    ControlsFlag, drawVirtualPad,
    dropButton,
    jumpButtonDown,
    lookAtX,
    lookAtY,
    moveFast,
    moveX,
    moveY,
    shootButtonDown,
    updateControls,
    viewX,
    viewY
} from "./controls";
import {keyboardDown, keyboardState} from "../utils/input";

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

// static state
let imgMap: Texture = null;
let trees: Actor[] = [];

// dynamic state
let state: InitData = {
    seed_: 0,
    mapSeed_: 0,
    players_: [],
    barrels_: [],
    bullets_: [],
    items_: [],
}

let lastState: InitData;

let simulatedFrames = 0;

const PlayerHandsZ = 10;
const boundsSize = 0x200;
const jumpVel = 0x50;
const gravity = 0x100;
const gravityHold = 0x80;

let cameraShake = 0;

const objectRadiusUnit = 8;
const bulletRadiusUnit = 4;

interface WeaponConfig {
    rate_: number;
    angleSpread_: number;
    kickBack_: number;
    jumpBack_: number;
    offset_: number;
    offsetZ_: number;
    velocity_: number;
    cameraShake_: number;
    detuneSpeed_: number;
    cameraFeedback_: number;
    cameraLookForward_: number;
    gfx_: number;
    gfxRot_: number;
    gfxSx_: number;
    bulletType_: number;
    bulletLifeTime_: number;
}

function createArmWeapon(gfx: number): WeaponConfig {
    return {
        rate_: 1,
        angleSpread_: 0.5,
        kickBack_: 40,
        jumpBack_: 8,
        offset_: 0,
        offsetZ_: 0,
        velocity_: 100,
        cameraShake_: 0,
        detuneSpeed_: 16,
        cameraFeedback_: 0.02,
        cameraLookForward_: 0.1,
        gfx_: gfx,
        gfxRot_: 0,
        gfxSx_: 1,
        bulletType_: 1,
        bulletLifeTime_: 0.2,
    };
}

const weapons: WeaponConfig[] = [
    // MELEE
    createArmWeapon(-1),
    createArmWeapon(0),
    createArmWeapon(1),
    createArmWeapon(2),
    createArmWeapon(3),
    // PISTOL
    {
        rate_: 10,
        angleSpread_: 0.25,
        kickBack_: 20,
        jumpBack_: 4,
        offset_: 10,
        offsetZ_: 0,
        velocity_: 330,
        cameraShake_: 0,
        detuneSpeed_: 16,
        cameraFeedback_: 0.01,
        cameraLookForward_: 0.2,
        gfx_: 4,
        gfxRot_: 0,
        gfxSx_: 1,
        bulletType_: 2,
        bulletLifeTime_: 0,
    }
];
weapons[0].rate_ = 2;
weapons[0].gfx_ = -1;
// 🔪
weapons[1].rate_ = 4;
weapons[1].gfxRot_ = toRad(-90);
weapons[1].gfx_ = 0;
// 🔨
weapons[2].gfx_ = 1;
weapons[2].gfxSx_ = -1;
// ⛏
weapons[3].gfx_ = 2;
weapons[3].gfxSx_ = -1;
// 🗡
weapons[4].gfx_ = 3;
weapons[4].gfxRot_ = toRad(180 - 45);
// weapons[4].gfxSx_ = -1;

// 🔫
weapons[5].gfx_ = 4;
weapons[5].gfxSx_ = -1;

function getWeapon(player: Actor): WeaponConfig {
    return weapons[player.weapon_];
}

function requireClient(id: ClientID): Client {
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
    camera.scale = Math.min(w, h) / 256;
    camera.toX = 0.5;
    camera.toY = 0.5;
    camera.atX = camera.atY = boundsSize >> 1;
    const p0 = getMyPlayer();
    if (p0) {
        const wpn = getWeapon(p0);
        camera.atX = p0.x + (wpn.cameraLookForward_ - wpn.cameraFeedback_ * p0.t) * (lookAtX - p0.x);
        camera.atY = p0.y + (wpn.cameraLookForward_ - wpn.cameraFeedback_ * p0.t) * (lookAtY - p0.y);
        //camera.scale -= Math.hypot(p0.vx, p0.vy) / 128;
    }
    camera.atX += ((Math.random() - 0.5) * cameraShake * 8) | 0;
    camera.atY += ((Math.random() - 0.5) * cameraShake * 8) | 0;
    beginRender(w, h);
    gl.clearColor(0.4, 0.4, 0.4, 1.0);
    gl.clear(GL.COLOR_BUFFER_BIT);
    beginRenderGroup();
    drawMapBackground();
    drawObjects();
    drawMapOverlay();
    drawCrosshair();
    flush();

    camera.toX =
    camera.toY =
    camera.atX =
    camera.atY = 0.0;
    beginRender(w, h);
    beginRenderGroup();
    drawVirtualPad();
    flush()
}

function recreateMap() {
    // generate map
    seed(state.mapSeed_);
    const mapbg = generateMapBackground();
    imgMap = createTexture(mapbg);

    trees = [];
    for (let i = 0; i < 32; ++i) {
        trees.push({
            type_: ActorType.Tree,
            x: rand() % boundsSize,
            y: rand() % boundsSize,
            z: 0,
            vx: 0,
            vy: 0,
            vz: 0,
            c: rand() & 1
        });
    }
}

function createSeedGameState() {
    startTick = 0;
    gameTic = 0;
    netTick = 0;
    startTime = prevTime = lastFrameTs;
    //players[0] = {c: getClientId(), x: Math.random() * 800, y: 400, z: 100, s: 1, vx: 0, vy: 0, vz: 0};
    state.mapSeed_ = getSeed();
    recreateMap();
    state.seed_ = getSeed();

    for (let i = 0; i < 32; ++i) {
        state.barrels_.push({
            type_: ActorType.Barrel,
            x: rand() % boundsSize,
            y: rand() % boundsSize,
            z: 32,
            vx: 0,
            vy: 0,
            vz: 0,
            hp_: 1 + rand() & 1,
            c: rand() & 1
        });
    }

    for (let i = 0; i < 32; ++i) {
        state.items_.push({
            type_: ActorType.Item,
            x: rand() % boundsSize,
            y: rand() % boundsSize,
            z: 32,
            vx: 0,
            vy: 0,
            vz: 0,
            btn_: 1,
            c: 0,
            t: 1 + rand() % (weapons.length - 1),
        });
    }
    for (let i = 0; i < 32; ++i) {
        state.items_.push({
            type_: ActorType.Item,
            x: rand() % boundsSize,
            y: rand() % boundsSize,
            z: 32,
            vx: 0,
            vy: 0,
            vz: 0,
            btn_: 2,
            c: 0,
            t: rand() % 2,
        });
    }
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
    text += "visible: " + drawList.length + "\n";

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
    for (const p of state.players_) {
        if (p.c === c) {
            return p;
        }
    }
}

function getPlayerByClient(c: ClientID): Actor | undefined {
    for (const p of state.players_) {
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
        updateControls(player);

        if (viewX || viewY) {
            btn |= packAngleByte(viewY, viewX, Const.ViewAngleRes) << 16;
            if (shootButtonDown) {
                btn |= ControlsFlag.Shooting;
            }
        }
        if (moveX || moveY) {
            btn |= packAngleByte(moveY, moveX, Const.AnglesRes);
            btn |= ControlsFlag.Move;
            if (moveFast) {
                btn |= ControlsFlag.Run;
            }
        }

        if (jumpButtonDown) {
            btn |= ControlsFlag.Jump;
        }

        if (dropButton) {
            btn |= ControlsFlag.Drop;
        }

        if(keyboardDown["Digit1"]) {
            ++debugCheckAvatar;
        }
    }
    if (lastInputCmd !== btn) {
        getLocalEvent(inputTic).btn_ = btn;
        lastInputCmd = btn;
    }
}

let debugCheckAvatar = 0;

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
        netTick = ackMin = gameTic + ((lastFrameTs - prevTime) * Const.NetFq) | 0;
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
                state.seed_ = getSeed();
                const init: Packet = {
                    sync_: false,
                    c: getClientId(),
                    t: lastTic,
                    // important to wait for ack on who is initializing
                    receivedOnSender_: lastTic,
                    e: [],
                    s: state,
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

function processPacket(sender: Client, data: Packet) {
    if (startTick < 0 && data.s) {
        startTick = data.t;
        startTime = prevTime = lastFrameTs;
        gameTic = data.t + 1;
        state = data.s;
        netTick = 0;
        recreateMap();
        seed(data.s.seed_);

        sender.t = data.t;
        sender.acknowledgedTic_ = data.receivedOnSender_;
        for (const e of data.e) {
            const cld = requireClient(e.c);
            if (cld.t < e.t) {
                cld.t = e.t;
            }
            cld.acknowledgedTic_ = data.receivedOnSender_;
            receivedEvents.push(e);
        }
    } else {
        sender.ready_ = data.sync_;
        // ignore old packets
        if (data.t > sender.t) {
            sender.isPlaying_ = true;
            for (const e of data.e) {
                if (e.t > sender.t /*alreadyReceivedTic*/) {
                    receivedEvents.push(e);
                }
            }
            sender.t = data.t;
        }
        // IMPORTANT TO NOT UPDATE ACK IF WE GOT OLD PACKET!! WE COULD TURN REMOTE TO THE PAST
        // just update last ack, now we know that Remote got `acknowledgedTic` amount of our tics,
        // then we will send only events from [acknowledgedTic + 1] index
        if (sender.acknowledgedTic_ < data.receivedOnSender_) {
            // update ack
            sender.acknowledgedTic_ = data.receivedOnSender_;
        }
    }
}

function rtHandler(from: ClientID, buffer: ArrayBuffer) {
    const data = unpack(buffer);
    if (data) {
        processPacket(requireClient(from), data);
    } else {
        console.warn("income packet data size mismatch");
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
                state.players_ = state.players_.filter(x => x.c !== cl.c);
            }
        }
    }
}

/// Game logic

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
                t: 0,
                t2: 0,
                weapon_: rand() % weapons.length,
                hp_: 10,
            };
            state.players_ = state.players_.filter(p => p.c !== player.c);
            state.players_.push(player);
        }
        if (cmd.btn_ !== undefined) {
            const player = getPlayerByClient(source);
            if (player) {
                player.btn_ = cmd.btn_;
            }
        }
    }
}

function comparerSortY(a: Actor, b: Actor) {
    return a.y * boundsSize + a.x - b.y * boundsSize - b.x;
}

function sortList(list: Actor[]) {
    list.sort(comparerSortY);
}

function pickItem(item: Actor, player: Actor) {
    // isWeapon
    if (item.btn_ & 1) {
        const playerHasNoWeapon = !player.weapon_;
        const playerNotDropping = !(player.btn_ & ControlsFlag.Drop);
        if (playerHasNoWeapon && playerNotDropping) {
            player.weapon_ = item.t;
            play(snd_pick, false, 0.5);
            item.btn_ = 0;
        }
    }
    if (item.btn_ & 2) {
        if (item.t === EffectItemType.Med) {
            play(snd_med, false, 0.5);
            item.btn_ = 0;
        } else if (item.t === EffectItemType.Health) {
            if (player.hp_ < 10) {
                ++player.hp_;
                play(snd_heal, false, 0.5);
                item.btn_ = 0;
            }
        }
    }
}

function simulateTic(dt: number) {
    sortList(state.players_);
    sortList(state.barrels_);
    sortList(state.bullets_);
    sortList(state.items_);
    for (const player of state.players_) {
        const longJump = player === getMyPlayer() ? (player.btn_ & ControlsFlag.Jump) : 0;
        const g = longJump ? gravityHold : gravity;
        updateBody(player, dt, g);
        collideBounds(player);
        updatePlayer(player, dt);
    }
    for (const barrel of state.barrels_) {
        updateBody(barrel, dt, gravity);
        collideBounds(barrel);
        barrel.vx = reach(barrel.vx, 0, 512 * dt);
        barrel.vy = reach(barrel.vy, 0, 512 * dt);
    }
    for (const item of state.items_) {
        updateBody(item, dt, gravity);
        collideBounds(item);
        item.vx = reach(item.vx, 0, 512 * dt);
        item.vy = reach(item.vy, 0, 512 * dt);
        for (const player of state.players_) {
            if (testIntersection(item, player, objectRadiusUnit, objectRadiusUnit)) {
                pickItem(item, player);
            }
        }
    }
    for (const bullet of state.bullets_) {
        updateBody(bullet, dt, 0);
        if (collideBounds(bullet)) {
            bullet.btn_ = 0;
        }
        if (bullet.t > 0) {
            bullet.t -= dt;
            if (bullet.t <= 0) {
                bullet.btn_ = 0;
            }
        }
    }
    state.bullets_ = state.bullets_.filter(x => x.btn_);
    state.items_ = state.items_.filter(x => x.btn_);
    updateBulletCollision(state.players_);
    updateBulletCollision(state.barrels_);
    state.barrels_ = state.barrels_.filter(x => x.hp_);
    state.players_ = state.players_.filter(x => x.hp_);
    updateBodyInterCollisions(state.players_);
    updateBodyInterCollisions(state.barrels_);
    updateBodyInterCollisions2(state.players_, state.barrels_);
    updateBodyInterCollisions2(state.players_, trees);
    updateBodyInterCollisions2(state.barrels_, trees);
    cameraShake = reach(cameraShake, 0, dt);
}

function updateBodyInterCollisions2(list1: Actor[], list2: Actor[]) {
    for (let i = 0; i < list1.length; ++i) {
        const a = list1[i];
        for (let j = 0; j < list2.length; ++j) {
            const b = list2[j];
            let nx = a.x - b.x;
            let ny = (a.y - b.y) * 2;
            let nz = a.z - b.z;
            const dist = Math.sqrt(nx * nx + ny * ny + nz * nz);
            const D = objectRadiusUnit + objectRadiusUnit;
            if (dist < D && dist > 0) {
                const pen = (D - dist) / 2;
                nx *= pen / dist;
                ny *= pen / dist;
                nz *= pen / dist;
                if (a.type_ !== ActorType.Tree) {
                    a.x += nx;
                    a.y += ny;
                    a.z = Math.max(a.z + nz, 0);
                }
                if (b.type_ !== ActorType.Tree) {
                    b.x -= nx;
                    b.y -= ny;
                    a.z = Math.max(a.z - nz, 0);
                }
            }
        }
    }
}

function updateBodyInterCollisions(list: Actor[]) {
    const max = list.length;
    for (let i = 0; i < max; ++i) {
        const a = list[i];
        for (let j = i + 1; j < max; ++j) {
            const b = list[j];
            let nx = a.x - b.x;
            let ny = (a.y - b.y) * 2;
            let nz = a.z - b.z;
            const dist = Math.sqrt(nx * nx + ny * ny + nz * nz);
            const D = objectRadiusUnit + objectRadiusUnit;
            if (dist < D && dist > 0) {
                const pen = (D - dist) / 2;
                nx *= pen / dist;
                ny *= pen / dist;
                nz *= pen / dist;
                if (a.type_ !== ActorType.Tree) {
                    a.x += nx;
                    a.y += ny;
                    a.z = Math.max(a.z + nz, 0);
                }
                if (b.type_ !== ActorType.Tree) {
                    b.x -= nx;
                    b.y -= ny;
                    a.z = Math.max(a.z - nz, 0);
                }
            }
        }
    }
}

function testIntersection(a: Actor, b: Actor, r1: number, r2: number): boolean {
    let nx = a.x - b.x;
    let ny = a.y - b.y;
    let nz = a.z - b.z;
    const D = r1 + r2;
    return nx * nx + ny * ny + nz * nz < D * D;
}

function kill(actor: Actor) {
    if (actor.type_ === ActorType.Barrel) {
        const amount = 1 + rand() & 3;
        for (let i = 0; i < amount; ++i) {
            const a = random() * Math.PI * 2;
            const v = 32 + rand() % 64;
            state.items_.push({
                type_: ActorType.Item,
                c: 0,
                x: actor.x,
                y: actor.y,
                z: actor.z,
                vx: v * Math.cos(a),
                vy: v * Math.sin(a),
                vz: 0,
                btn_: 2,
                t: rand() & 1,
            });
        }
    }
    if (actor.type_ === ActorType.Player && actor.weapon_ > 0) {
        const a = random() * Math.PI * 2;
        const v = 32 + rand() % 64;
        state.items_.push({
            type_: ActorType.Item,
            c: 0,
            x: actor.x,
            y: actor.y,
            z: actor.z,
            vx: actor.vx + v * Math.cos(a),
            vy: actor.vy * Math.sin(a),
            vz: 0,
            btn_: 1,
            t: actor.weapon_,
        });
    }
}

function hitWithBullet(actor: Actor, bullet: Actor) {
    actor.vx += 0.1 * bullet.vx;
    actor.vy += 0.1 * bullet.vy;
    bullet.btn_ = 0;
    if (actor.hp_ > 0) {
        if (!(--actor.hp_)) {
            kill(actor);
        }
    }
}

function updateBulletCollision(list: Actor[]) {
    for (let i = 0; i < state.bullets_.length; ++i) {
        const b = state.bullets_[i];
        for (let j = 0; j < list.length; ++j) {
            const a = list[j];
            const owned = !(a.c - b.c);
            if (!owned && testIntersection(a, b, bulletRadiusUnit, objectRadiusUnit)) {
                hitWithBullet(a, b);
            }
        }
    }
}

function updateBody(body: Actor, dt: number, g: number) {
    body.x += body.vx * dt;
    body.y += body.vy * dt;
    body.z += body.vz * dt;
    body.vz -= g * dt;

    if (body.z <= 0) {
        body.z = 0;
        if (body.vz < 0.0) {
            if (body.type_ === ActorType.Player) {
                body.vz = 0.0;
            } else {
                body.vz = (-body.vz) >>> 2;
            }
        }
    }
}

function collideBounds(body: Actor): number {
    let has = 0;
    if (body.y >= boundsSize - objectRadiusUnit / 2) {
        body.y = boundsSize - objectRadiusUnit / 2;
        has = 1;
        if (body.vy > 0) {
            body.vy = -body.vy / 2;
        }
    } else if (body.y <= objectRadiusUnit / 2) {
        body.y = objectRadiusUnit / 2;
        has = 1;
        if (body.vy < 0) {
            body.vy = -body.vy / 2;
        }
    }
    if (body.x >= boundsSize - objectRadiusUnit) {
        body.x = boundsSize - objectRadiusUnit;
        has = 1;
        if (body.vx > 0) {
            body.vx = -body.vx / 2;
        }
    } else if (body.x <= objectRadiusUnit) {
        body.x = objectRadiusUnit;
        has = 1;
        if (body.vx < 0) {
            body.vx = -body.vx / 2;
        }
    }
    return has;
}

function updatePlayer(player: Actor, dt: number) {
    if (player.btn_ === undefined) {
        player.btn_ = 0;
    }

    let grounded = player.z === 0 && player.vz === 0;

    if (player.btn_ & ControlsFlag.Jump) {
        if (grounded) {
            player.z = 1;
            player.vz = jumpVel;
            grounded = false;
            play(snd_blip, false, 0.2 + 0.8 * random());
        }
    }
    let c = grounded ? 16 : 8;
    if (player.btn_ & ControlsFlag.Move) {
        const dir = unpackAngleByte(player.btn_ & 0xFF, Const.AnglesRes);
        const speed = (player.btn_ & ControlsFlag.Run) ? 2 : 1;
        const vel = speed * 60;
        player.vx = reach(player.vx, vel * Math.cos(dir), vel * dt * c);
        player.vy = reach(player.vy, vel * Math.sin(dir), vel * dt * c);
    } else {
        player.vx = reach(player.vx, 0, 100 * dt * c);
        player.vy = reach(player.vy, 0, 100 * dt * c);
    }

    if (player.btn_ & ControlsFlag.Drop) {
        if (player.weapon_ > 0) {
            const angle = unpackAngleByte((player.btn_ >>> 16) & 0xFF, Const.ViewAngleRes);
            const dx = Math.cos(angle);
            const dy = Math.sin(angle);
            state.items_.push({
                type_: ActorType.Item,
                x: player.x + objectRadiusUnit * dx,
                y: player.y + objectRadiusUnit * dy,
                z: player.z + PlayerHandsZ,
                vx: 128 * Math.cos(angle),
                vy: 128 * Math.sin(angle),
                vz: 0,
                c: 0,
                // set weapon item
                btn_: 1,
                t: player.weapon_,
            });
            player.weapon_ = 0;
        }
    }

    const weapon = getWeapon(player);
    let cooldownSpeed = (player.btn_ & ControlsFlag.Shooting) ? 1 : 2;
    player.t = reach(player.t, 0, cooldownSpeed * weapon.rate_ * dt);
    if (player.btn_ & ControlsFlag.Shooting) {
        if (!player.t) {
            cameraShake = Math.max(weapon.cameraShake_, cameraShake);
            const angle = unpackAngleByte((player.btn_ >>> 16) & 0xFF, Const.ViewAngleRes)
                + Math.min(1, player.t2) * (0.5 - random()) * weapon.angleSpread_;
            let x0 = player.x;
            let y0 = player.y;
            const dx = Math.cos(angle);
            const dy = Math.sin(angle);
            player.t = 1;
            player.t2 = reach(player.t2, 1, dt * weapon.detuneSpeed_);
            player.vx -= weapon.kickBack_ * dx;
            player.vy -= weapon.kickBack_ * dy;
            player.vz += weapon.jumpBack_;
            // most fast moving object: (r * 2) * 60 = 960
            //const maxSpeed = objectRadiusUnit * 2 * Const.NetFq;
            play(snd_shoot, false, 0.1 + 0.1 * random());
            const bulletVelocity = weapon.velocity_;
            state.bullets_.push({
                type_: ActorType.Bullet,
                c: player.c,
                x: x0 + weapon.offset_ * dx,
                y: y0 + weapon.offset_ * dy,
                z: player.z + PlayerHandsZ + weapon.offsetZ_,
                vx: bulletVelocity * dx,
                vy: bulletVelocity * dy,
                vz: 0,
                btn_: weapon.bulletType_,
                t: weapon.bulletLifeTime_,
            });
        }
    } else {
        player.t2 = reach(player.t2, 0, dt * 16);
    }
}

function getCommandsForTic(tic: number): ClientEvent[] {
    return localEvents.filter(v => v.t === tic)
        .concat(receivedEvents.filter(v => v.t === tic));
}

function beginPrediction() {
    state.seed_ = getSeed();
    lastState = state;
    simulatedFrames = 0;
    if (!Const.Prediction) return;
    state = JSON.parse(JSON.stringify(state));
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
    state = lastState;
    seed(state.seed_);
}

function drawShadows() {
    for (const actor of drawList) {
        let shadowScale = (2 - actor.z / 64.0);
        if (actor.type_ === ActorType.Bullet) {
            shadowScale *= 2;
            draw(img_cirle, actor.x, actor.y, 0, shadowScale, shadowScale / 4, 0x11FFFFFF, 0xFF000000);
        } else {
            draw(img_cirle, actor.x, actor.y, 0, shadowScale, shadowScale / 4, 0x77000000);
        }
    }
}

const drawList: Actor[] = [];

function collectVisibleActors(...lists: Actor[][]) {
    drawList.length = 0;
    const pad = objectRadiusUnit * 2;
    const W = gl.drawingBufferWidth;
    const H = gl.drawingBufferHeight;
    const l = (0 - W * camera.toX) / camera.scale + camera.atX - pad;
    const t = (0 - H * camera.toY) / camera.scale + camera.atY - pad - 128;
    const r = (W - W * camera.toX) / camera.scale + camera.atX + pad;
    const b = (H - H * camera.toY) / camera.scale + camera.atY + pad + 128;
    for (const list of lists) {
        for (const a of list) {
            if (a.x > l && a.x < r && a.y > t && a.y < b) {
                drawList.push(a);
            }
        }
    }
}

function drawMapBackground() {
    if (imgMap) {
        draw(imgMap, 0, 0, 0, 1, 1, 0xFFFFFFFF);
    }
    img_box.x = img_box.y = 0;
    draw(img_box, 0, -objectRadiusUnit * 5, 0, boundsSize + 2, objectRadiusUnit * 4, 0xFF666666);
    draw(img_box, 0, -objectRadiusUnit * 3, 0, boundsSize + 2, objectRadiusUnit * 4, 0x77000000);
    img_box.x = img_box.y = 0.5;
}

function drawMapOverlay() {
    img_box.x = img_box.y = 0;
    draw(img_box, 0, boundsSize - objectRadiusUnit * 2, 0, boundsSize + 2, objectRadiusUnit * 4, 0xFF666666);
    draw(img_box, -objectRadiusUnit * 2, -objectRadiusUnit * 2, 0, objectRadiusUnit * 2, boundsSize + objectRadiusUnit * 4, 0xFF666666);
    draw(img_box, boundsSize, -objectRadiusUnit * 2, 0, objectRadiusUnit * 2, boundsSize + objectRadiusUnit * 4, 0xFF666666);

    img_box.x = img_box.y = 0.5;
}

function drawCrosshair() {
    const p0 = getMyPlayer();
    if (p0 && (viewX || viewY)) {
        img_box.y = 2;
        const len = 4 + 0.25 * Math.sin(2 * lastFrameTs) * Math.cos(4 * lastFrameTs) + 4 * Math.min(1, p0.t2) + 4 * Math.min(1, p0.t);
        draw(img_box, lookAtX, lookAtY, 0.1 * lastFrameTs + Math.PI * 0.0, 2, len, 0x77FFFFFF);
        draw(img_box, lookAtX, lookAtY, 0.1 * lastFrameTs + Math.PI * 0.5, 2, len, 0x77FFFFFF);
        draw(img_box, lookAtX, lookAtY, 0.1 * lastFrameTs + Math.PI * 1.0, 2, len, 0x77FFFFFF);
        draw(img_box, lookAtX, lookAtY, 0.1 * lastFrameTs + Math.PI * 1.5, 2, len, 0x77FFFFFF);
        img_box.y = 0.5;
    }
}

function drawItem(item: Actor) {
    if (item.btn_ === ItemCategory.Weapon) {
        const weapon = weapons[item.t];
        const img = img_weapons[weapon.gfx_];
        const px = img.x;
        const py = img.y;
        img.x = 0.5;
        img.y = 0.7;
        draw(img_weapons[weapon.gfx_], item.x, item.y - item.z, 0, 0.8, 0.8, 0xFFFFFFFF);
        img.x = px;
        img.y = py;
    } else if (item.btn_ === ItemCategory.Effect) {
        const s = 1 + 0.1 * Math.sin(16 * lastFrameTs);
        const o = 2 * Math.cos(lastFrameTs);
        draw(img_items[item.t], item.x, item.y - item.z - objectRadiusUnit - o, 0, s, s, 0xFFFFFFFF);
    }
}

function drawObjects() {
    collectVisibleActors(trees, state.players_, state.barrels_, state.bullets_, state.items_);
    sortList(drawList);

    drawShadows();

    for (const actor of drawList) {
        const type = actor.type_;
        if (type === ActorType.Player) {
            drawPlayer(actor);
        } else if (type === ActorType.Barrel) {
            drawBarrel(actor);
        } else if (type === ActorType.Tree) {
            drawTree(actor);
        } else if (type === ActorType.Bullet) {
            const a = Math.atan2(actor.vy, actor.vx);
            if (actor.btn_ === 2) {
                img_cirle.x = 0.6;
                draw(img_cirle, actor.x, actor.y - actor.z, a, 3, 1.5, 0x11FFFFFF, 0xFF000000);
                img_cirle.x = 0.7;
                draw(img_cirle, actor.x, actor.y - actor.z, a, 1.5, 0.6, 0xFFFFFF44, 0x00000000);
                draw(img_box, actor.x, actor.y - actor.z, a, 4, 2, 0xFFFFFFFF);
                img_cirle.x = 0.5;
            } else if (actor.btn_ === 1) {
                draw(img_box, actor.x, actor.y - actor.z, a, 8, 4, 0x22FFFFFF, 0xFF000000);
                draw(img_box, actor.x, actor.y - actor.z, a, 4, 2, 0x22FFFFFF, 0xFF000000);
            }
        } else if (type === ActorType.Item) {
            drawItem(actor);
        }
    }
}

function drawPlayer(p: Actor) {
    const x = p.x;
    const y = p.y - p.z;
    const speed = Math.hypot(p.vx, p.vy, p.vz);
    const walk = Math.min(1, speed / 100);
    let base = -0.5 * walk * 0.5 * (1.0 + Math.sin(40 * lastFrameTs));
    const idle_base = (1 - walk) * 0.5 * (Math.pow(1 + Math.sin(15 * lastFrameTs), 2) / 4);
    base += idle_base;
    const leg1 = 5 - 4 * walk * 0.5 * (1.0 + Math.sin(40 * lastFrameTs));
    const leg2 = 5 - 4 * walk * 0.5 * (1.0 + Math.sin(40 * lastFrameTs + Math.PI));
    const sw1 = walk * Math.sin(20 * lastFrameTs);
    const sw2 = walk * Math.cos(20 * lastFrameTs);

    /////

    const wpn = getWeapon(p);
    let viewAngle = unpackAngleByte((p.btn_ >>> 16) & 0xFF, Const.ViewAngleRes);
    // const weaponBaseAngle = -Math.PI / 4;
    // const weaponBaseScaleX = 0.5;// -1 for gun
    // const weaponBaseScaleY = 0.5;// -1 for gun

    const weaponBaseAngle = wpn.gfxRot_;
    const weaponBaseScaleX = wpn.gfxSx_;
    const weaponBaseScaleY = 1;

    // const weaponBaseAngle = Math.PI - Math.PI / 4;
    // const weaponBaseScaleX = 1;// -1 for gun
    // const weaponBaseScaleY = 1;// -1 for gun
    let weaponX = x;
    let weaponY = y - PlayerHandsZ;
    let weaponAngle = Math.atan2(
        y + 1000 * Math.sin(viewAngle) - weaponY,
        x + 1000 * Math.cos(viewAngle) - weaponX
    );
    let weaponSX = weaponBaseScaleX;
    let weaponSY = weaponBaseScaleY;
    let weaponBack = 0;
    if (weaponAngle < -0.2 && weaponAngle > -Math.PI + 0.2) {
        weaponBack = 1;
        //weaponY -= 16 * 4;
    }
    const A = Math.sin(weaponAngle - Math.PI);
    let wd = 6 + 12 * (weaponBack ? (A * A) : 0);
    if (wpn.bulletType_ === 1) {
        const t = Math.max(0, (p.t - 0.8) * 5);
        wd += t * 12;
        weaponAngle -= Math.PI * 0.25 * Math.sin(t * t * Math.PI * 2);
    }
    weaponX += wd * Math.cos(weaponAngle);
    weaponY += wd * Math.sin(weaponAngle);

    if (weaponAngle < -Math.PI * 0.5 || weaponAngle > Math.PI * 0.5) {
        weaponSX *= -1;
        weaponAngle -= Math.PI + 2 * weaponBaseAngle;
    }

    weaponAngle += weaponBaseAngle;

    if (weaponBack && wpn.gfx_ >= 0) {
        draw(img_weapons[wpn.gfx_], weaponX, weaponY, weaponAngle, weaponSX, weaponSY, 0xFFFFFFFF);
    }

    img_box.x = 0.5;
    img_box.y = 0;
    draw(img_box, x - 3, y + 4 - 8 - 1, 0, 2, leg1, 0xFF888888);
    draw(img_box, x + 3, y + 4 - 8 - 1, 0, 2, leg2, 0xFF888888);
    img_box.x = 0.5;
    img_box.y = 0.5;
    draw(img_box, x, y - 6 - 1 + base, 0, 8, 6, 0xFF444444);

    {
        const s = p.vz * 0.002;
        const a = 0.002 * p.vx;
        draw(img_players[(p.c +debugCheckAvatar)% img_players.length], x, y - 14 + base * 2, a, 1 - s, 1 + s, 0xFFFFFFFF);
    }


    // DRAW HANDS
    img_box.x = 0;
    img_box.y = 0.5;
    const rArmX = x + 4;
    const lArmX = x - 4;
    const armY = (y - PlayerHandsZ + base * 2);
    const rArmRot = Math.atan2(weaponY - armY, weaponX - rArmX);
    const lArmRot = Math.atan2(weaponY - armY, weaponX - lArmX);
    const lArmLen = Math.hypot(weaponX - lArmX, weaponY - armY) - 1;
    const rArmLen = Math.hypot(weaponX - rArmX, weaponY - armY) - 1;

    if (wpn.gfx_ >= 0) {
        draw(img_box, x + 4, y - 4 - 5 - 1 + base, rArmRot, rArmLen, 2, 0xFF888888);
        draw(img_box, x - 4, y - 4 - 5 - 1 + base, lArmRot, lArmLen, 2, 0xFF888888);
    } else {
        draw(img_box, x + 4, y - 4 - 5 - 1 + base, sw1 + Math.PI / 4, 5, 2, 0xFF888888);
        draw(img_box, x - 4, y - 4 - 5 - 1 + base, sw2 + Math.PI - Math.PI / 4, 5, 2, 0xFF888888);
    }

    img_box.x = 0.5;
    img_box.y = 0.5;

    if (!weaponBack && wpn.gfx_ >= 0) {
        draw(img_weapons[wpn.gfx_], weaponX, weaponY, weaponAngle, weaponSX, weaponSY, 0xFFFFFFFF);
    }
}

function drawBarrel(p: Actor) {
    const x = p.x;
    const y = p.y - p.z;

    draw(img_barrels[p.c], x, y, 0, 1, 1, 0xFFFFFFFF);
}

function drawTree(p: Actor) {
    const x = p.x;
    const y = p.y - p.z;

    draw(img_trees[p.c], x, y, 0, 1, 1, 0xFFFFFFFF);
}

function unpackAngleByte(angleByte: number, resolution: number) {
    return 2 * Math.PI * angleByte / resolution - Math.PI;
}

function packAngleByte(y: number, x: number, resolution: number) {
    return (resolution * (Math.PI + Math.atan2(y, x)) / (2 * Math.PI)) | 0
}