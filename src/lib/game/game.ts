import {ClientID} from "../../shared/types";
import {getClientId, getUserName, remoteClients} from "../net/messaging";
import {GL, gl} from "../graphics/gl";
import {play} from "../audio/context";
import {termPrint} from "../utils/log";
import {beginRender, camera, draw, flush, Texture} from "../graphics/draw2d";
import {getSeed, nextFloat, rand, random, seed} from "../utils/rnd";
import {channels_sendObjectData, getChannelPacketSize} from "../net/channels_send";
import {img, Img} from "../assets/gfx";
import {Const} from "./config";
import {generateMapBackground, mapTexture} from "../assets/map";
import {Actor, ActorType, Client, ClientEvent, EffectItemType, InitData, ItemCategory, Packet} from "./types";
import {pack, unpack} from "./packets";
import {reach, toRad} from "../utils/math";
import {
    ControlsFlag,
    drawVirtualPad,
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
import {isAnyKeyDown, keyboardDown} from "../utils/input";
import {Snd, snd} from "../assets/sfx";

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
let waitToSpawn = false;

let lastFrameTs = 0;
let lastInputTic = 0;
let lastInputCmd = 0;

// static state
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

const hitAnimMax = 15;

let cameraShake = 0;
let cameraFeedback = 0;

const objectRadiusUnit = 8;
const bulletRadiusUnit = 4;
// Player = 0,
//     Barrel = 1,
//     Bullet = 2,
//     Item = 3,
//     // static game objects
//     Tree = 4,
const objectRadiusByType = [
    objectRadiusUnit,
    objectRadiusUnit,
    bulletRadiusUnit,
    objectRadiusUnit,
    objectRadiusUnit + objectRadiusUnit / 2,
];

const objectHeightByType = [
    objectRadiusUnit + objectRadiusUnit / 2,
    objectRadiusUnit,
    0,
    0,
    objectRadiusUnit * 2,
];

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
    gfxRot_: number;
    gfxSx_: number;
    bulletType_: number;
    bulletLifeTime_: number;
}

function newWeapon(): WeaponConfig {
    return {
        rate_: 1,
        angleSpread_: 0,
        kickBack_: 0,
        jumpBack_: 0,
        offset_: 0,
        offsetZ_: 0,
        velocity_: 0,
        cameraShake_: 0,
        detuneSpeed_: 0,
        cameraFeedback_: 0,
        cameraLookForward_: 0,
        gfxRot_: 0,
        gfxSx_: 1,
        bulletType_: 0,
        bulletLifeTime_: 0,
    };
}

function createArmWeapon(): WeaponConfig {
    const w = newWeapon();
    w.angleSpread_ = 0.5;
    w.kickBack_ = 40;
    w.jumpBack_ = 8;
    w.offset_ = 0;
    w.offsetZ_ = 0;
    w.velocity_ = 500;
    w.detuneSpeed_ = 16;
    w.cameraFeedback_ = 0.02;
    w.cameraLookForward_ = 0.1;
    w.bulletType_ = 1;
    w.bulletLifeTime_ = 0.02;
    return w;
}

function createGunWeapon(): WeaponConfig {
    const w = newWeapon();
    w.kickBack_ = 32;
    w.jumpBack_ = 8;
    w.offset_ = 16;
    w.velocity_ = 600;
    w.detuneSpeed_ = 16;
    w.cameraFeedback_ = 0.02;
    w.cameraLookForward_ = 0.2;
    w.bulletType_ = 2;
    return w;
}

const weapons: WeaponConfig[] = [
    // HANDS FREE
    createArmWeapon(),
    // MELEE
    createArmWeapon(),
    createArmWeapon(),
    createArmWeapon(),
    // PISTOL
    createGunWeapon(),
    createGunWeapon(),
    createGunWeapon(),
    createGunWeapon(),
    createGunWeapon(),
];

weapons[0].rate_ = 2;

// 🔪
weapons[1].gfxRot_ = toRad(-45);
weapons[1].rate_ = 4;
// 🔨
//weapons[2].gfxRot_ = toRad(-45);

// AXE
weapons[2].gfxRot_ = toRad(-45);
// 🗡
weapons[3].gfxRot_ = toRad(-45);

// 🔫
weapons[4].angleSpread_ = 0.1;
weapons[4].velocity_ /= 2;
weapons[4].detuneSpeed_ = 16;
weapons[4].cameraFeedback_ = 0.1;

// 🖊 light auto gun
weapons[5].rate_ = 12;
weapons[5].angleSpread_ = 0.25;
weapons[5].kickBack_ = 20;
weapons[5].jumpBack_ = 4;
weapons[5].offset_ = 20;
weapons[5].detuneSpeed_ = 16;
weapons[5].cameraFeedback_ = 0.01;

// ✏️ hard machine-gun?
weapons[6].rate_ = 8;
weapons[6].angleSpread_ = 0.25;
weapons[6].kickBack_ = 20;
weapons[6].jumpBack_ = 4;
weapons[6].velocity_ /= 2;
weapons[6].detuneSpeed_ = 16;
weapons[6].cameraFeedback_ = 0.05;
weapons[6].cameraLookForward_ = 0.3;

