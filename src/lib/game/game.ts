import {ClientID} from "../../shared/types";
import {clientId, disconnect, clientName, isPeerConnected, remoteClients} from "../net/messaging";
import {play, speak} from "../audio/context";
import {beginRenderToMain, clear, draw, flush, gl} from "../graphics/draw2d";
import {_SEEDS, fxRand, fxRandElement, fxRandomNorm, rand, random} from "../utils/rnd";
import {channels_sendObjectData} from "../net/channels_send";
import {EMOJI, img, Img} from "../assets/gfx";
import {Const} from "./config";
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
import {getLumaColor32, lerp, M, PI, PI2, reach} from "../utils/math";
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
import {isAnyKeyDown} from "../utils/input";
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
    OBJECT_RADIUS,
    OBJECT_RADIUS_BY_TYPE,
    PLAYER_HANDS_Z,
} from "./data/world";
import {COLOR_BODY, COLOR_WHITE} from "./data/colors";
import {termPrint} from "../graphics/ui";
import {beginFogRender, renderFog, renderFogObjects} from "./fog";
import {
    addDebugState,
    assertStateInSync,
    drawCollisions,
    printDebugInfo,
    saveDebugState,
    updateDebugInput
} from "./debug";

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
    if (!clients.has(id)) {
        clients.set(id, {id_: id, tic_: 0, acknowledgedTic_: 0});
    }
    return clients.get(id);
}

export const resetGame = () => {
    clients.clear();
    localEvents.length = 0;
    receivedEvents.length = 0;

    state = newStateData();
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
}

const recreateMap = () => {
    // generate map
    _SEEDS[0] = state.mapSeed_;
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
    _SEEDS[0] = state.seed_;
    state.nextId_ = nextId;
}

const pushActor = (a: Actor) => {
    state.actors_[a.type_].push(a);
}

const createSeedGameState = () => {
    startTic = 0;
    gameTic = 0;
    netTic = 0;
    state.mapSeed_ = state.seed_ = _SEEDS[0];
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
}

export const createSplashState = () => {
    recreateMap();
    for (let i = 0; i < 13; ++i) {
        const k = i / 13;
        const actor = newActorObject(ActorType.Player);
        actor.client_ = 1 + i;
        actor.weapon_ = 1 + (i % (weapons.length - 1));
        actor.anim0_ = i + rand(10) * Img.num_avatars;
        actor.btn_ = packAngleByte(k, ControlsFlag.LookAngleMax) << ControlsFlag.LookAngleBit;
        const D = 80 + rand(20);
        actor.x_ = BOUNDS_SIZE / 2 + D * M.cos(k * PI2);
        actor.y_ = BOUNDS_SIZE / 2 + D * M.sin(k * PI2);
        pushActor(actor);
    }
    gameCamera[0] = gameCamera[1] = BOUNDS_SIZE / 2;
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
        printDebugInfo(gameTic, netTic, lastFrameTs, prevTime, drawList, state, trees, clients);
    }
}

const printStatus = () => {
    if (clientId) {
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

        termPrint(getPlayerIcon(clientId) + " " + clientName + " | ☠️" + (state.scores_[clientId] | 0) + "\n");
        for (const [id, rc] of remoteClients) {
            let status = "🔴";
            if (isPeerConnected(rc)) {
                status = getPlayerIcon(rc.id_);
            }
            termPrint(status + " " + rc.name_ + " | ☠️" + (state.scores_[id] | 0) + "\n");
        }
    }
}

const getMyPlayer = (): Actor | undefined =>
    getPlayerByClient(clientId);

const getPlayerByClient = (c: ClientID): Actor | undefined =>
    state.actors_[ActorType.Player].find(p => p.client_ == c);

const getLocalEvent = (tic: number, _e?: ClientEvent): ClientEvent => {
    if (!(_e = localEvents.find(e => e.tic_ == tic))) {
        _e = {tic_: tic, client_: clientId};
        localEvents.push(_e);
    }
    return _e;
}

const getNextInputTic = (tic: number) =>
    tic + M.max(
        Const.InputDelay,
        ((lastFrameTs - prevTime) * Const.NetFq) | 0
    );

