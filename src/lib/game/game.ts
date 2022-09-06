import {ClientID} from "../../shared/types";
import {disconnect, getClientId, getUserName, isChannelOpen, remoteClients} from "../net/messaging";
import {GL, gl} from "../graphics/gl";
import {play} from "../audio/context";
import {termPrint} from "../utils/log";
import {beginRender, camera, draw, flush} from "../graphics/draw2d";
import {_SEED, fxRandElement, nextFloat, rand, random, setSeed} from "../utils/rnd";
import {channels_sendObjectData, getChannelPacketSize} from "../net/channels_send";
import {EMOJI, img, Img} from "../assets/gfx";
import {_debugLagK, Const, setDebugLagK} from "./config";
import {generateMapBackground, mapTexture} from "../assets/map";
import {
    Actor,
    ActorType,
    Client,
    ClientEvent,
    EffectItemType,
    ItemCategory,
    newStateData,
    Packet,
    StateData,
    Vel
} from "./types";
import {pack, unpack} from "./packets";
import {getLumaColor32, lerp, PI, PI2, reach} from "../utils/math";
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
import {BulletType, weapons} from "./data/weapons";
import {
    addBoneParticles,
    addFleshParticles,
    addShellParticle,
    drawParticles,
    drawSplats,
    flushSplatsToMap,
    restoreParticles,
    saveParticles,
    updateParticles
} from "./particles";
import {
    addPos,
    addRadialVelocity,
    addVelFrom,
    addVelocityDir,
    applyGroundFriction,
    collideWithBoundsA,
    copyPosFromActorCenter,
    reflectVelocity,
    roundActors,
    setRandomPosition,
    testIntersection,
    testRayWithSphere,
    updateActorPhysics,
    updateAnim,
    updateBody,
    updateBodyCollisions
} from "./phy";
import {BASE_RESOLUTION, BOUNDS_SIZE} from "../assets/params";
import {
    ANIM_HIT_MAX,
    ANIM_HIT_OVER,
    BULLET_RADIUS,
    JUMP_VEL,
    OBJECT_HEIGHT,
    OBJECT_RADIUS,
    OBJECT_RADIUS_BY_TYPE,
    PLAYER_HANDS_Z,
} from "./data/world";
import {COLOR_BODY, COLOR_WHITE} from "./data/colors";

const clients = new Map<ClientID, Client>()

// TODO: check idea of storage events in map?
let localEvents: ClientEvent[] = [];
let receivedEvents: ClientEvent[] = [];

// tics received from all peers (min value), we could simulate to it
let netTic = 0;
let startTic = -1;
let gameTic = 0;
let prevTime = 0;
let ackMin = 0;
let joined = false;

let waitToAutoSpawn = false;
let waitToSpawn = false;

let lastFrameTs = 0;
let lastInputTic = 0;
let lastInputCmd = 0;
let lastAudioTic = 0;

// static state
let trees: Actor[] = [];

// dynamic state
let state: StateData = newStateData();
let lastState: StateData;

let cameraShake = 0;
let cameraFeedback = 0;

// colors
const newActorObject = (type: ActorType): Actor =>
    ({
        id_: state.nextId_++,
        type_: type,
        x_: 0,
        y_: 0,
        z_: 0,

        u_: 0,
        v_: 0,
        w_: 0,

        btn_: 0,
        client_: 0,

        s_: 0,
        t_: 0,

        weapon_: 0,
        anim0_: rand(0x100),
        animHit_: 31,
        hp_: 1,
    });

const newItemRandomEffect = (): Actor => {
    const item = newActorObject(ActorType.Item);
    item.btn_ = ItemCategory.Effect | rand(2);
    pushActor(item);
    return item;
}

const requireClient = (id: ClientID): Client => {
    let client = clients.get(id);
    if (!client) {
        client = {id_: id, tic_: 0, acknowledgedTic_: 0};
        clients.set(id, client);
    }
    return client;
}

export const resetGame = () => {
    clients.clear();
    localEvents.length = 0;
    receivedEvents.length = 0;

    // netTic = 0;
    startTic = -1;
    // gameTic = 0;
    // prevTime = 0;
    // startTime = 0;
    // ackMin = 0;
    joined = false;

    waitToAutoSpawn = false;
    waitToSpawn = false;

    lastFrameTs = 0;
    lastInputTic = 0;
    lastInputCmd = 0;
    lastAudioTic = 0;
    console.log("reset game");
    // document.addEventListener("visibilitychange", () => {
    //     const active = !document.hidden;
    //     if (clientActive !== active) {
    //         clientActive = active;
    //     }
    // });
}

const recreateMap = () => {
    // generate map
    setSeed(state.mapSeed_);
    generateMapBackground();
    trees.length = 0;
    const nextId = state.nextId_;
    for (let i = 0; i < 128; ++i) {
        const tree = newActorObject(ActorType.Tree);
        tree.btn_ = rand(2);
        tree.hp_ = 0;
        setRandomPosition(tree);
        trees.push(tree);
    }
    setSeed(state.seed_);
    state.nextId_ = nextId;
}

const pushActor = (a: Actor) => {
    state.actors_[a.type_].push(a);
}

const createSeedGameState = () => {
    startTic = 0;
    gameTic = 0;
    netTic = 0;
    state.mapSeed_ = _SEED;
    state.seed_ = _SEED;
    recreateMap();
    for (let i = 0; i < 32; ++i) {
        //setRandomPosition(newItemRandomWeapon());
        //setRandomPosition(newItemRandomEffect());
        const actor = newActorObject(ActorType.Barrel);
        actor.hp_ = 3 + rand(4);
        actor.btn_ = rand(2);
        actor.weapon_ = rand(weapons.length);
        setRandomPosition(actor)
        pushActor(actor);
    }
    state.seed_ = _SEED;
}

const updateFrameTime = (ts: number) => {
    if (ts > lastFrameTs) {
        lastFrameTs = ts;
    }
}

