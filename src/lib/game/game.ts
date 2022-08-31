import {ClientID} from "../../shared/types";
import {getClientId, getUserName, isChannelOpen, remoteClients} from "../net/messaging";
import {GL, gl} from "../graphics/gl";
import {play} from "../audio/context";
import {termPrint} from "../utils/log";
import {beginRender, camera, draw, flush} from "../graphics/draw2d";
import {getSeed, nextFloat, rand, seed, fxRand, fxRandElement} from "../utils/rnd";
import {channels_sendObjectData, getChannelPacketSize} from "../net/channels_send";
import {img, Img} from "../assets/gfx";
import {BASE_RESOLUTION, Const} from "./config";
import {generateMapBackground, mapTexture} from "../assets/map";
import {Actor, ActorType, Client, ClientEvent, EffectItemType, InitData, ItemCategory, Packet, Vel} from "./types";
import {pack, unpack} from "./packets";
import {reach} from "../utils/math";
import {
    ControlsFlag,
    drawVirtualPad,
    dropButton,
    gameCamera,
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
import {
    bulletColors,
    bulletImgs,
    bulletLonging,
    bulletLongingHighlight,
    bulletPulse,
    bulletSize,
    BulletType,
    weapons
} from "../assets/weapons";
import {COLOR_BODY, COLOR_WHITE, getLumaColor32} from "../assets/colors";
import {
    drawParticles,
    newBoneParticle,
    newFleshParticle,
    newShellParticle,
    Particle,
    updateParticles
} from "./particles";
import {
    addPos,
    addRadialVelocity,
    addVelFrom,
    addVelocityDir,
    applyGroundFriction,
    BOUNDS_SIZE,
    BULLET_RADIUS,
    collideWithBoundsA,
    copyPosFromActorCenter,
    OBJECT_HEIGHT_BY_TYPE,
    OBJECT_RADIUS,
    OBJECT_RADIUS_BY_TYPE,
    reflectVelocity,
    setRandomPosition,
    updateActorPhysics,
    updateAnim,
    updateBody
} from "./phy";

const clients = new Map<ClientID, Client>()
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

let waitToAutoSpawn = false;
let waitToSpawn = false;

let lastFrameTs = 0;
let lastInputTic = 0;
let lastInputCmd = 0;

// static state
let trees: Actor[] = [];

let _particles: Particle[];
let particles: Particle[] = [];

// dynamic state
let state: InitData = {
    seed_: 0,
    mapSeed_: 0,
    actors_: [[], [], [], []],
}

let lastState: InitData;

let simulatedFrames = 0;

const PlayerHandsZ = 10;
const jumpVel = 0x50;


const ANIM_HIT_OVER = 31;
const ANIM_HIT_MAX = 15;

let cameraShake = 0;
let cameraFeedback = 0;


// colors

function pickRandomWeaponId() {
    return 1 + rand(weapons.length - 1);
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
        animHit_: 31,
        hp_: 1,
    };
}

function newItemRandomWeapon(): Actor {
    const item = newActorObject(ActorType.Item);
    item.btn_ = ItemCategory.Weapon | pickRandomWeaponId();
    pushActor(item);
    return item;
}

function newItemRandomEffect(): Actor {
    const item = newActorObject(ActorType.Item);
    item.btn_ = ItemCategory.Effect | rand(2);
    pushActor(item);
    return item;
}

function requireClient(id: ClientID): Client {
    let client = clients.get(id);
    if (!client) {
        client = {c: id, t: 0, acknowledgedTic_: 0};
        clients.set(id, client);
    }
    return client;
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
    trees.length = 0;
    for (let i = 0; i < 128; ++i) {
        const tree = newActorObject(ActorType.Tree);
        tree.btn_ = rand(2);
        setRandomPosition(tree);
        trees.push(tree);
    }
}

function pushActor(a: Actor) {
    state.actors_[a.type_].push(a);
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
        setRandomPosition(newItemRandomWeapon());
        setRandomPosition(newItemRandomEffect());
        const actor = newActorObject(ActorType.Barrel);
        actor.hp_ = 3 + rand(4);
        actor.btn_ = rand(2);
        pushActor(setRandomPosition(actor));
    }
}

function updateFrameTime(ts: number) {
    if (ts > lastFrameTs) {
        lastFrameTs = ts;
    }
}