const checkPlayerInput = () => {
    if (process.env.NODE_ENV === "development") {
        updateDebugInput();
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
            btn |= (packDirByte(moveX, moveY, ControlsFlag.MoveAngleMax) << ControlsFlag.MoveAngleBit) | ControlsFlag.Move;
            if (moveFast) {
                btn |= ControlsFlag.Run;
            }
        }

        if (viewX || viewY) {
            btn |= packDirByte(viewX, viewY, ControlsFlag.LookAngleMax) << ControlsFlag.LookAngleBit;
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
            if (isPeerConnected(rc)) {
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
    localEvents = localEvents.filter(v => v.tic_ > M.min(ackMin, lastTic));

    return framesSimulated;
}

const _packetBuffer = new Int32Array(1024 * 16);

const sendInput = () => {
    const lastTic = gameTic - 1;
    for (const [id, rc] of remoteClients) {
        if (isPeerConnected(rc)) {
            const cl = requireClient(id);
            const inputTic = getNextInputTic(lastTic);
            if (inputTic > cl.acknowledgedTic_) {
                const packet: Packet = {
                    sync_: cl.isPlaying_,
                    // send to Client info that we know already
                    receivedOnSender_: cl.tic_,
                    // t: lastTic + simTic + Const.InputDelay,
                    tic_: inputTic,
                    events_: localEvents.filter(e => e.tic_ > cl.acknowledgedTic_ && e.tic_ <= inputTic),
                };
                if (!cl.ready_) {
                    packet.state_ = state;
                }
                if (process.env.NODE_ENV === "development") {
                    packet.debug = {
                        nextId: state.nextId_,
                        tic: state.tic_,
                        seed: state.seed_,
                    };
                    addDebugState(cl, packet, state);
                }
                // if(packet.events_.length) {
                //     console.info("SEND: " + JSON.stringify(packet.events_));
                // }
                channels_sendObjectData(rc, pack(packet, _packetBuffer));
            }
        }
    }
}

const getMinTic = (minTic: number = 0x7FFFFFFF) => {
    for (const [, cl] of clients) {
        if (minTic > cl.tic_) {
            minTic = cl.tic_;
        }
    }
    return minTic;
}

const processPacket = (sender: Client, data: Packet) => {
    if (startTic < 0 && data.state_) {
        if (data.state_.tic_ > getMinTic()) {
            netTic = 0;
            prevTime = lastFrameTs - 1 / Const.NetFq;
            state = data.state_;
            gameTic = startTic = state.tic_ + 1;
            recreateMap();
        }
    }

    if (process.env.NODE_ENV === "development") {
        if (startTic > 0) {
            assertStateInSync(sender.id_, data, state, gameTic);
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
    processPacket(requireClient(from), unpack(from, new Int32Array(buffer)));
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
                    alert("connection lost");
                }
                return;
            }
        }
    }
    disconnectTimes = 0;
}

/// Game logic

const pickItem = (item: Actor, player: Actor) => {
    // isWeapon
    const itemId = item.btn_ & 0xFF;
    const itemCat = item.btn_ & 0x300;
    if (itemCat == ItemCategory.Weapon) {
        const playerHasNoWeapon = !player.weapon_;
        const playerNotDropping = !(player.btn_ & ControlsFlag.Drop);
        if (playerHasNoWeapon && playerNotDropping) {
            player.weapon_ = itemId;
            playAt(player, Snd.pick);
            item.hp_ = item.btn_ = 0;
        }
    } else /*if(itemCat == ItemCategory.Effect)*/ {
        if (itemId == EffectItemType.Med) {
            playAt(player, Snd.med);
            item.hp_ = item.btn_ = 0;
        } else if (itemId == EffectItemType.Health) {
            if (player.hp_ < 10) {
                ++player.hp_;
                playAt(player, Snd.heal);
                item.hp_ = item.btn_ = 0;
            }
        }
    }
}

const updateGameCamera = () => {
    const getRandomPlayer = () => {
        const l = state.actors_[ActorType.Player].filter(p => p.client_);
        return l.length ? l[((lastFrameTs / 5) | 0) % l.length] : undefined;
    }

    let cameraScale = BASE_RESOLUTION / M.min(gl.drawingBufferWidth, gl.drawingBufferHeight);
    let cameraX = BOUNDS_SIZE >> 1;
    let cameraY = BOUNDS_SIZE >> 1;
    const p0 = getMyPlayer() ?? getRandomPlayer();
    if (p0?.client_) {
        const wpn = weapons[p0.weapon_];
        cameraX = p0.x_ + (wpn.cameraLookForward_ - wpn.cameraFeedback_ * cameraFeedback) * (lookAtX - p0.x_);
        cameraY = p0.y_ + (wpn.cameraLookForward_ - wpn.cameraFeedback_ * cameraFeedback) * (lookAtY - p0.y_);
        cameraScale *= wpn.cameraScale_;
    } else {

    }
    gameCamera[0] = lerp(gameCamera[0], cameraX, 0.1);
    gameCamera[1] = lerp(gameCamera[1], cameraY, 0.1);
    gameCamera[2] = lerp(gameCamera[2], cameraScale, 0.05);
}