// 🪥 SHOT GUN
weapons[7].angleSpread_ = 0.5;
weapons[7].detuneSpeed_ = 32;
weapons[7].cameraFeedback_ = 0.1;

// CROSS BOW ⛏
weapons[8].detuneSpeed_ = 32;
weapons[8].cameraFeedback_ = 0.1;
weapons[8].cameraLookForward_ = 0.3;

function pickRandomWeaponId() {
    const min = 1;
    return min + rand(weapons.length - min);
}

function getWeapon(player: Actor): WeaponConfig {
    return weapons[player.weapon_];
}

function setRandomPosition(actor: Actor): Actor {
    actor.x = objectRadiusUnit + rand(boundsSize - objectRadiusUnit * 2);
    actor.y = objectRadiusUnit + rand(boundsSize - objectRadiusUnit * 2);
    return actor;
}

function newActorObject(type: ActorType): Actor {
    return {
        type_: type,
        x: 0,
        y: 0,
        z: 0,

        u: 0,
        v: 0,
        w: 0,

        btn_: 0,
        c: 0,

        s: 0,
        t: 0,

        weapon_: 0,
        anim0_: rand(0x100),
        animHit_: 0,
        hp_: 0,
    };
}

function newItemRandomWeapon(): Actor {
    const item = newActorObject(ActorType.Item);
    item.btn_ = 1;
    item.s = pickRandomWeaponId();
    state.items_.push(item);
    return item;
}

function newItemRandomEffect(): Actor {
    const item = newActorObject(ActorType.Item);
    item.btn_ = 2;
    item.s = rand(2);
    state.items_.push(item);
    return item;
}

function requireClient(id: ClientID): Client {
    if (!clients[id]) {
        clients[id] = {c: id, t: 0, acknowledgedTic_: 0};
    }
    return clients[id];
}

export function initTestGame() {
    console.log("init game");
    // document.addEventListener("visibilitychange", () => {
    //     const active = !document.hidden;
    //     if (clientActive !== active) {
    //         clientActive = active;
    //     }
    // });
}

function recreateMap() {
    // generate map
    seed(state.mapSeed_);
    generateMapBackground();
    trees = [];
    for (let i = 0; i < 32; ++i) {
        const tree = newActorObject(ActorType.Tree);
        tree.c = rand(2);
        trees.push(
            setRandomPosition(tree)
        );
    }
}

function createSeedGameState() {
    startTick = 0;
    gameTic = 0;
    netTick = 0;
    startTime = prevTime = lastFrameTs;
    state.mapSeed_ = getSeed();
    recreateMap();
    state.seed_ = getSeed();

    for (let i = 0; i < 32; ++i) {
        const actor = newActorObject(ActorType.Barrel);
        actor.hp_ = 3 + rand(4);
        actor.c = rand(2);
        state.barrels_.push(
            setRandomPosition(actor)
        );
    }

    for (let i = 0; i < 32; ++i) {
        setRandomPosition(newItemRandomWeapon());
    }
    for (let i = 0; i < 32; ++i) {
        setRandomPosition(newItemRandomEffect());
    }
}