export const updateTestGame = (ts: number) => {
    updateFrameTime(ts);

    if (startTic < 0 && !remoteClients.size) {
        createSeedGameState();
    }

    if (startTic >= 0 && !document.hidden) {
        tryRunTicks(lastFrameTs);

        flushSplatsToMap();
        const predicted = beginPrediction();
        {
            drawGame();
            // check input before overlay, or save camera settings
            checkPlayerInput();
            checkJoinSync();
            drawOverlay();
        }
        if (predicted) endPrediction();
        sendInput();
        cleaningUpClients();
    }
    printStatus();
    if (process.env.NODE_ENV === "development") {
        printDebugInfo();
    }
}

const printStatus = () => {
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
            if (p0.weapon_) {
                termPrint(EMOJI[Img.weapon0 + p0.weapon_] + "\n");
            }
        } else {
            termPrint("Tap to spawn!\n");
        }
    } else {
        termPrint("Joining\n");
    }

    const getPlayerIcon = (id?: ClientID) => {
        const player = getPlayerByClient(id);
        return player ? EMOJI[Img.avatar0 + player.anim0_ % Img.num_avatars] : "👁️";
    }

    termPrint(getPlayerIcon(getClientId()) + " " + getUserName() + " | ☠️" + (state.scores_[getClientId()] | 0) + "\n");
    for (const [id, rc] of remoteClients) {
        let status = "🔴";
        if (isChannelOpen(rc) && rc?.pc_.iceConnectionState[1] == "o") {
            status = getPlayerIcon(rc.id_);
        }
        termPrint(status + " " + rc.name_ + " | ☠️" + (state.scores_[id] | 0) + "\n");
    }
}

const getMyPlayer = (): Actor | undefined =>
    getPlayerByClient(getClientId());

const getPlayerByClient = (c: ClientID): Actor | undefined => {
    for (const p of state.actors_[ActorType.Player]) {
        if (p.client_ === c) {
            return p;
        }
    }
}

const getLocalEvent = (tic: number): ClientEvent => {
    for (const e of localEvents) {
        if (e.tic_ === tic) {
            return e;
        }
    }
    const e: ClientEvent = {tic_: tic, client_: getClientId()};
    localEvents.push(e);
    return e;
}

const getNextInputTic = (tic: number) => {
    const simTic = ((lastFrameTs - prevTime) * Const.NetFq) | 0;
    return tic + Math.max(Const.InputDelay, simTic);
    // return tic + Const.InputDelay;
}