const simulateTic = () => {
    const sortById = (list: Actor[]) => list.sort((a, b) => a.id_ - b.id_);

    for (const a of state.actors_) {
        sortById(a);
        roundActors(a);
    }

    const processTicCommands = (tic_events: number | ClientEvent[]) => {
        tic_events = localEvents.concat(receivedEvents).filter(v => v.tic_ == tic_events);
        tic_events.sort((a, b) => a.client_ - b.client_);
        for (const cmd of tic_events) {
            if (cmd.btn_ !== undefined) {
                const player = getPlayerByClient(cmd.client_);
                if (player) {
                    player.btn_ = cmd.btn_;
                } else if (cmd.btn_ & ControlsFlag.Spawn) {
                    const p = newActorObject(ActorType.Player);
                    p.client_ = cmd.client_;
                    setRandomPosition(p);

                    if (clientId == cmd.client_) {
                        gameCamera[0] = p.x_;
                        gameCamera[1] = p.y_;
                    }
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
    processTicCommands(gameTic);

    //if(startTick < 0) return;
    updateGameCamera();

    for (const a of state.actors_[ActorType.Player]) {
        updatePlayer(a);
    }

    if (process.env.NODE_ENV === "development") {
        saveDebugState(cloneState());
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
        if (bullet.btn_ == BulletType.Ray) {
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

    if (clientId) {
        if (!(gameTic & 0x1ff)) {
            const p = newActorObject(ActorType.Player);
            setRandomPosition(p);
            p.hp_ = 10;
            p.weapon_ = rand(weapons.length);
            pushActor(p);
        }
    } else {
        // SPLASH SCREEN
        spawnFleshParticles({
            x_: fxRand(BOUNDS_SIZE),
            y_: fxRand(BOUNDS_SIZE),
            z_: fxRand(128),
            type_: 0
        } as any as Actor, 128, 1);
    }

    if (lastAudioTic < gameTic) {
        lastAudioTic = gameTic;
    }

    for (const a of state.actors_) {
        sortById(a);
        roundActors(a);
    }

    state.seed_ = _SEEDS[0];
    state.tic_ = gameTic++;
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
    if (actor.type_ == ActorType.Player) {
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

                const getNameById = (client: ClientID) => client == clientId ? clientName : remoteClients.get(client)?.name_;
                const a = getNameById(killerID);
                const b = getNameById(actor.client_);
                if (a) {
                    let t = b ? [
                        a + " CRUSHED " + b,
                        a + " destroyed " + b,
                        a + " killed " + b,
                        a + " took " + b + " life",
                    ] : [
                        "warm-up for " + a,
                        a + " killed someone",
                        "death by " + a,
                        a + " sows DEATH",
                    ]
                    speak(fxRandElement(t));
                }
            }
        }
    }
    if (bullet.hp_ && bullet.btn_ !== BulletType.Ray) {
        --bullet.hp_;
        if (bullet.hp_) {
            let nx = bullet.x_ - actor.x_;
            let ny = bullet.y_ - actor.y_;
            const dist = M.sqrt(nx * nx + ny * ny);
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
                if (b.btn_ == BulletType.Ray && b.hp_ > 0) {
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

const packAngleByte = (a: number, res: number) =>
    (res * a) & (res - 1);

const packDirByte = (x: number, y: number, res: number) =>
    packAngleByte((PI + M.atan2(y, x)) / PI2, res);

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
    const moveDirX = M.cos(moveAngle);
    const moveDirY = M.sin(moveAngle);
    const lookDirX = M.cos(lookAngle);
    const lookDirY = M.sin(lookAngle);
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
            if (player.client_ == clientId) {
                cameraShake = M.max(weapon.cameraShake_, cameraShake);
                cameraFeedback = 1;
            }
            player.s_ = 1;
            player.t_ = reach(player.t_, 1, weapon.detuneSpeed_ / Const.NetFq);
            addVelocityDir(player, lookDirX, lookDirY, -1, player.w_ > 0 ? 0 : -weapon.kickBack_);
            playAt(player, Snd.shoot);
            for (let i = 0; i < weapon.spawnCount_; ++i) {
                const a = lookAngle +
                    weapon.angleVar_ * (random() - 0.5) +
                    weapon.angleSpread_ * M.min(1, player.t_) * (random() - 0.5);
                const dx = M.cos(a);
                const dy = M.sin(a);
                const bulletVelocity = weapon.velocity_ + weapon.velocityVar_ * (random() - 0.5);
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

const cloneState = (): StateData => ({
    nextId_: state.nextId_,
    tic_: state.tic_,
    seed_: state.seed_,
    mapSeed_: state.mapSeed_,
    actors_: state.actors_.map(list => list.map(a => ({...a}))),
    scores_: {...state.scores_}
});

const beginPrediction = (): boolean => {
    // if (!Const.Prediction || time < 0.001) return false;
    if (!Const.Prediction) return false;

    // global state
    let frames = M.min(Const.InputDelay, (lastFrameTs - prevTime) * Const.NetFq | 0);
    if (!frames) return false;

    // save particles
    saveParticles();

    // save state
    lastState = state;
    state = cloneState();

    // && gameTic <= lastInputTic
    while (frames--) {
        simulateTic();
    }
    return true;
}

const endPrediction = () => {
    // global state
    state = lastState;
    _SEEDS[0] = state.seed_;
    gameTic = state.tic_ + 1;
    // restore particles
    restoreParticles();
}

/*** DRAWING ***/

const drawGame = () => {
    beginFogRender();
    renderFogObjects(state.actors_[ActorType.Player]);
    renderFogObjects(state.actors_[ActorType.Bullet]);
    renderFogObjects(state.actors_[ActorType.Item]);
    flush();

    beginRenderToMain(
        gameCamera[0] + fxRandomNorm(cameraShake * 8) | 0,
        gameCamera[1] + fxRandomNorm(cameraShake * 8) | 0,
        0.5, 0.5,
        fxRandomNorm(cameraShake / 8),
        1 / gameCamera[2]
    );
    clear(0.2, 0.2, 0.2, 1);

    drawMapBackground();
    drawObjects();
    renderFog(lastFrameTs, getHitColorOffset(getMyPlayer()?.animHit_));

    if (process.env.NODE_ENV === "development") {
        drawCollisions(drawList);
    }
    drawMapOverlay();
    if (!clientId) {
        for (let i = 10; i > 0; --i) {
            let a = 0.5 * M.sin(i / 4 + lastFrameTs * 16);
            const add = ((0x20 * (11 - i) + 0x20 * a) & 0xFF) << 16;
            const scale = 1 + i / 100;
            const angle = a * i / 100;
            const i4 = i / 4;
            const y1 = gameCamera[1] + i4;
            draw(img[Img.logo_title], gameCamera[0] + fxRandomNorm(i4), y1 + fxRandomNorm(i4), angle, scale, scale, 1, add);
            draw(img[Img.logo_start], gameCamera[0] + fxRandomNorm(i4), 110 + y1 + fxRandomNorm(i4), angle, scale, scale, 1, add);
        }
    }
    drawCrosshair();
    flush();
}

export const getScreenScale = () => M.min(gl.drawingBufferWidth, gl.drawingBufferHeight) / BASE_RESOLUTION;
const drawOverlay = () => {
    beginRenderToMain(0, 0, 0, 0, 0, getScreenScale());
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
    const invScale = gameCamera[2] / 2;
    const l = -invScale * W + gameCamera[0] - pad;
    const t = -invScale * H + gameCamera[1] - pad - 128;
    const r = invScale * W + gameCamera[0] + pad;
    const b = invScale * H + gameCamera[1] + pad + 128;
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
        const len = 4 + 0.25 * M.sin(2 * lastFrameTs) * M.cos(4 * lastFrameTs) + 4 * M.min(1, p0.t_) + 4 * M.min(1, p0.s_);
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
    if (cat == ItemCategory.Weapon) {
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
    } else /*if (cat == ItemCategory.Effect)*/ {
        const anim = item.anim0_ / 0xFF;
        const s = 1 + 0.1 * M.sin(16 * (lastFrameTs + anim * 10));
        const o = 2 * M.cos(lastFrameTs + anim * 10);
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
    const a = M.atan2(actor.v_, actor.u_);
    const type = actor.btn_;
    const color = fxRandElement(BULLET_COLOR[type] as number[]);
    const longing = BULLET_LENGTH[type];
    const longing2 = BULLET_LENGTH_LIGHT[type];
    const sz = BULLET_SIZE[type] +
        BULLET_PULSE[type] * M.sin(32 * lastFrameTs + actor.anim0_) / 2;
    let res = type * 3;

    draw(img[BULLET_IMAGE[res++]], x, y, a, sz * longing, sz, 0.1, COLOR_WHITE, 1);
    draw(img[BULLET_IMAGE[res++]], x, y, a, sz * longing / 2, sz / 2, 1, color);
    draw(img[BULLET_IMAGE[res++]], x, y, a, 2 * longing2, 2);
}

const drawPlayer = (p: Actor): void => {
    const co = getHitColorOffset(p.animHit_);
    const basePhase = p.anim0_ + lastFrameTs;
    const imgHead = p.client_ ? (Img.avatar0 + p.anim0_ % Img.num_avatars) : (Img.npc0 + p.anim0_ % Img.num_npc);
    const colorC = COLOR_BODY[p.anim0_ % COLOR_BODY.length];
    const colorArm = colorC;
    const colorBody = colorC;
    const x = p.x_;
    const y = p.y_ - p.z_;
    const speed = M.hypot(p.u_, p.v_, p.w_);
    const runK = (p.btn_ & ControlsFlag.Run) ? 1 : 0.8;
    const walk = M.min(1, speed / 100);
    let base = -0.5 * walk * 0.5 * (1.0 + M.sin(40 * runK * basePhase));
    const idle_base = (1 - walk) * ((1 + M.sin(10 * basePhase) ** 2) / 4);
    base += idle_base;
    const leg1 = 5 - 4 * walk * 0.5 * (1.0 + M.sin(40 * runK * basePhase));
    const leg2 = 5 - 4 * walk * 0.5 * (1.0 + M.sin(40 * runK * basePhase + PI));

    /////

    const wpn = weapons[p.weapon_];
    let viewAngle = unpackAngleByte(p.btn_ >> ControlsFlag.LookAngleBit, ControlsFlag.LookAngleMax);
    const weaponBaseAngle = wpn.gfxRot_;
    const weaponBaseScaleX = wpn.gfxSx_;
    const weaponBaseScaleY = 1;
    let weaponX = x;
    let weaponY = y - PLAYER_HANDS_Z;
    let weaponAngle = M.atan2(
        y + 1000 * M.sin(viewAngle) - weaponY,
        x + 1000 * M.cos(viewAngle) - weaponX
    );
    let weaponSX = weaponBaseScaleX;
    let weaponSY = weaponBaseScaleY;
    let weaponBack = 0;
    if (weaponAngle < -0.2 && weaponAngle > -PI + 0.2) {
        weaponBack = 1;
        //weaponY -= 16 * 4;
    }
    const A = M.sin(weaponAngle - PI);
    let wd = 6 + 12 * (weaponBack ? (A * A) : 0);
    let wx = 1;
    if (weaponAngle < -PI * 0.5 || weaponAngle > PI * 0.5) {
        wx = -1;
    }
    if (wpn.handsAnim_) {
        // const t = M.max(0, (p.s - 0.8) * 5);
        // anim := 1 -> 0
        const t = M.min(1, wpn.launchTime_ > 0 ? (p.s_ / wpn.launchTime_) : M.max(0, (p.s_ - 0.5) * 2));
        wd += M.sin(t * PI) * wpn.handsAnim_;
        weaponAngle -= -wx * PI * 0.25 * M.sin((1 - (1 - t) ** 2) * PI2);
    }
    weaponX += wd * M.cos(weaponAngle);
    weaponY += wd * M.sin(weaponAngle);

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
    const rArmRot = M.atan2(weaponY - armY, weaponX - rArmX);
    const lArmRot = M.atan2(weaponY - armY, weaponX - lArmX);
    const lArmLen = M.hypot(weaponX - lArmX, weaponY - armY) - 1;
    const rArmLen = M.hypot(weaponX - rArmX, weaponY - armY) - 1;

    if (p.weapon_) {
        draw(img[Img.box_l], x + 4, y - 10 + base, rArmRot, rArmLen, 2, 1, colorArm, 0, co);
        draw(img[Img.box_l], x - 4, y - 10 + base, lArmRot, lArmLen, 2, 1, colorArm, 0, co);
    } else {
        let sw1 = walk * M.sin(20 * runK * basePhase);
        let sw2 = walk * M.cos(20 * runK * basePhase);
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
    getLumaColor32(0xFF * M.min(1, 2 * anim / ANIM_HIT_MAX));

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
    drawList.sort((a, b) => BOUNDS_SIZE * (a.y_ - b.y_) + a.x_ - b.x_);
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
        const v = 1 - M.hypot(dx, dy);
        if (v > 0) {
            const pan = M.max(-1, M.min(1, dx));
            play(snd[id], v, pan, false);
        }
    }
}