export function updateTestGame(ts: number) {
    if (ts > lastFrameTs) {
        lastFrameTs = ts;
    }

    if (startTick < 0 && !remoteClients.size) {
        createSeedGameState();
    }

    if (startTick >= 0 && !document.hidden) {
        tryRunTicks(lastFrameTs);
        beginPrediction();
        {
            drawGame();
            // check input before overlay, or save camera settings
            checkPlayerInput();
            checkJoinSync(gameTic - 1);
            drawOverlay();
        }
        endPrediction();
        trySendInput();
        cleaningUpClients();
    }
    printStatus();
    if (process.env.NODE_ENV === "development") {
        printDebugInfo();
    }
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

function printStatus() {
    if (joined) {
        const p0 = getMyPlayer();
        if (p0) {
            let str = "";
            for (let i = 0; i < 10;) {
                const half = p0.hp_ > i++;
                const full = p0.hp_ > i++;
                str += full ? "❤️" : (half ? "💔" : "🖤");
            }
            termPrint(str + "\n");
        } else {
            termPrint("Tap to spawn!\n");
        }
    } else {
        termPrint("Joining room...\n");
    }
}

function printDebugInfo() {
    let text = "🌐";
    if (prevRenderTic === gameTic) text = "🥶";
    const fr = simulatedFrames - (simulatedFrames | 0);
    if (fr > 0) text = "✨";
    if ((simulatedFrames | 0) > 0) text = "🔮";
    prevRenderTic = gameTic;
    text += ` b:${(((lastFrameTs - prevTime) * Const.NetFq) | 0)}`;
    text += " r:" + (simulatedFrames | 0) + (fr > 0 ? "." : "") + "\n";
    text += "d " + (lastFrameTs - prevTime).toFixed(2) + "\n";
    text += "~ " + (gameTic / Const.NetFq).toFixed(2) + "\n";
    text += "visible: " + drawList.length + "\n";

    text += `┌ ${getUserName()} | game: ${gameTic}, net: ${netTick}\n`;
    for (const [, remoteClient] of remoteClients) {
        const pc = remoteClient.pc_;
        const dc = remoteClient.dc_;
        const cl = clients[remoteClient.id_];
        text += "├ " + remoteClient.name_ + remoteClient.id_;
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
    if (process.env.NODE_ENV === "development") {
        if (keyboardDown.has("Digit1")) {
            ++debugCheckAvatar;
        }
        if (keyboardDown.has("Digit2")) {
            drawCollisionEnabled = !drawCollisionEnabled;
        }
    }

    const player = getMyPlayer();
    if (player) {
        updateControls(player);
    }

    const inputTic = getNextInputTic();
    if (lastInputTic >= inputTic) {
        return;
    }
    lastInputTic = inputTic;
    // localEvents = localEvents.filter((x) => x.t < inputTic || x.spawn);

    let btn = 0;
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
    }

    if (lastInputCmd !== btn) {
        getLocalEvent(inputTic).btn_ = btn;
        lastInputCmd = btn;
    }

    if (!waitToSpawn && !player && joined) {
        if (isAnyKeyDown()) {
            respawnPlayer();
        }
    }
}

let debugCheckAvatar = 0;

function checkJoinSync(lastTic: number) {
    if (!joined && startTick >= 0) {
        for (const [, rc] of remoteClients) {
            if (rc.dc_ && rc.dc_.readyState === "open") {
                const cl = clients[rc.id_];
                if (!cl || !cl.ready_) {
                    console.log("syncing...");
                    return;
                }
            } else {
                console.log("still connecting...");
                return;
            }
        }
        joined = true;
        console.log("All in sync");
        respawnPlayer();
    }
}

function respawnPlayer() {
    const ticToSpawn = getNextInputTic();
    getLocalEvent(ticToSpawn).spawn_ = {
        // TODO: spawn with INPUT
        x: (50 + Math.random() * (boundsSize - 100)) | 0,
        y: (50 + Math.random() * (boundsSize - 100)) | 0,
        z: (32 + 32 * Math.random()) | 0,
    };
    waitToSpawn = true;
}

function calcNetTick() {
    netTick = gameTic + ((lastFrameTs - prevTime) * Const.NetFq) | 0;
    ackMin = netTick;
    for (const [, client] of remoteClients) {
        const cl = clients[client.id_];
        if (cl) {
            if (netTick > cl.t) {
                netTick = cl.t;
            }
            if (ackMin > cl.acknowledgedTic_) {
                ackMin = cl.acknowledgedTic_;
            }
        }
    }
}

function tryRunTicks(ts: number): number {
    calcNetTick();
    const framesPassed = ((ts - prevTime) * Const.NetFq) | 0;
    let frameN = framesPassed;
    let framesProcessed = 0;
    while (gameTic <= netTick && frameN > 0) {
        processTicCommands(getCommandsForTic(gameTic));
        simulateTic(1 / Const.NetFq);
        ++gameTic;
        --frameN;
        ++framesProcessed;
    }
    // compensate
    // we must try to keep netTic >= gameTic + Const.InputDelay
    prevTime += framesProcessed / Const.NetFq;

    // we played all available net-events
    const k = 0.01;
    const allowFramesToPredict = Const.InputDelay;
    if (gameTic > netTick) {
        // slow down a bit in case if we predict a lot
        if (ts - prevTime > allowFramesToPredict / Const.NetFq) {
            prevTime = (1 - k) * prevTime + k * (ts - allowFramesToPredict / Const.NetFq);
        }
    } else {
        // we got packets to go
        if (gameTic + Const.InputDelay < netTick) {
            // speed up
            // console.info("speed up");
            // prevTime -= Const.NetDt * dropRate;
            prevTime = (1 - k) * prevTime + k * (ts - allowFramesToPredict / Const.NetFq);

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
    for (const [, client] of remoteClients) {
        if (client.dc_ && client.dc_.readyState === "open") {
            const cl = clients[client.id_];

            if (cl) {
                const packet: Packet = {
                    check_seed_: getSeed(),
                    check_tic_: lastTic,
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
                    check_seed_: getSeed(),
                    check_tic_: lastTic,

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
        if (process.env.NODE_ENV === "development") {
            if (data.check_tic_ === (gameTic - 1)) {
                if (data.check_seed_ !== getSeed()) {
                    console.warn("seed mismatch from client " + data.c + " at tic " + data.check_tic_);
                    console.warn(data.check_seed_ + " != " + getSeed());
                }
            }
        }

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

export function onRTCPacket(from: ClientID, buffer: ArrayBuffer) {
    const data = unpack(buffer);
    if (data) {
        processPacket(requireClient(from), data);
    } else {
        console.warn("income packet data size mismatch");
    }
    // if (!clientActive) {
    lastFrameTs = performance.now() / 1000;
    if (tryRunTicks(lastFrameTs)) {
        trySendInput();
        cleaningUpClients();
    }
    // }
}

function cleaningUpClients() {
    for (const cl of clients) {
        if (cl) {
            const rc = remoteClients.get(cl.c);
            if (rc && rc.dc_.readyState === "open") {
                // alive
                continue;
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
            const player = newActorObject(ActorType.Player);
            player.c = source;
            player.x = cmd.spawn_.x;
            player.y = cmd.spawn_.y;
            player.z = cmd.spawn_.z;
            player.hp_ = 10;
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
            player.weapon_ = item.s;
            play(snd[Snd.pick], false, 0.5);
            item.btn_ = 0;
        }
    }
    if (item.btn_ & 2) {
        if (item.s === EffectItemType.Med) {
            play(snd[Snd.med], false, 0.5);
            item.btn_ = 0;
        } else if (item.s === EffectItemType.Health) {
            if (player.hp_ < 10) {
                ++player.hp_;
                play(snd[Snd.heal], false, 0.5);
                item.btn_ = 0;
            }
        }
    }
}

function updateAnim(actor: Actor, dt: number) {
    if (actor.animHit_ > 0) {
        actor.animHit_ = Math.max(0, actor.animHit_ - 2 * dt * Const.NetFq);
    }
}

function applyVelocityPlaneFriction(p: Actor, amount: number) {
    let v0 = Math.hypot(p.u, p.v);
    if (v0 > 0) {
        const v1 = reach(v0, 0, amount);
        const k = v1 / v0;
        p.u *= k;
        p.v *= k;
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
        updateAnim(player, dt);
    }
    for (const barrel of state.barrels_) {
        updateBody(barrel, dt, gravity);
        collideBounds(barrel);
        if (barrel.z <= 0) {
            applyVelocityPlaneFriction(barrel, 512 * dt);
        }
        updateAnim(barrel, dt);
    }
    for (const item of state.items_) {
        updateBody(item, dt, gravity);
        collideBounds(item);
        if (item.z <= 0) {
            applyVelocityPlaneFriction(item, 512 * dt);
        }
        if (!(item.animHit_ | 0)) {
            for (const player of state.players_) {
                if (testIntersection(item, player)) {
                    pickItem(item, player);
                }
            }
        }
        updateAnim(item, dt / 2);
    }
    for (const bullet of state.bullets_) {
        updateBody(bullet, dt, 0);
        if (collideBounds(bullet)) {
            bullet.btn_ = 0;
        }
        if (bullet.s > 0) {
            bullet.s -= dt;
            if (bullet.s <= 0) {
                bullet.btn_ = 0;
            }
        }
    }
    for (const tree of trees) {
        updateAnim(tree, dt);
    }
    state.bullets_ = state.bullets_.filter(x => x.btn_);
    state.items_ = state.items_.filter(x => x.btn_);
    updateBulletCollision(state.players_);
    updateBulletCollision(state.barrels_);
    updateBulletCollision(trees);
    state.barrels_ = state.barrels_.filter(x => x.hp_);
    state.players_ = state.players_.filter(x => x.hp_);
    updateBodyInterCollisions(state.players_);
    updateBodyInterCollisions(state.barrels_);
    updateBodyInterCollisions2(state.players_, state.barrels_);
    updateBodyInterCollisions2(state.players_, trees);
    updateBodyInterCollisions2(state.barrels_, trees);

    if (waitToSpawn && getMyPlayer()) {
        waitToSpawn = false;
    }
    cameraShake = reach(cameraShake, 0, dt);
    cameraFeedback = reach(cameraFeedback, 0, 12 * dt);
}

function updateBodyInterCollisions2(list1: Actor[], list2: Actor[]) {
    for (let i = 0; i < list1.length; ++i) {
        const a = list1[i];
        const ra = objectRadiusByType[a.type_];
        const ha = objectHeightByType[a.type_];
        for (let j = 0; j < list2.length; ++j) {
            const b = list2[j];
            const rb = objectRadiusByType[b.type_];
            const hb = objectHeightByType[b.type_];
            let nx = a.x - b.x;
            let ny = (a.y - b.y) * 2;
            let nz = (a.z + ha) - (b.z + hb);
            const dist = Math.sqrt(nx * nx + ny * ny + nz * nz);
            const D = ra + rb;
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
        const ra = objectRadiusByType[a.type_];
        const ha = objectHeightByType[a.type_];
        for (let j = i + 1; j < max; ++j) {
            const b = list[j];
            const rb = objectRadiusByType[b.type_];
            const hb = objectHeightByType[b.type_];
            let nx = a.x - b.x;
            let ny = (a.y - b.y) * 2;
            let nz = (a.z + ha) - (b.z + hb);
            const dist = Math.sqrt(nx * nx + ny * ny + nz * nz);
            const D = ra + rb;
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

function testIntersection(a: Actor, b: Actor): boolean {
    const ra = objectRadiusByType[a.type_];
    const rb = objectRadiusByType[b.type_];
    const ha = objectHeightByType[a.type_];
    const hb = objectHeightByType[b.type_];
    let nx = a.x - b.x;
    let ny = a.y - b.y;
    let nz = (a.z + ha) - (b.z + hb);
    const D = ra + rb;
    return nx * nx + ny * ny + nz * nz < D * D;
}

function kill(actor: Actor) {
    if (actor.type_ === ActorType.Barrel) {
        const amount = 1 + rand(3);
        for (let i = 0; i < amount; ++i) {
            const a = random(Math.PI * 2);
            const v = 32 + rand(64);
            const item = newItemRandomEffect();
            item.x = actor.x;
            item.y = actor.y;
            item.z = actor.z + objectHeightByType[actor.type_];
            item.u = v * Math.cos(a);
            item.v = v * Math.sin(a);
            item.w = v;
            item.animHit_ = hitAnimMax;
        }
    }
    if (actor.type_ === ActorType.Player) {
        if (actor.weapon_ > 0) {
            const a = random(Math.PI * 2);
            const v = 32 + rand(64);
            const item = newItemRandomWeapon();
            item.x = actor.x;
            item.y = actor.y;
            item.z = actor.z + objectHeightByType[actor.type_];
            item.u = actor.u + v * Math.cos(a);
            item.v = actor.v + v * Math.sin(a);
            item.w = actor.w + v;
            item.s = actor.weapon_;
            item.animHit_ = hitAnimMax;
        }
        const grave: Actor = newActorObject(ActorType.Barrel);
        grave.x = actor.x;
        grave.y = actor.y;
        grave.z = actor.z + objectHeightByType[actor.type_];
        grave.u = actor.u;
        grave.v = actor.v;
        grave.w = actor.w + 32;
        grave.hp_ = 20;
        grave.c = 2;
        state.barrels_.push(grave);
    }
}

function hitWithBullet(actor: Actor, bullet: Actor) {
    actor.u += 0.1 * bullet.u;
    actor.v += 0.1 * bullet.v;
    actor.animHit_ = hitAnimMax;
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
            if (!owned && testIntersection(a, b)) {
                hitWithBullet(a, b);
            }
        }
    }
}

function updateBody(body: Actor, dt: number, g: number) {
    body.x += body.u * dt;
    body.y += body.v * dt;
    body.z += body.w * dt;
    body.w -= g * dt;

    if (body.z <= 0) {
        body.z = 0;
        if (body.w < 0.0) {
            if (body.type_ === ActorType.Player) {
                body.w = 0.0;
            } else {
                body.w = (-body.w) >>> 2;
            }
        }
    }
}

function collideBounds(body: Actor): number {
    const R = objectRadiusByType[body.type_];
    let has = 0;
    if (body.y >= boundsSize - R) {
        body.y = boundsSize - R;
        has = 1;
        if (body.v > 0) {
            body.v = -body.v / 2;
        }
    } else if (body.y <= R) {
        body.y = R;
        has = 1;
        if (body.v < 0) {
            body.v = -body.v / 2;
        }
    }
    if (body.x >= boundsSize - R) {
        body.x = boundsSize - R;
        has = 1;
        if (body.u > 0) {
            body.u = -body.u / 2;
        }
    } else if (body.x <= R) {
        body.x = R;
        has = 1;
        if (body.u < 0) {
            body.u = -body.u / 2;
        }
    }
    return has;
}

function updatePlayer(player: Actor, dt: number) {
    if (player.btn_ === undefined) {
        player.btn_ = 0;
    }

    let grounded = player.z === 0 && player.w === 0;

    if (player.btn_ & ControlsFlag.Jump) {
        if (grounded) {
            player.z = 1;
            player.w = jumpVel;
            grounded = false;
            play(snd[Snd.blip], false, 0.2 + random(0.8));
        }
    }
    let c = grounded ? 16 : 8;
    if (player.btn_ & ControlsFlag.Move) {
        const dir = unpackAngleByte(player.btn_ & 0xFF, Const.AnglesRes);
        const speed = (player.btn_ & ControlsFlag.Run) ? 2 : 1;
        const vel = speed * 60;
        player.u = reach(player.u, vel * Math.cos(dir), vel * dt * c);
        player.v = reach(player.v, vel * Math.sin(dir), vel * dt * c);
    } else {
        applyVelocityPlaneFriction(player, 100 * dt * c);
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
                u: 64 * Math.cos(angle),
                v: 64 * Math.sin(angle),
                w: 0,
                c: 0,
                // set weapon item
                btn_: 1,
                s: player.weapon_,
                anim0_: rand(0x100),
                animHit_: hitAnimMax,
            });
            player.weapon_ = 0;
        }
    }

    const weapon = getWeapon(player);
    let cooldownSpeed = (player.btn_ & ControlsFlag.Shooting) ? 1 : 2;
    player.s = reach(player.s, 0, cooldownSpeed * weapon.rate_ * dt);
    if (player.btn_ & ControlsFlag.Shooting) {
        if (!player.s) {
            cameraShake = Math.max(weapon.cameraShake_, cameraShake);
            const angle = unpackAngleByte((player.btn_ >>> 16) & 0xFF, Const.ViewAngleRes)
                + Math.min(1, player.t) * (0.5 - nextFloat()) * weapon.angleSpread_;
            let x0 = player.x;
            let y0 = player.y;
            const dx = Math.cos(angle);
            const dy = Math.sin(angle);
            player.s = 1;
            cameraFeedback = 1;
            player.t = reach(player.t, 1, dt * weapon.detuneSpeed_);
            player.u -= weapon.kickBack_ * dx;
            player.v -= weapon.kickBack_ * dy;
            player.w += weapon.jumpBack_;
            // most fast moving object: (r * 2) * 60 = 960
            //const maxSpeed = objectRadiusUnit * 2 * Const.NetFq;
            play(snd[Snd.shoot], false, 0.1 + random(0.1));
            const bulletVelocity = weapon.velocity_;
            state.bullets_.push({
                type_: ActorType.Bullet,
                c: player.c,
                x: x0 + weapon.offset_ * dx,
                y: y0 + weapon.offset_ * dy,
                z: player.z + PlayerHandsZ + weapon.offsetZ_,
                u: bulletVelocity * dx,
                v: bulletVelocity * dy,
                w: 0,
                btn_: weapon.bulletType_,
                s: weapon.bulletLifeTime_,
            });
        }
    } else {
        player.t = reach(player.t, 0, dt * 16);
    }
}

function getCommandsForTic(tic: number): ClientEvent[] {
    const events = localEvents.filter(v => v.t === tic)
        .concat(receivedEvents.filter(v => v.t === tic));
    events.sort((a, b) => (a.c ?? getClientId()) - (b.c ?? getClientId()));
    return events;
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
        const dt = Math.min(time, 1 / Const.NetFq);
        processTicCommands(getCommandsForTic(tic));
        simulateTic(dt);
        time -= dt;
        simulatedFrames += dt * Const.NetFq;
        ++tic;
    }
}

function endPrediction() {
    state = lastState;
    seed(state.seed_);
}

/*** DRAWING ***/

function drawGame() {
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    camera.scale_ = Math.min(w, h) / 256;
    camera.toX_ = 0.5;
    camera.toY_ = 0.5;
    camera.atX_ = camera.atY_ = boundsSize >> 1;
    const p0 = getMyPlayer();
    if (p0) {
        const wpn = getWeapon(p0);
        camera.atX_ = p0.x + (wpn.cameraLookForward_ - wpn.cameraFeedback_ * cameraFeedback) * (lookAtX - p0.x);
        camera.atY_ = p0.y + (wpn.cameraLookForward_ - wpn.cameraFeedback_ * cameraFeedback) * (lookAtY - p0.y);
        //camera.scale -= Math.hypot(p0.vx, p0.vy) / 128;
    }
    camera.atX_ += ((Math.random() - 0.5) * cameraShake * 8) | 0;
    camera.atY_ += ((Math.random() - 0.5) * cameraShake * 8) | 0;
    beginRender(w, h);
    gl.clearColor(0.4, 0.4, 0.4, 1.0);
    gl.clear(GL.COLOR_BUFFER_BIT);
    drawMapBackground();
    drawObjects();

    if (process.env.NODE_ENV === "development") {
        if (drawCollisionEnabled) {
            drawCollisions();
        }
    }

    drawMapOverlay();
    drawCrosshair();
    flush();
}

function drawOverlay() {
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    camera.toX_ = camera.toY_ = camera.atX_ = camera.atY_ = 0.0;
    beginRender(w, h);
    drawVirtualPad();
    flush()
}

function drawShadows() {
    for (const actor of drawList) {
        let shadowScale = (2 - actor.z / 64.0);
        let additive = 0;
        let color = 0;
        if (actor.type_ === ActorType.Bullet) {
            shadowScale *= 2;
            additive = 1;
            color = 0x333333;
        }
        draw(img[Img.circle_4], actor.x, actor.y, 0, shadowScale, shadowScale / 4, .4, color, additive);
    }
}

const drawList: Actor[] = [];

function collectVisibleActors(...lists: Actor[][]) {
    drawList.length = 0;
    const pad = objectRadiusUnit * 2;
    const W = gl.drawingBufferWidth;
    const H = gl.drawingBufferHeight;
    const l = (0 - W * camera.toX_) / camera.scale_ + camera.atX_ - pad;
    const t = (0 - H * camera.toY_) / camera.scale_ + camera.atY_ - pad - 128;
    const r = (W - W * camera.toX_) / camera.scale_ + camera.atX_ + pad;
    const b = (H - H * camera.toY_) / camera.scale_ + camera.atY_ + pad + 128;
    for (const list of lists) {
        for (const a of list) {
            if (a.x > l && a.x < r && a.y > t && a.y < b) {
                drawList.push(a);
            }
        }
    }
}

function drawMapBackground() {
    draw(mapTexture, 0, 0, 0, 1, 1);
    draw(img[Img.box_lt], 0, -objectRadiusUnit * 5, 0, boundsSize + 2, objectRadiusUnit * 4, 1, 0x666666);
    draw(img[Img.box_lt], 0, -objectRadiusUnit * 3, 0, boundsSize + 2, objectRadiusUnit * 4, 0.5, 0);
}

function drawMapOverlay() {
    draw(img[Img.box_lt], 0, boundsSize - objectRadiusUnit * 2, 0, boundsSize + 2, objectRadiusUnit * 4, 1, 0x666666);
    draw(img[Img.box_lt], -objectRadiusUnit * 2, -objectRadiusUnit * 2, 0, objectRadiusUnit * 2, boundsSize + objectRadiusUnit * 4, 1, 0x666666);
    draw(img[Img.box_lt], boundsSize, -objectRadiusUnit * 2, 0, objectRadiusUnit * 2, boundsSize + objectRadiusUnit * 4, 1, 0x666666);
}

function drawCrosshair() {
    const p0 = getMyPlayer();
    if (p0 && (viewX || viewY)) {
        const len = 4 + 0.25 * Math.sin(2 * lastFrameTs) * Math.cos(4 * lastFrameTs) + 4 * Math.min(1, p0.t) + 4 * Math.min(1, p0.s);
        draw(img[Img.box_t2], lookAtX, lookAtY, 0.1 * lastFrameTs + Math.PI * 0.0, 2, len, 0.5);
        draw(img[Img.box_t2], lookAtX, lookAtY, 0.1 * lastFrameTs + Math.PI * 0.5, 2, len, 0.5);
        draw(img[Img.box_t2], lookAtX, lookAtY, 0.1 * lastFrameTs + Math.PI * 1.0, 2, len, 0.5);
        draw(img[Img.box_t2], lookAtX, lookAtY, 0.1 * lastFrameTs + Math.PI * 1.5, 2, len, 0.5);
    }
}

function drawItem(item: Actor) {
    const colorOffset = getHitColorOffset(item.animHit_);
    if (item.btn_ === ItemCategory.Weapon) {
        const weaponImage = item.s ? img[Img.weapon0 + item.s - 1] : undefined;
        if (weaponImage) {
            const px = weaponImage.x;
            const py = weaponImage.y;
            weaponImage.x = 0.5;
            weaponImage.y = 0.7;
            draw(weaponImage, item.x, item.y - item.z, 0, 0.8, 0.8, 1, 0xFFFFFF, 0, colorOffset);
            weaponImage.x = px;
            weaponImage.y = py;
        }
    } else if (item.btn_ === ItemCategory.Effect) {
        const anim = item.anim0_ / 0xFF;
        const s = 1 + 0.1 * Math.sin(16 * (lastFrameTs + anim * 10));
        const o = 2 * Math.cos(lastFrameTs + anim * 10);
        draw(img[Img.item0 + item.s], item.x, item.y - item.z - objectRadiusUnit - o, 0, s, s, 1, 0xFFFFFF, 0, colorOffset);
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
            const a = Math.atan2(actor.v, actor.u);
            if (actor.btn_ === 2) {
                img[Img.circle_4].x = 0.6;
                draw(img[Img.circle_4], actor.x, actor.y - actor.z, a, 3, 1.5, 0.07, 0xFFFFFF, 1);
                img[Img.circle_4].x = 0.7;
                draw(img[Img.circle_4], actor.x, actor.y - actor.z, a, 1.5, 0.6, 1, 0xFFFF44);
                draw(img[Img.box], actor.x, actor.y - actor.z, a, 4, 2);
                img[Img.circle_4].x = 0.5;
            } else if (actor.btn_ === 1) {
                draw(img[Img.box], actor.x, actor.y - actor.z, a, 8, 4, 0.13, 0xFFFFFF, 0);
                draw(img[Img.box], actor.x, actor.y - actor.z, a, 4, 2, 0.13, 0xFFFFFF, 0);
            }
        } else if (type === ActorType.Item) {
            drawItem(actor);
        }
    }
}

function drawPlayer(p: Actor) {
    const co = getHitColorOffset(p.animHit_);

    const x = p.x;
    const y = p.y - p.z;
    const speed = Math.hypot(p.u, p.v, p.w);
    const walk = Math.min(1, speed / 100);
    let base = -0.5 * walk * 0.5 * (1.0 + Math.sin(40 * lastFrameTs));
    const idle_base = (1 - walk) * 0.5 * ((1 + Math.sin(15 * lastFrameTs) ** 2) / 4);
    base += idle_base;
    const leg1 = 5 - 4 * walk * 0.5 * (1.0 + Math.sin(40 * lastFrameTs));
    const leg2 = 5 - 4 * walk * 0.5 * (1.0 + Math.sin(40 * lastFrameTs + Math.PI));
    const sw1 = walk * Math.sin(20 * lastFrameTs);
    const sw2 = walk * Math.cos(20 * lastFrameTs);

    /////

    const wpn = getWeapon(p);
    let viewAngle = unpackAngleByte((p.btn_ >>> 16) & 0xFF, Const.ViewAngleRes);
    const weaponBaseAngle = wpn.gfxRot_;
    const weaponBaseScaleX = wpn.gfxSx_;
    const weaponBaseScaleY = 1;
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
    let wx = 1;
    if (weaponAngle < -Math.PI * 0.5 || weaponAngle > Math.PI * 0.5) {
        wx = -1;
    }
    if (wpn.bulletType_ === 1) {
        // const t = Math.max(0, (p.s - 0.8) * 5);
        const t = Math.max(0, (p.s - 0.5) * 2);
        wd += Math.sin(t * Math.PI) * 12;
        weaponAngle -= -wx * Math.PI * 0.25 * Math.sin((1 - (1 - t) ** 2) * Math.PI * 2);
    }
    weaponX += wd * Math.cos(weaponAngle);
    weaponY += wd * Math.sin(weaponAngle);

    if (wx < 0) {
        weaponSX *= wx;
        weaponAngle -= Math.PI + 2 * weaponBaseAngle;
    }

    weaponAngle += weaponBaseAngle;

    if (weaponBack && p.weapon_) {
        draw(img[Img.weapon0 + p.weapon_ - 1], weaponX, weaponY, weaponAngle, weaponSX, weaponSY);
    }

    draw(img[Img.box_t], x - 3, y + 4 - 8 - 1, 0, 2, leg1, 1, 0x888888, 0, co);
    draw(img[Img.box_t], x + 3, y + 4 - 8 - 1, 0, 2, leg2, 1, 0x888888, 0, co);
    draw(img[Img.box], x, y - 6 - 1 + base, 0, 8, 6, 1, 0x444444, 0, co);

    {
        const s = p.w * 0.002;
        const a = 0.002 * p.u;
        draw(img[Img.avatar0 + (p.c + debugCheckAvatar) % Img.num_avatars], x, y - 16 + base * 2, a, 1 - s, 1 + s, 1, 0xFFFFFF, 0, co);
    }

    // DRAW HANDS
    const rArmX = x + 4;
    const lArmX = x - 4;
    const armY = (y - PlayerHandsZ + base * 2);
    const rArmRot = Math.atan2(weaponY - armY, weaponX - rArmX);
    const lArmRot = Math.atan2(weaponY - armY, weaponX - lArmX);
    const lArmLen = Math.hypot(weaponX - lArmX, weaponY - armY) - 1;
    const rArmLen = Math.hypot(weaponX - rArmX, weaponY - armY) - 1;

    if (p.weapon_) {
        draw(img[Img.box_l], x + 4, y - 4 - 5 - 1 + base, rArmRot, rArmLen, 2, 1, 0x888888, 0, co);
        draw(img[Img.box_l], x - 4, y - 4 - 5 - 1 + base, lArmRot, lArmLen, 2, 1, 0x888888, 0, co);
    } else {
        draw(img[Img.box_l], x + 4, y - 4 - 5 - 1 + base, sw1 + Math.PI / 4, 5, 2, 1, 0x888888, 0, co);
        draw(img[Img.box_l], x - 4, y - 4 - 5 - 1 + base, sw2 + Math.PI - Math.PI / 4, 5, 2, 1, 0x888888, 0, co);
    }

    if (!weaponBack && p.weapon_) {
        draw(img[Img.weapon0 + p.weapon_ - 1], weaponX, weaponY, weaponAngle, weaponSX, weaponSY);
    }
}

function getHitColorOffset(anim: number) {
    const x = 0xFF * Math.min(1, 2 * anim / hitAnimMax);
    return (x << 16) | (x << 8) | x;
}

function drawObject(img: Texture, p: Actor) {
    const x = p.x;
    const y = p.y - p.z;
    const co = getHitColorOffset(p.animHit_);
    draw(img, x, y, 0, 1, 1, 1, 0xFFFFFF, 0, co);
}

function drawBarrel(p: Actor) {
    drawObject(img[Img.barrel0 + p.c], p);
}

function drawTree(p: Actor) {
    drawObject(img[Img.tree0 + p.c], p);
}

function unpackAngleByte(angleByte: number, resolution: number) {
    return 2 * Math.PI * angleByte / resolution - Math.PI;
}

function packAngleByte(y: number, x: number, resolution: number) {
    return (resolution * (Math.PI + Math.atan2(y, x)) / (2 * Math.PI)) | 0
}

function drawActorBoundingSphere(p: Actor) {
    const r = objectRadiusByType[p.type_];
    const h = objectHeightByType[p.type_];
    const x = p.x;
    const y = p.y - p.z - h;
    const s = r / 16;
    draw(img[Img.box_t], x, y, 0, 1, p.z + h);
    draw(img[Img.circle_16], x, y, 0, s, s, 0.5, 0xFF0000);
}

let drawCollisionEnabled = false;

function drawCollisions() {
    for (const p of drawList) {
        drawActorBoundingSphere(p);
    }
}