const checkPlayerInput = () => {
    if (process.env.NODE_ENV === "development") {
        checkDebugInput();
    }

    const player = getMyPlayer();
    if (player) {
        updateControls(player);
    }

    let inputTic = getNextInputTic(gameTic);
    // if (lastInputTic >= inputTic) {

    // if (inputTic < lastInputTic) {
    //     return;
    // }
    // lastInputTic = inputTic;


    // localEvents = localEvents.filter((x) => x.t < inputTic || x.spawn);

    let btn = 0;
    if (player) {
        if (moveX || moveY) {
            btn |= (packAngleByte(moveY, moveX, ControlsFlag.MoveAngleMax) << ControlsFlag.MoveAngleBit) | ControlsFlag.Move;
            if (moveFast) {
                btn |= ControlsFlag.Run;
            }
        }

        if (viewX || viewY) {
            btn |= packAngleByte(viewY, viewX, ControlsFlag.LookAngleMax) << ControlsFlag.LookAngleBit;
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

    // const lastInputBtn = getLastLocalBtn(inputTic);
    // if (lastInputCmd !== btn) {
    if (lastInputCmd !== btn) {
        if (inputTic <= lastInputTic) {
            inputTic = lastInputTic + 1;
        }
        lastInputTic = inputTic;
        // copy flag in case of rewriting local event for ONE-SHOT events
        const g = getLocalEvent(inputTic);
        if (g.btn_ & ControlsFlag.Spawn) {
            btn |= ControlsFlag.Spawn;
        }

        getLocalEvent(inputTic).btn_ = btn;
        lastInputCmd = btn;
    }
}

const checkJoinSync = () => {
    if (!joined && startTic >= 0) {
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

const calcNetTic = () => {
    netTic = gameTic + ((lastFrameTs - prevTime) * Const.NetFq) | 0;
    ackMin = gameTic;
    for (const [id,] of remoteClients) {
        const client = clients.get(id);
        if (client) {
            if (netTic > client.tic_) {
                netTic = client.tic_;
            }
            if (ackMin > client.acknowledgedTic_) {
                ackMin = client.acknowledgedTic_;
            }
        }
    }
}

const tryRunTicks = (ts: number): number => {
    if (startTic < 0) {
        return 0;
    }
    calcNetTic();
    let frames = (ts - prevTime) * Const.NetFq | 0;
    let framesSimulated = 0;
    while (gameTic <= netTic && frames--) {
        simulateTic();
        ++framesSimulated;

        // compensate
        // we must try to keep netTic >= gameTic + Const.InputDelay
        prevTime += 1 / Const.NetFq;
    }

    // we played all available net-events
    const nearPrevTime = lerp(prevTime, ts - Const.InputDelay / Const.NetFq, 0.01);
    if (gameTic > netTic) {
        // slow down a bit in case if we predict a lot
        if (ts - prevTime > Const.InputDelay / Const.NetFq) {
            prevTime = nearPrevTime;
        }
    } else {
        // we got packets to go
        if (gameTic + Const.InputDelay < netTic) {
            // speed up
            // console.info("speed up");
            // prevTime -= Const.NetDt * dropRate;
            prevTime = nearPrevTime;
            // prevTime = ts - Const.InputDelay * Const.NetDt;
        }
    }

    const lastTic = gameTic - 1;
    receivedEvents = receivedEvents.filter(v => v.tic_ > lastTic);
    localEvents = localEvents.filter(v => v.tic_ > Math.min(ackMin, lastTic));

    return framesSimulated;
}

const sendInput = () => {
    const lastTic = gameTic - 1;
    for (const [id, rc] of remoteClients) {
        if (isChannelOpen(rc)) {
            const cl = requireClient(id);
            const packet: Packet = {
                client_: getClientId(),
                events_: [],
                checkSeed_: state.seed_,
                checkTic_: lastTic,
                checkNextId_: state.nextId_,
                // t: lastTic + simTic + Const.InputDelay,
                tic_: lastTic,
                // send to Client info that we know already
                receivedOnSender_: lastTic,
                sync_: false,
            };
            //if () {
            packet.tic_ = getNextInputTic(lastTic);
            packet.receivedOnSender_ = cl.tic_;
            packet.sync_ = cl.isPlaying_;
            if (packet.tic_ > cl.acknowledgedTic_) {
                packet.events_ = localEvents.filter(e => e.tic_ > cl.acknowledgedTic_ && e.tic_ <= packet.tic_);
                if (!cl.ready_) {
                    packet.state_ = state;
                } else if (cl.isPlaying_) {
                    if (debugStateEnabled) {
                        packet.state_ = state;
                        packet.checkState_ = debugState;
                    }
                }
                // if(packet.events_.length) {
                //     console.info("SEND: " + JSON.stringify(packet.events_));
                // }
                channels_sendObjectData(rc, pack(packet));
            }
            // if(!cl.isPlaying_) {
            //     packet.state_ = state;
            //     // packet.events_ = localEvents;
            //     //packet.events_ = localEvents.concat(receivedEvents).filter(e => e.tic_ > lastTic);
            //     channels_sendObjectData(rc, pack(packet));
            // }
        }
    }
}

const getMinTic = () => {
    let minTic = 0xFFFFFFFF;
    for (const [, cl] of clients) {
        if (minTic > cl.tic_) {
            minTic = cl.tic_;
        }
    }
    return minTic;
}

const processPacket = (sender: Client, data: Packet) => {
    if (startTic < 0 && data.state_) {
        if (data.checkTic_ > getMinTic()) {
            startTic = data.checkTic_;
            prevTime = lastFrameTs - 1 / Const.NetFq;
            gameTic = data.checkTic_ + 1;
            netTic = 0;
            state = data.state_;
            recreateMap();
        }

        // sender.tic_ = data.tic_;
        // sender.acknowledgedTic_ = data.receivedOnSender_;
        // for (const e of data.events_) {
        //     const cld = requireClient(e.client_);
        //     if (cld.tic_ < e.tic_) {
        //         cld.tic_ = e.tic_;
        //     }
        //     cld.acknowledgedTic_ = data.receivedOnSender_;
        //     receivedEvents.push(e);
        // }
        for (const cl of clients) {

        }
    }
    // } else {
    if (startTic > 0 && process.env.NODE_ENV === "development") {
        if (data.checkTic_ === (gameTic - 1)) {
            if (data.checkSeed_ !== _SEED) {
                console.warn("seed mismatch from client " + data.client_ + " at tic " + data.checkTic_);
                console.warn(data.checkSeed_ + " != " + _SEED);
            }
            if (data.checkNextId_ !== state.nextId_) {
                console.warn("gen id mismatch from client " + data.client_ + " at tic " + data.checkTic_);
                console.warn(data.checkNextId_ + " != " + state.nextId_);
            }
            if (debugStateEnabled) {
                if (data.checkState_ && debugState) {
                    assertStateEquality("[DEBUG] ", debugState, data.checkState_);
                }
                if (data.state_) {
                    assertStateEquality("[FINAL] ", state, data.state_);
                }
            }
        }
    }

    sender.ready_ = data.sync_;
    // ignore old packets
    if (data.tic_ > sender.tic_) {
        sender.isPlaying_ = true;
        // const debug = [];
        for (const e of data.events_) {
            if (e.tic_ > sender.tic_ /*alreadyReceivedTic*/) {
                receivedEvents.push(e);
                // debug.push(e);
            }
        }
        // if(debug.length) {
        //     console.info("R: " + JSON.stringify(debug));
        // }
        sender.tic_ = data.tic_;
    }
    // IMPORTANT TO NOT UPDATE ACK IF WE GOT OLD PACKET!! WE COULD TURN REMOTE TO THE PAST
    // just update last ack, now we know that Remote got `acknowledgedTic` amount of our tics,
    // then we will send only events from [acknowledgedTic + 1] index
    if (sender.acknowledgedTic_ < data.receivedOnSender_) {
        // update ack
        sender.acknowledgedTic_ = data.receivedOnSender_;
    }
    // }
}

export const onRTCPacket = (from: ClientID, buffer: ArrayBuffer) => {
    const data = unpack(buffer);
    if (data) {
        processPacket(requireClient(from), data);
    }
    if (document.hidden) {
        updateFrameTime(performance.now() / 1000);
        if (tryRunTicks(lastFrameTs)) {
            sendInput();
            cleaningUpClients();
        }
    }
}

let disconnectTimes = 0;

const cleaningUpClients = () => {
    for (const [id,] of clients) {
        //if (!isChannelOpen(remoteClients.get(id))) {
        if (!remoteClients.has(id)) {
            clients.delete(id);
        }
    }

    if (joined) {
        for (const [id, rc] of remoteClients) {
            if (clients.get(id)?.isPlaying_ &&
                (rc.pc_?.iceConnectionState[1] != "o" || rc.dc_?.readyState[0] != "o")) {
                if (++disconnectTimes > 60 * 5) {
                    disconnect();
                    alert("Connection lost");
                }
                return;
            }
        }
    }
    disconnectTimes = 0;
}

/// Game logic

const processTicCommands = (commands: ClientEvent[]) => {
    for (const cmd of commands) {
        const source = cmd.client_;
        if (cmd.btn_ !== undefined) {
            const player = getPlayerByClient(source);
            if (player) {
                player.btn_ = cmd.btn_;
            } else if (cmd.btn_ & ControlsFlag.Spawn) {
                const p = newActorObject(ActorType.Player);
                p.client_ = source;
                setRandomPosition(p);
                // p.x_ /= 10;
                // p.y_ /= 10;
                p.hp_ = 10;
                p.btn_ = cmd.btn_;
                p.weapon_ = 1 + rand(3);//Const.StartWeapon;
                pushActor(p);
            }
        }
    }
}

const sortById = (list: Actor[]) =>
    list.sort((a, b) => a.id_ - b.id_);

const sortList = (list: Actor[]) =>
    list.sort((a, b) => BOUNDS_SIZE * (a.y_ - b.y_) + a.x_ - b.x_);

const pickItem = (item: Actor, player: Actor) => {
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

const updateGameCamera = () => {
    let cameraScale = BASE_RESOLUTION / Math.min(gl.drawingBufferWidth, gl.drawingBufferHeight);
    let cameraX = BOUNDS_SIZE >> 1;
    let cameraY = BOUNDS_SIZE >> 1;
    const p0 = getMyPlayer();
    if (p0) {
        const wpn = weapons[p0.weapon_];
        cameraX = p0.x_ + (wpn.cameraLookForward_ - wpn.cameraFeedback_ * cameraFeedback) * (lookAtX - p0.x_);
        cameraY = p0.y_ + (wpn.cameraLookForward_ - wpn.cameraFeedback_ * cameraFeedback) * (lookAtY - p0.y_);
        cameraScale *= wpn.cameraScale_;
    }
    gameCamera[0] = lerp(gameCamera[0], cameraX, 0.1);
    gameCamera[1] = lerp(gameCamera[1], cameraY, 0.1);
    gameCamera[2] = lerp(gameCamera[2], cameraScale, 0.05);
}

const simulateTic = () => {
    for (const a of state.actors_) {
        sortById(a);
        roundActors(a);
    }

    processTicCommands(getTicCommands(gameTic));

    //if(startTick < 0) return;
    updateGameCamera();

    for (const a of state.actors_[ActorType.Player]) {
        updatePlayer(a);
    }

    if (debugStateEnabled) {
        debugState = cloneState();
        debugState.seed_ = _SEED;
        for (const a of debugState.actors_) roundActors(a);
    }

    for (const a of state.actors_[ActorType.Player]) {
        updateActorPhysics(a);
    }

    for (const a of state.actors_[ActorType.Barrel]) updateActorPhysics(a);
    for (const a of state.actors_[ActorType.Item]) {
        updateActorPhysics(a);
        if (!a.animHit_) {
            for (const player of state.actors_[ActorType.Player]) {
                if (testIntersection(a, player)) {
                    pickItem(a, player);
                }
            }
        }
    }

    for (const bullet of state.actors_[ActorType.Bullet]) {
        updateBody(bullet, 0, 0);
        if (bullet.hp_ && collideWithBoundsA(bullet)) {
            --bullet.hp_;
        }
        updateBulletCollision(bullet, state.actors_[ActorType.Player]);
        updateBulletCollision(bullet, state.actors_[ActorType.Barrel]);
        updateBulletCollision(bullet, trees);
        if (bullet.btn_ === BulletType.Ray) {
            bullet.hp_ = -1;
        }
        if (bullet.s_ && !--bullet.s_) {
            bullet.hp_ = 0;
        }
    }
    for (const tree of trees) {
        updateAnim(tree);
    }
    updateParticles();

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
    cameraShake = reach(cameraShake, 0, 0.02);
    cameraFeedback = reach(cameraFeedback, 0, 0.2);

    if (gameTic % 500 === 0) {
        const p = newActorObject(ActorType.Player);
        setRandomPosition(p);
        p.hp_ = 10;
        p.weapon_ = rand(weapons.length);
        pushActor(p);
    }

    if (lastAudioTic < gameTic) {
        lastAudioTic = gameTic;
    }

    for (const a of state.actors_) {
        sortById(a);
        roundActors(a);
    }

    state.seed_ = _SEED;
    ++gameTic;
}

const updateBodyInterCollisions2 = (list1: Actor[], list2: Actor[]) => {
    for (const a of list1) {
        updateBodyCollisions(a, list2, 0);
    }
}

const updateBodyInterCollisions = (list: Actor[]) => {
    for (let i = 0; i < list.length; ++i) {
        updateBodyCollisions(list[i], list, i + 1);
    }
}


const kill = (actor: Actor) => {
    playAt(actor, Snd.death);
    const amount = 1 + rand(3);
    for (let i = 0; i < amount; ++i) {
        const item = newItemRandomEffect();
        copyPosFromActorCenter(item, actor);
        addVelFrom(item, actor);
        const v = 32 + rand(64);
        addRadialVelocity(item, random(PI2), v, v);
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
        grave.w_ += 32;
        grave.hp_ = 20;
        grave.btn_ = 2;
        pushActor(grave);

        addFleshParticles(64, actor, 256, grave);
        addBoneParticles(32, actor, grave);
    }
}

const hitWithBullet = (actor: Actor, bullet: Actor) => {
    addVelFrom(actor, bullet, 0.1);
    actor.animHit_ = ANIM_HIT_MAX;
    playAt(actor, Snd.hit);
    if (actor.hp_) {
        actor.hp_ -= bullet.weapon_;
        if (!actor.type_) {
            addFleshParticles(16, actor, 64, bullet);
            playAt(actor, Snd.hurt);
        }
        if (actor.hp_ <= 0) {
            // could be effect if damage is big
            actor.hp_ = 0;
            kill(actor);

            const killerID = bullet.client_;
            if (killerID && !actor.type_) {
                state.scores_[killerID] = (state.scores_[killerID] | 0) +
                    (actor.client_ ? 10 : 1);
            }
        }
    }
    if (bullet.hp_ && bullet.btn_ !== BulletType.Ray) {
        --bullet.hp_;
        if (bullet.hp_) {
            let nx = bullet.x_ - actor.x_;
            let ny = bullet.y_ - actor.y_;
            const dist = Math.sqrt(nx * nx + ny * ny);
            if (dist > 0) {
                nx /= dist;
                ny /= dist;
                reflectVelocity(bullet, nx, ny, 1);
                const pen = OBJECT_RADIUS_BY_TYPE[actor.type_] + BULLET_RADIUS + 1;
                bullet.x_ = actor.x_ + pen * nx;
                bullet.y_ = actor.y_ + pen * ny;
            }
        }
    }
}

const updateBulletCollision = (b: Actor, list: Actor[]) => {
    if (b.hp_) {
        for (const a of list) {
            const owned = !(a.client_ - b.client_);
            if (!owned) {
                if (b.btn_ === BulletType.Ray && b.hp_ > 0) {
                    if (testRayWithSphere(b, a, b.u_, b.v_)) {
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

const unpackAngleByte = (angleByte: number, res: number) =>
    PI2 * (angleByte & (res - 1)) / res - PI;

const packAngleByte = (y: number, x: number, res: number) =>
    (res * (PI + Math.atan2(y, x)) / PI2) & (res - 1);

const updateAI = (player: Actor) => {
    const md = rand(ControlsFlag.MoveAngleMax);
    player.btn_ = (md << ControlsFlag.MoveAngleBit) | ControlsFlag.Move;
    if (player.hp_ < 10) {
        player.btn_ |= ControlsFlag.Drop | ControlsFlag.Run;
    }
    if (!rand(20) && player.hp_ < 7) player.btn_ |= ControlsFlag.Jump;
}

const updatePlayer = (player: Actor) => {
    if (!player.client_) updateAI(player);
    let grounded = player.z_ == 0 && player.w_ == 0;
    if (player.btn_ & ControlsFlag.Jump) {
        if (grounded) {
            player.z_ = 1;
            player.w_ = JUMP_VEL;
            grounded = false;
            playAt(player, Snd.jump);
        }
    }
    const c = (grounded ? 16 : 8) / Const.NetFq;
    const moveAngle = unpackAngleByte(player.btn_ >> ControlsFlag.MoveAngleBit, ControlsFlag.MoveAngleMax);
    const lookAngle = unpackAngleByte(player.btn_ >> ControlsFlag.LookAngleBit, ControlsFlag.LookAngleMax);
    const moveDirX = Math.cos(moveAngle);
    const moveDirY = Math.sin(moveAngle);
    const lookDirX = Math.cos(lookAngle);
    const lookDirY = Math.sin(lookAngle);
    if (player.btn_ & ControlsFlag.Move) {
        const speed = (player.btn_ & ControlsFlag.Run) ? 2 : 1;
        const vel = speed * 60;
        player.u_ = reach(player.u_, vel * moveDirX, vel * c);
        player.v_ = reach(player.v_, vel * moveDirY, vel * c);
        if (grounded && !(gameTic % (20 / speed))) {
            playAt(player, Snd.step);
        }
    } else {
        applyGroundFriction(player, 32 * c);
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
    if (player.btn_ & ControlsFlag.Shooting && player.weapon_) {
        player.s_ = reach(player.s_, 0, weapon.rate_ / Const.NetFq);
        if (!player.s_) {
            cameraShake = Math.max(weapon.cameraShake_, cameraShake);
            player.s_ = 1;
            cameraFeedback = 1;
            player.t_ = reach(player.t_, 1, weapon.detuneSpeed_ / Const.NetFq);
            addVelocityDir(player, lookDirX, lookDirY, -1, player.w_ > 0 ? 0 : -weapon.kickBack_);
            playAt(player, Snd.shoot);
            for (let i = 0; i < weapon.spawnCount_; ++i) {
                const a = lookAngle +
                    weapon.angleVar_ * (nextFloat() - 0.5) +
                    weapon.angleSpread_ * Math.min(1, player.t_) * (nextFloat() - 0.5);
                const dx = Math.cos(a);
                const dy = Math.sin(a);
                const bulletVelocity = weapon.velocity_ + weapon.velocityVar_ * (nextFloat() - 0.5);
                const bullet = newActorObject(ActorType.Bullet);
                bullet.client_ = player.client_;
                copyPosFromActorCenter(bullet, player);
                addPos(bullet, dx, dy, 0, weapon.offset_);
                bullet.z_ += PLAYER_HANDS_Z - 12 + weapon.offsetZ_;
                addVelocityDir(bullet, dx, dy, 0, bulletVelocity);
                bullet.weapon_ = weapon.bulletDamage_;
                bullet.btn_ = weapon.bulletType_;
                bullet.hp_ = weapon.bulletHp_;
                bullet.s_ = weapon.bulletLifetime_;
                pushActor(bullet);
            }

            if (weapon.bulletType_) {
                addShellParticle(player, PLAYER_HANDS_Z + weapon.offsetZ_, weapon.bulletShellColor_);
            }
        }
    } else {
        player.t_ = reach(player.t_, 0, 0.3);
        player.s_ = reach(player.s_, weapon.launchTime_, weapon.relaunchSpeed_ / Const.NetFq);
    }
}

export const spawnFleshParticles = (actor: Actor, expl: number, amount: number, vel?: Vel) => {
    addFleshParticles(amount, actor, expl, vel);
}

const getTicCommands = (tic: number): ClientEvent[] => {
    const locEvents = localEvents.filter(v => v.tic_ === tic);
    const recEvents = receivedEvents.filter(v => v.tic_ === tic);
    const events = locEvents.concat(recEvents);
    events.sort((a, b) => a.client_ - b.client_);
    return events;
}

const cloneState = (): StateData => ({
    nextId_: state.nextId_,
    seed_: state.seed_,
    mapSeed_: state.mapSeed_,
    actors_: state.actors_.map(list => list.map(a => ({...a}))),
    scores_: {...state.scores_}
});

const beginPrediction = (): boolean => {
    // if (!Const.Prediction || time < 0.001) return false;
    if (!Const.Prediction) return false;

    // global state
    let frames = Math.min(1, lastFrameTs - prevTime) * Const.NetFq | 0;
    if (!frames) return false;

    // save particles
    saveParticles();

    // save state
    lastState = state;
    state = cloneState();
    const savedGameTic = gameTic;

    // && gameTic <= lastInputTic
    while (frames--) {
        simulateTic();
    }

    gameTic = savedGameTic;
    return true;
}

const endPrediction = () => {
    // global state
    state = lastState;
    setSeed(state.seed_);

    // restore particles
    restoreParticles();
}

/*** DRAWING ***/

const drawGame = () => {
    camera.scale_ = 1 / gameCamera[2];
    camera.toX_ = camera.toY_ = 0.5;
    camera.atX_ = gameCamera[0] + ((Math.random() - 0.5) * cameraShake * 8) | 0;
    camera.atY_ = gameCamera[1] + ((Math.random() - 0.5) * cameraShake * 8) | 0;
    camera.angle_ = (Math.random() - 0.5) * cameraShake / 8;

    beginRender();
    gl.clearColor(0.2, 0.2, 0.2, 1.0);
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

const drawOverlay = () => {
    camera.scale_ = Math.min(gl.drawingBufferWidth, gl.drawingBufferHeight) / BASE_RESOLUTION;
    camera.toX_ = camera.toY_ = camera.atX_ = camera.atY_ = camera.angle_ = 0;
    beginRender();
    drawVirtualPad();
    flush()
}

const drawShadows = () => {
    const SHADOW_SCALE = [1, 1, 2, 1, 1];
    const SHADOW_ADD = [0, 0, 1, 0, 0];
    const SHADOW_COLOR = [0, 0, 0x333333, 0, 0];

    for (const actor of drawList) {
        const type = actor.type_;
        const shadowScale = (2 - actor.z_ / 64.0) * SHADOW_SCALE[type];
        const additive = SHADOW_ADD[type];
        const color = SHADOW_COLOR[type];
        draw(img[Img.circle_4], actor.x_, actor.y_, 0, shadowScale, shadowScale / 4, .4, color, additive);
    }
}

const drawList: Actor[] = [];

const collectVisibleActors = (...lists: Actor[][]) => {
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
            if ((a.x_ > l && a.x_ < r && a.y_ > t && a.y_ < b) ||
                (a.type_ == ActorType.Bullet && a.btn_ == BulletType.Ray)) {
                drawList.push(a);
            }
        }
    }
}

const drawMapBackground = () => {
    draw(mapTexture, 0, 0);
    // draw(img[Img.box_lt], 0, -objectRadiusUnit * 5, 0, boundsSize + 2, objectRadiusUnit * 4, 1, 0x666666);
    draw(img[Img.box_lt], 0, -OBJECT_RADIUS * 3, 0, BOUNDS_SIZE + 2, OBJECT_RADIUS * 4, 0.5, 0);
}

const drawMapOverlay = () => {
    draw(img[Img.box_lt], 0, BOUNDS_SIZE - OBJECT_RADIUS * 2, 0, BOUNDS_SIZE + 2, OBJECT_RADIUS * 4, 1, 0x666666);
    // draw(img[Img.box_lt], -objectRadiusUnit * 2, -objectRadiusUnit * 2, 0, objectRadiusUnit * 2, boundsSize + objectRadiusUnit * 4, 1, 0x666666);
    // draw(img[Img.box_lt], boundsSize, -objectRadiusUnit * 2, 0, objectRadiusUnit * 2, boundsSize + objectRadiusUnit * 4, 1, 0x666666);
}

const drawCrosshair = () => {
    const p0 = getMyPlayer();
    if (p0 && (viewX || viewY)) {
        const len = 4 + 0.25 * Math.sin(2 * lastFrameTs) * Math.cos(4 * lastFrameTs) + 4 * Math.min(1, p0.t_) + 4 * Math.min(1, p0.s_);
        let a = 0.1 * lastFrameTs;
        for (let i = 0; i < 4; ++i) {
            draw(img[Img.box_t1], lookAtX, lookAtY, a, 2, len, 0.5);
            a += PI / 2;
        }
    }
}

const drawItem = (item: Actor) => {
    const colorOffset = getHitColorOffset(item.animHit_);
    const cat = item.btn_ & 0x300;
    const idx = item.btn_ & 0xFF;
    if (cat === ItemCategory.Weapon) {
        const weapon = img[Img.weapon0 + idx];
        if (weapon) {
            const px = weapon.x_;
            const py = weapon.y_;
            weapon.x_ = 0.5;
            weapon.y_ = 0.7;
            draw(weapon, item.x_, item.y_ - item.z_, 0, 0.8, 0.8, 1, COLOR_WHITE, 0, colorOffset);
            weapon.x_ = px;
            weapon.y_ = py;
        }
    } else /*if (cat === ItemCategory.Effect)*/ {
        const anim = item.anim0_ / 0xFF;
        const s = 1 + 0.1 * Math.sin(16 * (lastFrameTs + anim * 10));
        const o = 2 * Math.cos(lastFrameTs + anim * 10);
        draw(img[Img.item0 + idx], item.x_, item.y_ - item.z_ - OBJECT_RADIUS - o, 0, s, s, 1, COLOR_WHITE, 0, colorOffset);
    }
}

const drawBullet = (actor: Actor) => {
    const BULLET_COLOR = [
        [0xFFFFFF],
        [0xFFFF44],
        [0x44FFFF],
        [0x333333],
        [0xFF0000, 0x00FF00, 0x00FFFF, 0xFFFF00, 0xFF00FF]
    ];

    const BULLET_LENGTH = [0.2, 2, 1, 8, 512];
    const BULLET_LENGTH_LIGHT = [0.1, 2, 2, 2, 512];
    const BULLET_SIZE = [6, 3 / 2, 2, 4, 12];
    const BULLET_PULSE = [0, 0, 1, 0, 0];
    const BULLET_IMAGE = [
        Img.circle_4_60p, Img.circle_4_70p, Img.box,
        Img.circle_4_60p, Img.circle_4_70p, Img.box,
        Img.circle_4_60p, Img.circle_4_70p, Img.box,
        Img.box_r, Img.box_r, Img.box_r,
        Img.box_l, Img.box_l, Img.box_l,
    ];

    const x = actor.x_;
    const y = actor.y_ - actor.z_;
    const a = Math.atan2(actor.v_, actor.u_);
    const type = actor.btn_;
    const color = fxRandElement(BULLET_COLOR[type] as number[]);
    const longing = BULLET_LENGTH[type];
    const longing2 = BULLET_LENGTH_LIGHT[type];
    const sz = BULLET_SIZE[type] +
        BULLET_PULSE[type] * Math.sin(32 * lastFrameTs + actor.anim0_) / 2;
    let res = type * 3;

    draw(img[BULLET_IMAGE[res++]], x, y, a, sz * longing, sz, 0.1, COLOR_WHITE, 1);
    draw(img[BULLET_IMAGE[res++]], x, y, a, sz * longing / 2, sz / 2, 1, color);
    draw(img[BULLET_IMAGE[res++]], x, y, a, 2 * longing2, 2);
}

const drawPlayer = (p: Actor): void => {
    const co = getHitColorOffset(p.animHit_);
    const imgHead = p.client_ ? (Img.avatar0 + (debugCheckAvatar + p.anim0_) % Img.num_avatars) : (Img.npc0 + p.anim0_ % Img.num_npc);
    const colorC = COLOR_BODY[p.anim0_ % COLOR_BODY.length];
    const colorArm = colorC;
    const colorBody = colorC;
    const x = p.x_;
    const y = p.y_ - p.z_;
    const speed = Math.hypot(p.u_, p.v_, p.w_);
    const runK = (p.btn_ & ControlsFlag.Run) ? 1 : 0.8;
    const walk = Math.min(1, speed / 100);
    let base = -0.5 * walk * 0.5 * (1.0 + Math.sin(40 * runK * lastFrameTs));
    const idle_base = (1 - walk) * ((1 + Math.sin(10 * lastFrameTs) ** 2) / 4);
    base += idle_base;
    const leg1 = 5 - 4 * walk * 0.5 * (1.0 + Math.sin(40 * runK * lastFrameTs));
    const leg2 = 5 - 4 * walk * 0.5 * (1.0 + Math.sin(40 * runK * lastFrameTs + PI));

    /////

    const wpn = weapons[p.weapon_];
    let viewAngle = unpackAngleByte(p.btn_ >> ControlsFlag.LookAngleBit, ControlsFlag.LookAngleMax);
    const weaponBaseAngle = wpn.gfxRot_;
    const weaponBaseScaleX = wpn.gfxSx_;
    const weaponBaseScaleY = 1;
    let weaponX = x;
    let weaponY = y - PLAYER_HANDS_Z;
    let weaponAngle = Math.atan2(
        y + 1000 * Math.sin(viewAngle) - weaponY,
        x + 1000 * Math.cos(viewAngle) - weaponX
    );
    let weaponSX = weaponBaseScaleX;
    let weaponSY = weaponBaseScaleY;
    let weaponBack = 0;
    if (weaponAngle < -0.2 && weaponAngle > -PI + 0.2) {
        weaponBack = 1;
        //weaponY -= 16 * 4;
    }
    const A = Math.sin(weaponAngle - PI);
    let wd = 6 + 12 * (weaponBack ? (A * A) : 0);
    let wx = 1;
    if (weaponAngle < -PI * 0.5 || weaponAngle > PI * 0.5) {
        wx = -1;
    }
    if (wpn.handsAnim_) {
        // const t = Math.max(0, (p.s - 0.8) * 5);
        // anim := 1 -> 0
        const t = Math.min(1, wpn.launchTime_ > 0 ? (p.s_ / wpn.launchTime_) : Math.max(0, (p.s_ - 0.5) * 2));
        wd += Math.sin(t * PI) * wpn.handsAnim_;
        weaponAngle -= -wx * PI * 0.25 * Math.sin((1 - (1 - t) ** 2) * PI2);
    }
    weaponX += wd * Math.cos(weaponAngle);
    weaponY += wd * Math.sin(weaponAngle);

    if (wx < 0) {
        weaponSX *= wx;
        weaponAngle -= PI + 2 * weaponBaseAngle;
    }

    weaponAngle += weaponBaseAngle;

    if (weaponBack && p.weapon_) {
        draw(img[Img.weapon0 + p.weapon_], weaponX, weaponY, weaponAngle, weaponSX, weaponSY);
    }

    draw(img[Img.box_t], x - 3, y - 5, 0, 2, leg1, 1, colorArm, 0, co);
    draw(img[Img.box_t], x + 3, y - 5, 0, 2, leg2, 1, colorArm, 0, co);
    draw(img[Img.box], x, y - 7 + base, 0, 8, 6, 1, colorBody, 0, co);

    {
        const s = p.w_ * 0.002;
        const a = 0.002 * p.u_;
        draw(img[imgHead], x, y - 16 + base * 2, a, 1 - s, 1 + s, 1, COLOR_WHITE, 0, co);
    }

    // DRAW HANDS
    const rArmX = x + 4;
    const lArmX = x - 4;
    const armY = y - PLAYER_HANDS_Z + base * 2;
    const rArmRot = Math.atan2(weaponY - armY, weaponX - rArmX);
    const lArmRot = Math.atan2(weaponY - armY, weaponX - lArmX);
    const lArmLen = Math.hypot(weaponX - lArmX, weaponY - armY) - 1;
    const rArmLen = Math.hypot(weaponX - rArmX, weaponY - armY) - 1;

    if (p.weapon_) {
        draw(img[Img.box_l], x + 4, y - 10 + base, rArmRot, rArmLen, 2, 1, colorArm, 0, co);
        draw(img[Img.box_l], x - 4, y - 10 + base, lArmRot, lArmLen, 2, 1, colorArm, 0, co);
    } else {
        let sw1 = walk * Math.sin(20 * runK * lastFrameTs);
        let sw2 = walk * Math.cos(20 * runK * lastFrameTs);
        let armLen = 5;
        if (!p.client_ && p.hp_ < 10) {
            sw1 -= PI / 2;
            sw2 += PI / 2;
            armLen += 4;
        }
        draw(img[Img.box_l], x + 4, y - 10 + base, sw1 + PI / 4, armLen, 2, 1, colorArm, 0, co);
        draw(img[Img.box_l], x - 4, y - 10 + base, sw2 + PI - PI / 4, armLen, 2, 1, colorArm, 0, co);
    }

    if (!weaponBack && p.weapon_) {
        draw(img[Img.weapon0 + p.weapon_], weaponX, weaponY, weaponAngle, weaponSX, weaponSY);
    }
}

const getHitColorOffset = (anim: number) =>
    getLumaColor32(0xFF * Math.min(1, 2 * anim / ANIM_HIT_MAX));

const drawObject = (p: Actor, id: Img) => {
    const x = p.x_;
    const y = p.y_ - p.z_;
    const co = getHitColorOffset(p.animHit_);
    draw(img[id], x, y, 0, 1, 1, 1, COLOR_WHITE, 0, co);
}

const drawBarrel = (p: Actor): void => drawObject(p, p.btn_ + Img.barrel0);
const drawTree = (p: Actor): void => drawObject(p, p.btn_ + Img.tree0);

const DRAW_BY_TYPE: ((p: Actor) => void)[] = [
    drawPlayer,
    drawBarrel,
    drawBullet,
    drawItem,
    drawTree,
];

const drawObjects = () => {
    drawSplats();
    drawParticles();
    collectVisibleActors(trees, ...state.actors_);
    sortList(drawList);
    drawShadows();
    for (const actor of drawList) {
        DRAW_BY_TYPE[actor.type_](actor);
    }
}
/// SOUND ENV ///

const playAt = (actor: Actor, id: Snd) => {
    if (gameTic >= lastAudioTic) {
        let lx = BOUNDS_SIZE / 2;
        let ly = BOUNDS_SIZE / 2;
        const p0 = getMyPlayer();
        if (p0) {
            lx = p0.x_;
            ly = p0.y_;
        }

        const dx = (actor.x_ - lx) / 256;
        const dy = (actor.y_ - ly) / 256;
        const v = 1 - Math.hypot(dx, dy);
        if (v > 0) {
            const pan = Math.max(-1, Math.min(1, dx));
            play(snd[id], v, pan, false);
        }
    }
}

//// DEBUG UTILITIES ////

let debugState: StateData;
let debugStateEnabled = false;
let drawCollisionEnabled = false;
let debugCheckAvatar = 0;
let prevSimulatedTic = 0;

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

const printDebugInfo = () => {
    let text = gameTic > prevSimulatedTic ? "🌐" : "🥶";
    const ticsAhead = (lastFrameTs - prevTime) * Const.NetFq | 0;
    const ticsPrediction = Math.min(Const.NetFq, ticsAhead);
    if (ticsPrediction) text += "🔮";
    text += `~ ${ticsPrediction} of ${ticsAhead}\n`;
    prevSimulatedTic = gameTic;

    if (_debugLagK) {
        text += "debug-lag K: " + _debugLagK + "\n";
    }
    text += "visible: " + drawList.length + "\n";
    text += "players: " + state.actors_[ActorType.Player].length + "\n";
    text += "barrels: " + state.actors_[ActorType.Barrel].length + "\n";
    text += "items: " + state.actors_[ActorType.Item].length + "\n";
    text += "bullets: " + state.actors_[ActorType.Bullet].length + "\n";
    text += "trees: " + trees.length + "\n";

    text += `┌ ${getUserName()} | game: ${gameTic}, net: ${netTic}\n`;
    for (const [, remoteClient] of remoteClients) {
        const pc = remoteClient.pc_;
        const dc = remoteClient.dc_;
        const cl = clients.get(remoteClient.id_);
        text += "├ " + remoteClient.name_ + remoteClient.id_;
        text += pc ? (icons_iceState[pc.iceConnectionState] ?? "❓") : "🧿";
        text += dc ? icons_channelState[dc.readyState] : "🧿";
        if (cl) {
            text += `+${cl.tic_ - (gameTic - 1)}`;
            text += "| x" + getChannelPacketSize(remoteClient).toString(16);
        }
        text += "\n";
    }
    termPrint(text + "\n");
}

const checkDebugInput = () => {
    if (keyboardDown.has("Digit1")) {
        ++debugCheckAvatar;
    }
    if (keyboardDown.has("Digit2")) {
        drawCollisionEnabled = !drawCollisionEnabled;
    }
    if (keyboardDown.has("Digit3")) {
        setDebugLagK((_debugLagK + 1) % 3);
    }
    if (keyboardDown.has("Digit4")) {
        debugStateEnabled = !debugStateEnabled;
    }
}

const drawActorBoundingSphere = (p: Actor) => {
    const r = OBJECT_RADIUS_BY_TYPE[p.type_];
    const h = OBJECT_HEIGHT[p.type_];
    const x = p.x_;
    const y = p.y_ - p.z_ - h;
    const s = r / 16;
    draw(img[Img.box_t], x, y, 0, 1, p.z_ + h);
    draw(img[Img.circle_16], x, y, 0, s, s, 0.5, 0xFF0000);
}

const drawCollisions = () => {
    if (drawCollisionEnabled) {
        for (const p of drawList) {
            drawActorBoundingSphere(p);
        }
    }
}

const assertStateEquality = (label: string, a: StateData, b: StateData) => {

    if (a.nextId_ != b.nextId_) {
        console.warn(label + "NEXT ID MISMATCH", a.nextId_, b.nextId_);
    }
    if (a.seed_ != b.seed_) {
        console.warn(label + "SEED MISMATCH", a.seed_, b.seed_);
    }
    if (a.mapSeed_ != b.mapSeed_) {
        console.warn(label + "MAP SEED MISMATCH", a.mapSeed_, b.mapSeed_);
    }
    for (let i = 0; i < a.actors_.length; ++i) {
        const listA = a.actors_[i];
        const listB = b.actors_[i];
        if (listA.length == listB.length) {
            for (let j = 0; j < listA.length; ++j) {
                const actorA = listA[j];
                const actorB = listB[j];
                const fields = [
                    "x",
                    "y",
                    "z",
                    "u",
                    "v",
                    "w",
                    "s",
                    "t",
                    "id_",
                    "type_",
                    "client_",
                    "btn_",
                    "weapon_",
                    "hp_",
                    "anim0_",
                    "animHit_",
                ];
                for (const f of fields) {
                    if ((actorA as any)[f] !== (actorB as any)[f]) {
                        console.warn(label + "ACTOR DATA mismatch, field: " + f);
                        console.warn("    MY: " + f + " = " + (actorA as any)[f]);
                        console.warn("REMOTE: " + f + " = " + (actorB as any)[f]);
                    }
                }
            }
        } else {
            console.warn(label + "ACTOR LIST " + i + " SIZE MISMATCH", listA.length, listB.length);
        }
    }
}