export function updateTestGame(ts: number) {
    updateFrameTime(ts);

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
            checkJoinSync();
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

function getMyPlayer(): Actor | undefined {
    return getPlayerByClient(getClientId());
}

function getPlayerByClient(c: ClientID): Actor | undefined {
    for (const p of state.actors_[ActorType.Player]) {
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
        checkDebugInput();
    }

    const player = getMyPlayer();
    if (player) {
        updateControls(player);
    }

    const inputTic = getNextInputTic();
    // if (lastInputTic >= inputTic) {
    if (lastInputTic > inputTic) {
        return;
    }
    lastInputTic = inputTic;
    // localEvents = localEvents.filter((x) => x.t < inputTic || x.spawn);

    let btn = 0;
    if (player) {
        updateControls(player);

        if (moveX || moveY) {
            btn |= (packAngleByte(moveY, moveX) << 8) | ControlsFlag.Move;
            if (moveFast) {
                btn |= ControlsFlag.Run;
            }
        }

        if (viewX || viewY) {
            btn |= packAngleByte(viewY, viewX) << 16;
            if (shootButtonDown) {
                btn |= ControlsFlag.Shooting;
            }
        }

        if (jumpButtonDown) {
            btn |= ControlsFlag.Jump;
        }

        if (dropButton) {
            btn |= ControlsFlag.Drop;
        }
    }

    // RESPAWN EVENT
    if (!waitToSpawn && !player && joined) {
        if (isAnyKeyDown() || waitToAutoSpawn) {
            btn |= ControlsFlag.Spawn;
            waitToSpawn = true;
            waitToAutoSpawn = false;
        }
    }

    if (lastInputCmd !== btn) {
        getLocalEvent(inputTic).btn_ = btn;
        lastInputCmd = btn;
    }
}

function checkJoinSync() {
    if (!joined && startTick >= 0) {
        for (const [id, rc] of remoteClients) {
            if (isChannelOpen(rc)) {
                const cl = clients.get(id);
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
        // respawnPlayer();
        waitToSpawn = false;
        waitToAutoSpawn = true;
    }
}

function calcNetTick() {
    netTick = gameTic + ((lastFrameTs - prevTime) * Const.NetFq) | 0;
    ackMin = netTick;
    for (const [id,] of remoteClients) {
        const client = clients.get(id);
        if (client) {
            if (netTick > client.t) {
                netTick = client.t;
            }
            if (ackMin > client.acknowledgedTic_) {
                ackMin = client.acknowledgedTic_;
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
    for (const [id, rc] of remoteClients) {
        if (isChannelOpen(rc)) {
            const cl = clients.get(id);
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
                    channels_sendObjectData(rc, pack(packet));
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
                channels_sendObjectData(rc, pack(init));
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
    updateFrameTime(performance.now() / 1000);
    if (tryRunTicks(lastFrameTs)) {
        trySendInput();
        cleaningUpClients();
    }
    // }
}

function cleaningUpClients() {
    for (const [id,] of clients) {
        if (!isChannelOpen(remoteClients.get(id))) {
            clients.delete(id);
        }
    }
}

/// Game logic

function processTicCommands(commands: ClientEvent[]) {
    for (const cmd of commands) {
        const source = cmd.c ?? getClientId();
        if (cmd.btn_ !== undefined) {
            const player = getPlayerByClient(source);
            if (player) {
                player.btn_ = cmd.btn_;
            } else if (cmd.btn_ & ControlsFlag.Spawn) {
                // Replace player if already exists
                let p = getPlayerByClient(cmd.c);
                if (!p) {
                    p = newActorObject(ActorType.Player);
                    p.c = source;
                    pushActor(p);
                }
                setRandomPosition(p);
                p.hp_ = 10;
                p.btn_ = cmd.btn_;
                p.weapon_ = Const.StartWeapon;
            }
        }
    }
}

function comparerSortY(a: Actor, b: Actor) {
    return a.y * BOUNDS_SIZE + a.x - b.y * BOUNDS_SIZE - b.x;
}

function sortList(list: Actor[]) {
    list.sort(comparerSortY);
}

function pickItem(item: Actor, player: Actor) {
    // isWeapon
    const itemId = item.btn_ & 0xFF;
    const itemCat = item.btn_ & 0x300;
    if (itemCat === ItemCategory.Weapon) {
        const playerHasNoWeapon = !player.weapon_;
        const playerNotDropping = !(player.btn_ & ControlsFlag.Drop);
        if (playerHasNoWeapon && playerNotDropping) {
            player.weapon_ = itemId;
            playAt(player, Snd.pick);
            item.hp_ = item.btn_ = 0;
        }
    } else /*if(itemCat === ItemCategory.Effect)*/ {
        if (itemId === EffectItemType.Med) {
            playAt(player, Snd.med);
            item.hp_ = item.btn_ = 0;
        } else if (itemId === EffectItemType.Health) {
            if (player.hp_ < 10) {
                ++player.hp_;
                playAt(player, Snd.heal);
                item.hp_ = item.btn_ = 0;
            }
        }
    }
}

function updateGameCamera(dt: number) {
    let cameraScale = BASE_RESOLUTION / Math.min(gl.drawingBufferWidth, gl.drawingBufferHeight);
    let cameraX = BOUNDS_SIZE >> 1;
    let cameraY = BOUNDS_SIZE >> 1;
    const p0 = getMyPlayer();
    if (p0) {
        const wpn = weapons[p0.weapon_];
        cameraX = p0.x + (wpn.cameraLookForward_ - wpn.cameraFeedback_ * cameraFeedback) * (lookAtX - p0.x);
        cameraY = p0.y + (wpn.cameraLookForward_ - wpn.cameraFeedback_ * cameraFeedback) * (lookAtY - p0.y);
    }
    gameCamera[0] = lerp(gameCamera[0], cameraX, 4 * dt);
    gameCamera[1] = lerp(gameCamera[1], cameraY, 4 * dt);
    gameCamera[2] = lerp(gameCamera[2], cameraScale, 2 * dt);
}

function simulateTic(dt: number) {
    updateGameCamera(dt);
    for (const l of state.actors_) sortList(l);
    for (const l of state.actors_) for (const a of l) updateActorPhysics(a, dt);

    for (const a of state.actors_[ActorType.Player]) {
        updatePlayer(a, dt);
    }
    for (const a of state.actors_[ActorType.Item]) {
        if (!a.animHit_) {
            for (const player of state.actors_[ActorType.Player]) {
                if (testIntersection(a, player)) {
                    pickItem(a, player);
                }
            }
        }
    }

    updateBulletCollision(state.actors_[ActorType.Player]);
    updateBulletCollision(state.actors_[ActorType.Barrel]);
    updateBulletCollision(trees);

    for (const bullet of state.actors_[ActorType.Bullet]) {
        updateBody(bullet, dt, 0, 0);
        if (bullet.hp_ && collideWithBoundsA(bullet)) {
            --bullet.hp_;
        }
        if (bullet.btn_ === BulletType.Ray) {
            bullet.hp_ = -1;
        }
        if (bullet.s > 0) {
            bullet.s -= dt;
            if (bullet.s <= 0) {
                bullet.hp_ = 0;
            }
        }
    }
    for (const tree of trees) {
        updateAnim(tree, dt);
    }
    updateParticles(particles, dt);

    for (let i = 0; i < state.actors_.length; ++i) {
        state.actors_[i] = state.actors_[i].filter(x => x.hp_);
    }
    updateBodyInterCollisions(state.actors_[ActorType.Player]);
    updateBodyInterCollisions(state.actors_[ActorType.Barrel]);
    updateBodyInterCollisions2(state.actors_[ActorType.Player], state.actors_[ActorType.Barrel]);
    updateBodyInterCollisions2(state.actors_[ActorType.Player], trees);
    updateBodyInterCollisions2(state.actors_[ActorType.Barrel], trees);

    if (waitToSpawn && getMyPlayer()) {
        waitToSpawn = false;
    }
    cameraShake = reach(cameraShake, 0, dt);
    cameraFeedback = reach(cameraFeedback, 0, 12 * dt);

    if (gameTic % 500 === 0) {
        const p = newActorObject(ActorType.Player);
        setRandomPosition(p);
        p.hp_ = 10;
        pushActor(p);
    }

}

function updateBodyInterCollisions2(list1: Actor[], list2: Actor[]) {
    for (let i = 0; i < list1.length; ++i) {
        const a = list1[i];
        const ra = OBJECT_RADIUS_BY_TYPE[a.type_];
        const ha = OBJECT_HEIGHT_BY_TYPE[a.type_];
        for (let j = 0; j < list2.length; ++j) {
            const b = list2[j];
            const rb = OBJECT_RADIUS_BY_TYPE[b.type_];
            const hb = OBJECT_HEIGHT_BY_TYPE[b.type_];
            let nx = a.x - b.x;
            let ny = (a.y - b.y) * 2;
            let nz = (a.z + ha) - (b.z + hb);
            const dist = Math.hypot(nx, ny, nz);
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
        const ra = OBJECT_RADIUS_BY_TYPE[a.type_];
        const ha = OBJECT_HEIGHT_BY_TYPE[a.type_];
        for (let j = i + 1; j < max; ++j) {
            const b = list[j];
            const rb = OBJECT_RADIUS_BY_TYPE[b.type_];
            const hb = OBJECT_HEIGHT_BY_TYPE[b.type_];
            let nx = a.x - b.x;
            let ny = (a.y - b.y) * 2;
            let nz = (a.z + ha) - (b.z + hb);
            const dist = Math.hypot(nx, ny, nz);
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

function testRayWithSphere(from: Actor, target: Actor, dx: number, dy: number) {
    // const dd = Math.hypot(dx, dy);
    // dx /= dd;
    // dy /= dd;
    const R = OBJECT_RADIUS_BY_TYPE[target.type_];
    const fromZ = from.z;
    const targetZ = target.z + OBJECT_HEIGHT_BY_TYPE[target.type_];
    let Lx = target.x - from.x;
    let Ly = target.y - from.y;
    let Lz = targetZ - fromZ;
    const len = Lx * dx + Ly * dy;
    if (len < 0) return false;

    Lx = from.x + dx * len;
    Ly = from.y + dy * len;
    Lz = fromZ;
    const dSq = ((target.x - Lx) ** 2) + ((target.y - Ly) ** 2) + ((targetZ - Lz) ** 2);
    const rSq = R * R;
    return dSq <= rSq;
}

function testIntersection(a: Actor, b: Actor): boolean {
    const ra = OBJECT_RADIUS_BY_TYPE[a.type_];
    const rb = OBJECT_RADIUS_BY_TYPE[b.type_];
    const ha = OBJECT_HEIGHT_BY_TYPE[a.type_];
    const hb = OBJECT_HEIGHT_BY_TYPE[b.type_];
    let nx = a.x - b.x;
    let ny = a.y - b.y;
    let nz = (a.z + ha) - (b.z + hb);
    const D = ra + rb;
    return nx * nx + ny * ny + nz * nz < D * D;
}


function kill(actor: Actor) {
    playAt(actor, Snd.death);
    const amount = 1 + rand(3);
    for (let i = 0; i < amount; ++i) {
        const item = newItemRandomEffect();
        copyPosFromActorCenter(item, actor);
        addVelFrom(item, actor);
        const v = 32 + rand(64);
        addRadialVelocity(item, v, v);
        item.animHit_ = ANIM_HIT_MAX;
        if (actor.weapon_) {
            item.btn_ = ItemCategory.Weapon | actor.weapon_;
            actor.weapon_ = 0;
        }
    }
    if (actor.type_ === ActorType.Player) {
        const grave = newActorObject(ActorType.Barrel);
        copyPosFromActorCenter(grave, actor);
        addVelFrom(grave, actor);
        grave.w += 32;
        grave.hp_ = 20;
        grave.btn_ = 2;
        pushActor(grave);

        spawnFleshParticles(actor, 256, 32, grave);
        spawnBonesParticles(actor, grave);
    }
}

function hitWithBullet(actor: Actor, bullet: Actor) {
    addVelFrom(actor, bullet, 0.1);
    actor.animHit_ = ANIM_HIT_MAX;
    playAt(actor, Snd.hit);
    if (actor.hp_) {
        actor.hp_ -= bullet.weapon_;
        if (actor.type_ === ActorType.Player) {
            spawnFleshParticles(actor, 64, 16, bullet);
            playAt(actor, Snd.hurt);
        }
        if (actor.hp_ <= 0) {
            // could be effect if damage is big
            actor.hp_ = 0;
            kill(actor);
        }
    }
    if (bullet.hp_ && bullet.btn_ !== BulletType.Ray) {
        --bullet.hp_;
        if (bullet.hp_) {
            let nx = bullet.x - actor.x;
            let ny = bullet.y - actor.y;
            const dist = Math.hypot(nx, ny);
            const pen = OBJECT_RADIUS_BY_TYPE[actor.type_] + BULLET_RADIUS + 1;
            nx /= dist;
            ny /= dist;
            reflectVelocity(bullet, nx, ny, 1);
            bullet.x = actor.x + pen * nx;
            bullet.y = actor.y + pen * ny;
        }
    }
}

function updateBulletCollision(list: Actor[]) {
    for (const b of state.actors_[ActorType.Bullet]) {
        if (b.hp_) {
            for (const a of list) {
                const owned = !(a.c - b.c);
                if (!owned) {
                    if (b.btn_ === BulletType.Ray && b.hp_ > 0) {
                        if (testRayWithSphere(b, a, b.u, b.v)) {
                            hitWithBullet(a, b);
                        }
                    } else {
                        if (testIntersection(a, b)) {
                            hitWithBullet(a, b);
                        }
                    }
                }
            }
        }
    }
}

function unpackAngleByte(angleByte: number) {
    return 2 * Math.PI * (angleByte & 0xFF) / Const.AngleRes - Math.PI;
}

function packAngleByte(y: number, x: number) {
    return (Const.AngleRes * (Math.PI + Math.atan2(y, x)) / (2 * Math.PI)) & 0xFF;
}

function updatePlayer(player: Actor, dt: number) {
    let grounded = player.z === 0 && player.w === 0;
    if (player.btn_ & ControlsFlag.Jump) {
        if (grounded) {
            player.z = 1;
            player.w = jumpVel;
            grounded = false;
            playAt(player, Snd.blip);
        }
    }
    let c = grounded ? 16 : 8;
    const lookAngle = unpackAngleByte(player.btn_ >> Const.LookAngleBit);
    const moveAngle = unpackAngleByte(player.btn_ >> Const.MoveAngleBit);
    const lookDirX = Math.cos(lookAngle);
    const lookDirY = Math.sin(lookAngle);
    const moveDirX = Math.cos(moveAngle);
    const moveDirY = Math.sin(moveAngle);
    if (player.btn_ & ControlsFlag.Move) {
        const speed = (player.btn_ & ControlsFlag.Run) ? 2 : 1;
        const vel = speed * 60;
        player.u = reach(player.u, vel * moveDirX, vel * dt * c);
        player.v = reach(player.v, vel * moveDirY, vel * dt * c);
        if (grounded && !(gameTic % (20 / speed))) {
            playAt(player, Snd.step);
        }
    } else {
        applyGroundFriction(player, 32 * c * dt);
    }

    if (player.btn_ & ControlsFlag.Drop) {
        if (player.weapon_) {
            const item = newActorObject(ActorType.Item);
            pushActor(item);
            copyPosFromActorCenter(item, player);
            addVelFrom(item, player, 0.5);
            addVelocityDir(item, lookDirX, lookDirY, 0, 64);
            // set weapon item
            item.btn_ = ItemCategory.Weapon | player.weapon_;
            item.animHit_ = ANIM_HIT_OVER;
            player.weapon_ = 0;
        }
    }

    const weapon = weapons[player.weapon_];
    if (player.btn_ & ControlsFlag.Shooting) {
        player.s = reach(player.s, 0, weapon.rate_ * dt);
        if (!player.s) {
            cameraShake = Math.max(weapon.cameraShake_, cameraShake);
            player.s = 1;
            cameraFeedback = 1;
            player.t = reach(player.t, 1, dt * weapon.detuneSpeed_);
            addVelocityDir(player, lookDirX, lookDirY, -1, player.w > 0 ? 0 : -weapon.kickBack_);
            playAt(player, Snd.shoot);
            for (let i = 0; i < weapon.spawnCount_; ++i) {
                const a = lookAngle +
                    weapon.angleVar_ * (nextFloat() - 0.5) +
                    weapon.angleSpread_ * Math.min(1, player.t) * (nextFloat() - 0.5);
                const dx = Math.cos(a);
                const dy = Math.sin(a);
                const bulletVelocity = weapon.velocity_ + weapon.velocityVar_ * (nextFloat() - 0.5);
                const bullet = newActorObject(ActorType.Bullet);
                bullet.c = player.c;
                copyPosFromActorCenter(bullet, player);
                addPos(bullet, dx, dy, 0, weapon.offset_);
                bullet.z += PlayerHandsZ - 12 + weapon.offsetZ_;
                addVelocityDir(bullet, dx, dy, 0, bulletVelocity);
                bullet.weapon_ = weapon.bulletDamage_;
                bullet.btn_ = weapon.bulletType_;
                bullet.hp_ = weapon.bulletHp_;
                bullet.s = weapon.bulletLifetime_;
                pushActor(bullet);
            }

            particles.push(newShellParticle(player, PlayerHandsZ + weapon.offsetZ_));
        }
    } else {
        player.t = reach(player.t, 0, dt * 16);
        player.s = reach(player.s, weapon.launchTime_, dt * weapon.relaunchSpeed_);
    }
}

export function spawnFleshParticles(actor: Actor, expl: number, amount: number, vel?: Vel) {
    for (let i = 0; i < amount; ++i) {
        particles.push(newFleshParticle(actor, expl, vel));
    }
}

export function spawnBonesParticles(actor: Actor, vel?: Vel) {
    for (let i = 0; i < 32; ++i) {
        particles.push(newBoneParticle(actor, vel));
    }
}

function getCommandsForTic(tic: number): ClientEvent[] {
    const events = localEvents.filter(v => v.t === tic)
        .concat(receivedEvents.filter(v => v.t === tic));
    events.sort((a, b) => (a.c ?? getClientId()) - (b.c ?? getClientId()));
    return events;
}

function beginPrediction() {
    // local state
    _particles = particles;
    particles = JSON.parse(JSON.stringify(particles));

    // global state
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
    // global state
    state = lastState;
    seed(state.seed_);

    // local state
    particles = _particles;
}

/*** DRAWING ***/

function lerp(a: number, b: number, t: number): number {
    return (1 - t) * a + t * b;
}

function drawGame() {
    camera.scale_ = 1 / gameCamera[2];
    camera.toX_ = camera.toY_ = 0.5;
    camera.atX_ = gameCamera[0];
    camera.atY_ = gameCamera[1];
    camera.atX_ += ((Math.random() - 0.5) * cameraShake * 8) | 0;
    camera.atY_ += ((Math.random() - 0.5) * cameraShake * 8) | 0;
    camera.angle_ = (Math.random() - 0.5) * cameraShake / 8;
    beginRender();
    gl.clearColor(0.4, 0.4, 0.4, 1.0);
    gl.clear(GL.COLOR_BUFFER_BIT);
    drawMapBackground();
    drawObjects();

    if (process.env.NODE_ENV === "development") {
        drawCollisions();
    }

    drawMapOverlay();
    drawCrosshair();
    flush();
}

function drawOverlay() {
    camera.scale_ = Math.min(gl.drawingBufferWidth, gl.drawingBufferHeight) / BASE_RESOLUTION;
    camera.toX_ = camera.toY_ = camera.atX_ = camera.atY_ = camera.angle_ = 0;
    beginRender();
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
    const pad = OBJECT_RADIUS * 2;
    const W = gl.drawingBufferWidth;
    const H = gl.drawingBufferHeight;
    const l = (0 - W / 2) / camera.scale_ + camera.atX_ - pad;
    const t = (0 - H / 2) / camera.scale_ + camera.atY_ - pad - 128;
    const r = (W - W / 2) / camera.scale_ + camera.atX_ + pad;
    const b = (H - H / 2) / camera.scale_ + camera.atY_ + pad + 128;
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
    // draw(img[Img.box_lt], 0, -objectRadiusUnit * 5, 0, boundsSize + 2, objectRadiusUnit * 4, 1, 0x666666);
    draw(img[Img.box_lt], 0, -OBJECT_RADIUS * 3, 0, BOUNDS_SIZE + 2, OBJECT_RADIUS * 4, 0.5, 0);
}

function drawMapOverlay() {
    draw(img[Img.box_lt], 0, BOUNDS_SIZE - OBJECT_RADIUS * 2, 0, BOUNDS_SIZE + 2, OBJECT_RADIUS * 4, 1, 0x666666);
    // draw(img[Img.box_lt], -objectRadiusUnit * 2, -objectRadiusUnit * 2, 0, objectRadiusUnit * 2, boundsSize + objectRadiusUnit * 4, 1, 0x666666);
    // draw(img[Img.box_lt], boundsSize, -objectRadiusUnit * 2, 0, objectRadiusUnit * 2, boundsSize + objectRadiusUnit * 4, 1, 0x666666);
}

function drawCrosshair() {
    const p0 = getMyPlayer();
    if (p0 && (viewX || viewY)) {
        const len = 4 + 0.25 * Math.sin(2 * lastFrameTs) * Math.cos(4 * lastFrameTs) + 4 * Math.min(1, p0.t) + 4 * Math.min(1, p0.s);
        let a = 0.1 * lastFrameTs;
        for (let i = 0; i < 4; ++i) {
            draw(img[Img.box_t2], lookAtX, lookAtY, a, 2, len, 0.5);
            a += Math.PI / 2;
        }
    }
}

function drawItem(item: Actor) {
    const colorOffset = getHitColorOffset(item.animHit_);
    const cat = item.btn_ & 0x300;
    const idx = item.btn_ & 0xFF;
    if (cat === ItemCategory.Weapon) {
        const weapon = img[Img.weapon0 + idx];
        if (weapon) {
            const px = weapon.x;
            const py = weapon.y;
            weapon.x = 0.5;
            weapon.y = 0.7;
            draw(weapon, item.x, item.y - item.z, 0, 0.8, 0.8, 1, COLOR_WHITE, 0, colorOffset);
            weapon.x = px;
            weapon.y = py;
        }
    } else /*if (cat === ItemCategory.Effect)*/ {
        const anim = item.anim0_ / 0xFF;
        const s = 1 + 0.1 * Math.sin(16 * (lastFrameTs + anim * 10));
        const o = 2 * Math.cos(lastFrameTs + anim * 10);
        draw(img[Img.item0 + idx], item.x, item.y - item.z - OBJECT_RADIUS - o, 0, s, s, 1, COLOR_WHITE, 0, colorOffset);
    }
}

function drawBullet(actor: Actor) {
    const x = actor.x;
    const y = actor.y - actor.z;
    const a = Math.atan2(actor.v, actor.u);
    const color = fxRandElement(bulletColors[actor.btn_]);
    const longing = bulletLonging[actor.btn_];
    const longing2 = bulletLongingHighlight[actor.btn_];
    const sz = bulletSize[actor.btn_] + bulletPulse[actor.btn_] * Math.sin(32 * lastFrameTs + actor.anim0_);
    let res = actor.btn_ * 3;

    draw(img[bulletImgs[res++]], x, y, a, sz * longing, sz, 0.1, COLOR_WHITE, 1);
    draw(img[bulletImgs[res++]], x, y, a, sz * longing / 2, sz / 2, 1, color);
    draw(img[bulletImgs[res++]], x, y, a, 2 * longing2, 2);
}

const drawerByType = [
    drawPlayer,
    drawBarrel,
    drawBullet,
    drawItem,
    drawTree,
];

function drawObjects() {
    drawParticles(particles);
    collectVisibleActors(trees, ...state.actors_);
    sortList(drawList);
    drawShadows();
    for (const actor of drawList) {
        drawerByType[actor.type_](actor);
    }
}

function drawPlayer(p: Actor) {
    const co = getHitColorOffset(p.animHit_);
    const imgHead = (debugCheckAvatar + (p.c || p.anim0_)) % Img.num_avatars;
    const colorC = COLOR_BODY[p.anim0_ % COLOR_BODY.length];
    const colorArm = colorC;
    const colorBody = colorC;
    const x = p.x;
    const y = p.y - p.z;
    const speed = Math.hypot(p.u, p.v, p.w);
    const runK = (p.btn_ & ControlsFlag.Run) ? 1 : 0.8;
    const walk = Math.min(1, speed / 100);
    let base = -0.5 * walk * 0.5 * (1.0 + Math.sin(40 * runK * lastFrameTs));
    const idle_base = (1 - walk) * ((1 + Math.sin(10 * lastFrameTs) ** 2) / 4);
    base += idle_base;
    const leg1 = 5 - 4 * walk * 0.5 * (1.0 + Math.sin(40 * runK * lastFrameTs));
    const leg2 = 5 - 4 * walk * 0.5 * (1.0 + Math.sin(40 * runK * lastFrameTs + Math.PI));
    const sw1 = walk * Math.sin(20 * runK * lastFrameTs);
    const sw2 = walk * Math.cos(20 * runK * lastFrameTs);

    /////

    const wpn = weapons[p.weapon_];
    let viewAngle = unpackAngleByte(p.btn_ >> Const.LookAngleBit);
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
    if (wpn.handsAnim_) {
        // const t = Math.max(0, (p.s - 0.8) * 5);
        // anim := 1 -> 0
        const t = Math.min(1, wpn.launchTime_ > 0 ? (p.s / wpn.launchTime_) : Math.max(0, (p.s - 0.5) * 2));
        wd += Math.sin(t * Math.PI) * wpn.handsAnim_;
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
        draw(img[Img.weapon0 + p.weapon_], weaponX, weaponY, weaponAngle, weaponSX, weaponSY);
    }

    draw(img[Img.box_t], x - 3, y - 5, 0, 2, leg1, 1, colorArm, 0, co);
    draw(img[Img.box_t], x + 3, y - 5, 0, 2, leg2, 1, colorArm, 0, co);
    draw(img[Img.box], x, y - 7 + base, 0, 8, 6, 1, colorBody, 0, co);

    {
        const s = p.w * 0.002;
        const a = 0.002 * p.u;
        draw(img[Img.avatar0 + imgHead], x, y - 16 + base * 2, a, 1 - s, 1 + s, 1, COLOR_WHITE, 0, co);
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
        draw(img[Img.box_l], x + 4, y - 10 + base, rArmRot, rArmLen, 2, 1, colorArm, 0, co);
        draw(img[Img.box_l], x - 4, y - 10 + base, lArmRot, lArmLen, 2, 1, colorArm, 0, co);
    } else {
        draw(img[Img.box_l], x + 4, y - 10 + base, sw1 + Math.PI / 4, 5, 2, 1, colorArm, 0, co);
        draw(img[Img.box_l], x - 4, y - 10 + base, sw2 + Math.PI - Math.PI / 4, 5, 2, 1, colorArm, 0, co);
    }

    if (!weaponBack && p.weapon_) {
        draw(img[Img.weapon0 + p.weapon_], weaponX, weaponY, weaponAngle, weaponSX, weaponSY);
    }
}

function getHitColorOffset(anim: number) {
    return getLumaColor32(0xFF * Math.min(1, 2 * anim / ANIM_HIT_MAX));
}

function drawObject(p: Actor, id: Img) {
    const x = p.x;
    const y = p.y - p.z;
    const co = getHitColorOffset(p.animHit_);
    draw(img[id], x, y, 0, 1, 1, 1, COLOR_WHITE, 0, co);
}

function drawBarrel(p: Actor) {
    drawObject(p, p.btn_ + Img.barrel0);
}

function drawTree(p: Actor) {
    drawObject(p, p.btn_ + Img.tree0);
}

/// SOUND ENV ///

function playAt(actor: Actor, id: Snd) {
    let lx = BOUNDS_SIZE / 2;
    let ly = BOUNDS_SIZE / 2;
    const p0 = getMyPlayer();
    if (p0) {
        lx = p0.x;
        ly = p0.y;
    }

    const dx = (actor.x - lx) / 256;
    const dy = (actor.y - ly) / 256;
    const v = 1 - Math.hypot(dx, dy);
    if (v > 0) {
        const pan = Math.max(-1, Math.min(1, dx));
        play(snd[id], v, pan, false);
    }
}

//// DEBUG UTILITIES ////

let drawCollisionEnabled = false;
let debugCheckAvatar = 0;
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
        const cl = clients.get(remoteClient.id_);
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

function checkDebugInput() {
    if (keyboardDown.has("Digit1")) {
        ++debugCheckAvatar;
    }
    if (keyboardDown.has("Digit2")) {
        drawCollisionEnabled = !drawCollisionEnabled;
    }
}

function drawActorBoundingSphere(p: Actor) {
    const r = OBJECT_RADIUS_BY_TYPE[p.type_];
    const h = OBJECT_HEIGHT_BY_TYPE[p.type_];
    const x = p.x;
    const y = p.y - p.z - h;
    const s = r / 16;
    draw(img[Img.box_t], x, y, 0, 1, p.z + h);
    draw(img[Img.circle_16], x, y, 0, s, s, 0.5, 0xFF0000);
}

function drawCollisions() {
    if (drawCollisionEnabled) {
        for (const p of drawList) {
            drawActorBoundingSphere(p);
        }
    }
}
