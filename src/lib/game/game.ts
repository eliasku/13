import {ClientID} from "../../shared/types";
import {clientId, clientName, disconnect, isPeerConnected, remoteClients} from "../net/messaging";
import {play, speak} from "../audio/context";
import {beginRenderToMain, clear, draw, flush, gl} from "../graphics/draw2d";
import {_SEEDS, fxRand, fxRandElement, fxRandomNorm, rand, random} from "../utils/rnd";
import {channels_sendObjectData} from "../net/channels_send";
import {EMOJI, img, Img} from "../assets/gfx";
import {Const} from "./config";
import {generateMapBackground, mapTexture} from "../assets/map";
import {Actor, ActorType, Client, ClientEvent, ItemType, newStateData, Packet, StateData, Vel} from "./types";
import {pack, unpack} from "./packets";
import {
    atan2,
    clamp,
    cos,
    dec1,
    getLumaColor32, hypot,
    lerp,
    max,
    min,
    PI,
    PI2,
    reach,
    sin, sqrt,
    TO_RAD
} from "../utils/math";
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
    addImpactParticles,
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
    checkBodyCollision,
    collideWithBoundsA,
    copyPosFromActorCenter,
    reflectVelocity,
    roundActors,
    setRandomPosition,
    testIntersection,
    testRayWithSphere,
    updateActorPhysics,
    updateAnim,
    updateBody
} from "./phy";
import {BASE_RESOLUTION, BOUNDS_SIZE, WORLD_BOUNDS_SIZE, WORLD_SCALE} from "../assets/params";
import {
    ANIM_HIT_MAX,
    ANIM_HIT_OVER,
    BULLET_RADIUS,
    JUMP_VEL,
    OBJECT_RADIUS,
    OBJECT_RADIUS_BY_TYPE,
    PLAYER_HANDS_PX_Z,
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
import {addToGrid, queryGridCollisions} from "./grid";
import {getOrCreate} from "../utils/utils";

const clients = new Map<ClientID, Client>()

// TODO: check idea of storage events in map?
let localEvents: ClientEvent[] = [];
let receivedEvents: ClientEvent[] = [];

// tics received from all peers (min value), we could simulate to it
let startTic = -1;
let gameTic = 0;
let prevTime = 0;
let joined = false;

let waitToAutoSpawn = false;
let waitToSpawn = false;

let lastFrameTs = 0;
let lastInputTic = 0;
let lastInputCmd = 0;
let lastAudioTic = 0;

// static state
let trees: Actor[] = [];
let playersGrid: Actor[][] = [];
let barrelsGrid: Actor[][] = [];
let treesGrid: Actor[][] = [];

// dynamic state
let state: StateData = newStateData();
let lastState: StateData;

// 0...50
let cameraShake = 0;

// 0...5
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
        detune_: 0,

        weapon_: 0,
        anim0_: rand(0x100),
        animHit_: 31,
        hp_: 1,
    });

const createHpItem = (): Actor => {
    const item = newActorObject(ActorType.Item);
    pushActor(item);
    return item;
}

const requireClient = (id: ClientID): Client => getOrCreate(clients, id, () => ({
    id_: id,
    tic_: 0,
    acknowledgedTic_: 0
}));

export const resetGame = () => {
    clients.clear();
    localEvents.length = 0;
    receivedEvents.length = 0;

    state = newStateData();
    normalizeState();

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
    treesGrid.length = 0;
    const nextId = state.nextId_;
    for (let i = 0; i < 64; ++i) {
        const tree = newActorObject(ActorType.Tree);
        tree.btn_ = rand(2);
        tree.hp_ = 0;
        setRandomPosition(tree);
        trees.push(tree);
        addToGrid(treesGrid, tree);
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
    state.seed_ = state.mapSeed_ = _SEEDS[0];
    recreateMap();
    for (let i = 0; i < 13; ++i) {
        const k = i / 13;
        const actor = newActorObject(ActorType.Player);
        actor.client_ = 1 + i;
        actor.weapon_ = 1 + (i % (weapons.length - 1));
        actor.anim0_ = i + rand(10) * Img.num_avatars;
        actor.btn_ = packAngleByte(k, ControlsFlag.LookAngleMax) << ControlsFlag.LookAngleBit;
        const D = 80 + rand(20);
        actor.x_ = (BOUNDS_SIZE / 2 + D * cos(k * PI2)) * WORLD_SCALE;
        actor.y_ = (BOUNDS_SIZE / 2 + D * sin(k * PI2) + 10) * WORLD_SCALE;
        pushActor(actor);
    }
    gameCamera[0] = gameCamera[1] = BOUNDS_SIZE / 2;
    startTic = 0;
}

const updateFrameTime = (ts: number) => {
    if (ts > lastFrameTs) {
        lastFrameTs = ts;
    }
}

export const updateTestGame = (ts: number) => {
    updateFrameTime(ts);

    if (clientId && startTic < 0 && !remoteClients.size) {
        createSeedGameState();
    }

    if (startTic >= 0) {
        tryRunTicks(lastFrameTs);
        flushSplatsToMap();
        if (!document.hidden) {
            const predicted = beginPrediction();
            drawGame();
            // check input before overlay, or save camera settings
            checkPlayerInput();
            checkJoinSync();
            drawOverlay();
            if (predicted) endPrediction();
        }
        sendInput();
        cleaningUpClients();
    }
    printStatus();
    if (process.env.NODE_ENV === "development") {
        printDebugInfo(gameTic, getMinTic(), lastFrameTs, prevTime, drawList, state, trees, clients);
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
                termPrint(str);
                if (p0.weapon_) {
                    termPrint(EMOJI[Img.weapon0 + p0.weapon_]);
                }
            } else {
                termPrint("tap to respawn");
            }
        } else {
            termPrint("joining");
        }

        const getPlayerIcon = (id?: ClientID) => {
            const player = getPlayerByClient(id);
            return player ? EMOJI[Img.avatar0 + player.anim0_ % Img.num_avatars] : "👁️";
        }

        termPrint(getPlayerIcon(clientId) + " " + clientName + " | ☠️" + (state.scores_[clientId] | 0));
        for (const [id, rc] of remoteClients) {
            termPrint((isPeerConnected(rc) ? getPlayerIcon(id) : "🔴") + " " + rc.name_ + " | ☠️" + (state.scores_[id] | 0));
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
    tic + max(
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
    if (clientId && !waitToSpawn && !player && joined) {
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

const getMinTic = (_tic = gameTic + ((lastFrameTs - prevTime) * Const.NetFq) | 0) => {
    for (const [, client] of clients) {
        if (_tic > client.tic_) {
            _tic = client.tic_;
        }
    }
    return _tic;
}

// get minimum tic that already received by
const getMinAckAndInput = (lastTic: number) => {
    for (const [, client] of clients) {
        if (lastTic > client.acknowledgedTic_) {
            lastTic = client.acknowledgedTic_;
        }
    }
    return lastTic;
}

const tryRunTicks = (ts: number): number => {
    if (startTic < 0) {
        return 0;
    }
    const netTic = getMinTic();
    let frames = (ts - prevTime) * Const.NetFq | 0;
    let framesSimulated = 0;
    while (gameTic <= netTic && frames--) {
        simulateTic();
        normalizeState();
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
            // prevTime -= Const.InputDelay / Const.NetFq;
            prevTime -= 1 / Const.NetFq;
            // prevTime = nearPrevTime;
            // prevTime = ts - Const.InputDelay * Const.NetDt;
        }
    }

    const lastTic = gameTic - 1;
    receivedEvents = receivedEvents.filter(v => v.tic_ > lastTic);
    const ackTic = getMinAckAndInput(lastTic);
    localEvents = localEvents.filter(v => v.tic_ > ackTic);

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
                //console.log(JSON.stringify(packet.events_));
                if (!cl.ready_ && joined) {
                    packet.state_ = state;
                    cl.tic_ = state.tic_;
                    cl.acknowledgedTic_ = state.tic_;
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

const processPacket = (sender: Client, data: Packet) => {
    if (startTic < 0 && data.state_) {
        if (data.state_.tic_ > getMinTic(1 << 31)) {
            updateFrameTime(performance.now() / 1000);
            prevTime = lastFrameTs;
            state = data.state_;
            gameTic = startTic = state.tic_ + 1;
            recreateMap();
            normalizeState();
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

    if (clientId && startTic >= 0) {
        for (const [id, rc] of remoteClients) {
            if (clients.get(id)?.ready_ && !isPeerConnected(rc)) {
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
    if (testIntersection(item, player)) {
        if (item.btn_ & ItemType.Weapon) {
            if (!(player.weapon_ || (player.btn_ & ControlsFlag.Drop))) {
                player.weapon_ = item.weapon_;
                playAt(player, Snd.pick);
                item.hp_ = item.btn_ = 0;
            }
        } else if (player.hp_ < 10) {
            ++player.hp_;
            playAt(player, Snd.heal);
            item.hp_ = item.btn_ = 0;
        }
    }
}

const updateGameCamera = () => {
    const getRandomPlayer = () => {
        const l = state.actors_[ActorType.Player].filter(p => p.client_);
        return l.length ? l[((lastFrameTs / 5) | 0) % l.length] : undefined;
    }
    let cameraScale = BASE_RESOLUTION / min(gl.drawingBufferWidth, gl.drawingBufferHeight);
    let cameraX = gameCamera[0];
    let cameraY = gameCamera[1];
    if (clientId) {
        const p0 = getMyPlayer() ?? getRandomPlayer();
        if (p0?.client_) {
            const wpn = weapons[p0.weapon_];
            const viewM = 100 * wpn.cameraFeedback_ * cameraFeedback / (hypot(viewX, viewY) + 0.001);
            const px = p0.x_ / WORLD_SCALE;
            const py = p0.y_ / WORLD_SCALE;
            cameraX = px + wpn.cameraLookForward_ * (lookAtX - px) - viewM * viewX;
            cameraY = py + wpn.cameraLookForward_ * (lookAtY - py) - viewM * viewY;
            cameraScale *= wpn.cameraScale_;
        }
    }
    gameCamera[0] = lerp(gameCamera[0], cameraX, 0.1);
    gameCamera[1] = lerp(gameCamera[1], cameraY, 0.1);
    gameCamera[2] = lerp(gameCamera[2], cameraScale, 0.05);
}

const normalizeState = () => {
    const sortById = (list: Actor[]) => list.sort((a, b) => a.id_ - b.id_);

    for (const a of state.actors_) {
        sortById(a);
        roundActors(a);
    }
}

const checkBulletCollision = (bullet: Actor, actor: Actor) => {
    if (bullet.hp_ &&
        bullet.weapon_ &&
        (bullet.client_ - actor.client_) &&
        testIntersection(bullet, actor)) {
        hitWithBullet(actor, bullet);
    }
};

const simulateTic = () => {
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
                        gameCamera[0] = p.x_ / WORLD_SCALE;
                        gameCamera[1] = p.y_ / WORLD_SCALE;
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

    updateGameCamera();

    playersGrid.length = 0;
    barrelsGrid.length = 0;

    for (const a of state.actors_[ActorType.Player]) {
        updatePlayer(a);
        updateActorPhysics(a);
        addToGrid(playersGrid, a);
        a.fstate_ = 1;
    }

    if (process.env.NODE_ENV === "development") {
        saveDebugState(cloneState());
    }

    for (const a of state.actors_[ActorType.Barrel]) {
        updateActorPhysics(a);
        addToGrid(barrelsGrid, a);
        a.fstate_ = 1;
    }

    for (const a of state.actors_[ActorType.Item]) {
        updateActorPhysics(a);
        if (!a.animHit_) {
            queryGridCollisions(a, playersGrid, pickItem);
        }
    }

    for (const bullet of state.actors_[ActorType.Bullet]) {
        if (bullet.btn_ != BulletType.Ray) {
            updateBody(bullet, 0, 0);
            if (bullet.hp_ && collideWithBoundsA(bullet)) {
                --bullet.hp_;
                addImpactParticles(8, bullet, bullet, BULLET_COLOR[bullet.btn_]);
            }
            queryGridCollisions(bullet, playersGrid, checkBulletCollision);
            queryGridCollisions(bullet, barrelsGrid, checkBulletCollision);
            queryGridCollisions(bullet, treesGrid, checkBulletCollision);
        }
        if (bullet.s_ && !--bullet.s_) {
            bullet.hp_ = 0;
        }
    }
    state.actors_ = state.actors_.map(list => list.filter(x => x.hp_));

    for (const a of state.actors_[ActorType.Player]) {
        a.fstate_ = 0;
        queryGridCollisions(a, treesGrid, checkBodyCollision);
        queryGridCollisions(a, barrelsGrid, checkBodyCollision);
        queryGridCollisions(a, playersGrid, checkBodyCollision, 0);
    }
    for (const a of state.actors_[ActorType.Barrel]) {
        a.fstate_ = 0;
        queryGridCollisions(a, treesGrid, checkBodyCollision);
        queryGridCollisions(a, barrelsGrid, checkBodyCollision, 0);
    }

    if (waitToSpawn && getMyPlayer()) {
        waitToSpawn = false;
    }

    for (const tree of trees) {
        updateAnim(tree);
    }

    updateParticles();
    cameraShake = dec1(cameraShake);
    cameraFeedback = dec1(cameraFeedback);

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
            x_: fxRand(WORLD_BOUNDS_SIZE),
            y_: fxRand(WORLD_BOUNDS_SIZE),
            z_: fxRand(128) * WORLD_SCALE,
            type_: 0
        } as any as Actor, 128, 1);
    }

    if (lastAudioTic < gameTic) {
        lastAudioTic = gameTic;
    }

    state.seed_ = _SEEDS[0];
    state.tic_ = gameTic++;
}

const castRayBullet = (bullet: Actor, dx: number, dy: number) => {
    for (const a of state.actors_[ActorType.Player]) {
        if (a.client_ - bullet.client_ &&
            testRayWithSphere(bullet, a, dx, dy)) {
            hitWithBullet(a, bullet);
        }
    }
    for (const a of state.actors_[ActorType.Barrel]) {
        if (testRayWithSphere(bullet, a, dx, dy)) {
            hitWithBullet(a, bullet);
        }
    }
    for (const a of trees) {
        if (testRayWithSphere(bullet, a, dx, dy)) {
            hitWithBullet(a, bullet);
        }
    }
};

const kill = (actor: Actor) => {
    playAt(actor, Snd.death);
    const amount = 1 + rand(3);
    for (let i = 0; i < amount; ++i) {
        const item = createHpItem();
        copyPosFromActorCenter(item, actor);
        addVelFrom(item, actor);
        const v = 32 + rand(64);
        addRadialVelocity(item, random(PI2), v, v);
        item.animHit_ = ANIM_HIT_MAX;
        if (actor.weapon_) {
            item.btn_ = ItemType.Weapon;
            item.weapon_ = actor.weapon_;
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

const BULLET_COLOR = [
    [0xFFFFFF],
    [0xFFFF44],
    [0x44FFFF],
    [0x333333],
    [0xFF0000, 0x00FF00, 0x00FFFF, 0xFFFF00, 0xFF00FF]
];

const hitWithBullet = (actor: Actor, bullet: Actor) => {

    addVelFrom(actor, bullet, 0.1);
    actor.animHit_ = ANIM_HIT_MAX;
    addImpactParticles(8, bullet, bullet, BULLET_COLOR[bullet.btn_]);
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
                    ];
                    if (gameTic > lastAudioTic) {
                        speak(fxRandElement(t));
                    }
                }
            }
        }
    }
    if (bullet.hp_ && bullet.btn_ != BulletType.Ray) {
        --bullet.hp_;
        if (bullet.hp_) {
            let nx = bullet.x_ - actor.x_;
            let ny = bullet.y_ - actor.y_;
            const dist = sqrt(nx * nx + ny * ny);
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

const unpackAngleByte = (angleByte: number, res: number) =>
    PI2 * (angleByte & (res - 1)) / res - PI;

const packAngleByte = (a: number, res: number) =>
    (res * a) & (res - 1);

const packDirByte = (x: number, y: number, res: number) =>
    packAngleByte((PI + atan2(y, x)) / PI2, res);

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
    const moveDirX = cos(moveAngle);
    const moveDirY = sin(moveAngle);
    const lookDirX = cos(lookAngle);
    const lookDirY = sin(lookAngle);
    if (player.btn_ & ControlsFlag.Move) {
        const speed = (player.btn_ & ControlsFlag.Run) ? 2 : 1;
        const vel = speed * 60;
        player.u_ = reach(player.u_, vel * moveDirX, vel * c);
        player.v_ = reach(player.v_, vel * moveDirY, vel * c);
        if (grounded && !((gameTic + player.anim0_) % (20 / speed))) {
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
            addPos(item, lookDirX, lookDirY, 0, OBJECT_RADIUS);
            addVelFrom(item, player);
            addVelocityDir(item, lookDirX, lookDirY, 0, 64);
            // set weapon item
            item.btn_ = ItemType.Weapon;
            item.weapon_ = player.weapon_;
            item.animHit_ = ANIM_HIT_OVER;
            player.weapon_ = 0;
        }
    }

    const weapon = weapons[player.weapon_];
    if (player.btn_ & ControlsFlag.Shooting && player.weapon_) {
        // reload-tics = NetFq / Rate
        player.s_ = dec1(player.s_);
        if (!player.s_) {
            if (player.client_ == clientId) {
                cameraShake = max(weapon.cameraShake_, cameraShake);
                cameraFeedback = 5;
            }
            player.s_ = weapon.reloadTime_;
            player.detune_ = reach(player.detune_, weapon.detuneSpeed_, 1);
            if(player.z_ <= 0) {
                addVelocityDir(player, lookDirX, lookDirY, -1, -weapon.kickBack_);
            }
            playAt(player, Snd.shoot);
            for (let i = 0; i < weapon.spawnCount_; ++i) {
                const a = lookAngle +
                    weapon.angleVar_ * (random() - 0.5) +
                    weapon.angleSpread_ * (player.detune_ / weapon.detuneSpeed_) * (random() - 0.5);
                const dx = cos(a);
                const dy = sin(a);
                const bulletVelocity = weapon.velocity_ + weapon.velocityVar_ * (random() - 0.5);
                const bullet = newActorObject(ActorType.Bullet);
                bullet.client_ = player.client_;
                copyPosFromActorCenter(bullet, player);
                addPos(bullet, dx, dy, 0, WORLD_SCALE * weapon.offset_);
                bullet.z_ += PLAYER_HANDS_Z - 12 * WORLD_SCALE;
                addVelocityDir(bullet, dx, dy, 0, bulletVelocity);
                bullet.weapon_ = weapon.bulletDamage_;
                bullet.btn_ = weapon.bulletType_;
                bullet.hp_ = weapon.bulletHp_;
                bullet.s_ = weapon.bulletLifetime_;
                pushActor(bullet);

                if (weapon.bulletType_ == BulletType.Ray) {
                    castRayBullet(bullet, dx, dy);
                    bullet.weapon_ = 0;
                }
            }

            if (weapon.bulletType_) {
                addShellParticle(player, PLAYER_HANDS_Z, weapon.bulletShellColor_);
            }
        }
    } else {
        player.detune_ = (player.detune_ / 3) | 0;
        player.s_ = reach(player.s_, weapon.launchTime_, weapon.relaunchSpeed_);
    }
}

export const spawnFleshParticles = (actor: Actor, expl: number, amount: number, vel?: Vel) => {
    addFleshParticles(amount, actor, expl, vel);
}

const cloneState = (_state: StateData = state): StateData => ({
    ..._state,
    actors_: _state.actors_.map(list => list.map(a => ({...a}))),
    scores_: {..._state.scores_}
});

const beginPrediction = (): boolean => {
    // if (!Const.Prediction || time < 0.001) return false;
    if (!Const.Prediction) return false;

    // global state
    let frames = min(Const.PredictionMax, (lastFrameTs - prevTime) * Const.NetFq | 0);
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
        gameCamera[0] + fxRandomNorm(cameraShake / 5) | 0,
        gameCamera[1] + fxRandomNorm(cameraShake / 5) | 0,
        0.5, 0.5,
        fxRandomNorm(cameraShake / (8 * 50)),
        1 / gameCamera[2]
    );
    clear(0.2, 0.2, 0.2, 1);

    drawMapBackground();
    drawObjects();
    drawMapOverlay();

    renderFog(lastFrameTs, getHitColorOffset(getMyPlayer()?.animHit_));

    if (process.env.NODE_ENV === "development") {
        drawCollisions(drawList);
    }

    if (!clientId) {
        for (let i = 10; i > 0; --i) {
            let a = 0.5 * sin(i / 4 + lastFrameTs * 16);
            const add = ((0x20 * (11 - i) + 0x20 * a) & 0xFF) << 16;
            const scale = 1 + i / 100;
            const angle = a * i / 100;
            const i4 = i / 4;
            const y1 = gameCamera[1] + i4;
            drawAt(Img.logo_start, gameCamera[0] + fxRandomNorm(i4), 110 + y1 + fxRandomNorm(i4), scale, scale, angle, 1, add);
            drawAt(Img.logo_title, gameCamera[0] + fxRandomNorm(i4), y1 + fxRandomNorm(i4), scale, scale, angle, 1, add);
        }
    }
    drawCrosshair();
    flush();
}

export const getScreenScale = () => min(gl.drawingBufferWidth, gl.drawingBufferHeight) / BASE_RESOLUTION;
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
        const shadowScale = (2 - actor.z_ / (WORLD_SCALE * 64)) * SHADOW_SCALE[type];
        const additive = SHADOW_ADD[type];
        const color = SHADOW_COLOR[type];
        drawAt(Img.circle_4, actor.x_ / WORLD_SCALE, actor.y_ / WORLD_SCALE, shadowScale, shadowScale / 4, 0, .4, color, additive);
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
            const x = a.x_ / WORLD_SCALE;
            const y = a.y_ / WORLD_SCALE;
            if ((x > l && x < r && y > t && y < b) ||
                (a.type_ == ActorType.Bullet && a.btn_ == BulletType.Ray)) {
                drawList.push(a);
            }
        }
    }
}

const drawMapBackground = () => {
    draw(mapTexture, 0, 0);
    // draw(img[Img.box_lt], 0, -objectRadiusUnit * 5, 0, boundsSize + 2, objectRadiusUnit * 4, 1, 0x666666);
    draw(img[Img.box_lt], 0, -OBJECT_RADIUS * 3 / WORLD_SCALE, 0, BOUNDS_SIZE + 2, OBJECT_RADIUS * 4 / WORLD_SCALE, 0.5, 0);
}

const drawMapOverlay = () => {
    draw(img[Img.box_lt], 0, BOUNDS_SIZE - OBJECT_RADIUS * 2 / WORLD_SCALE, 0, BOUNDS_SIZE + 2, OBJECT_RADIUS * 4 / WORLD_SCALE, 1, 0x333333);
    // draw(img[Img.box_lt], -objectRadiusUnit * 2, -objectRadiusUnit * 2, 0, objectRadiusUnit * 2, boundsSize + objectRadiusUnit * 4, 1, 0x666666);
    // draw(img[Img.box_lt], boundsSize, -objectRadiusUnit * 2, 0, objectRadiusUnit * 2, boundsSize + objectRadiusUnit * 4, 1, 0x666666);
}

const drawCrosshair = () => {
    const p0 = getMyPlayer();
    if (p0 && (viewX || viewY)) {
        const len = 4 + sin(2 * lastFrameTs) * cos(4 * lastFrameTs) / 4 + (p0.detune_ / 8) + p0.s_ / 10;
        for (let i = 0; i < 4; ++i) {
            drawAt(Img.box_t1, lookAtX, lookAtY, 2, len, lastFrameTs / 10 + i * PI / 2, 0.5);
        }
    }
}

const drawItem = (item: Actor) => {
    if (item.btn_ & ItemType.Weapon) {
        drawObject(item, Img.weapon0 + item.weapon_, 2, 0.8);
    } else /*if (cat == ItemCategory.Effect)*/ {
        const t = lastFrameTs * 4 + item.anim0_ / 25;
        drawObject(item, Img.item0, BULLET_RADIUS / WORLD_SCALE + cos(t), 0.9 + 0.1 * sin(4 * t));
    }
}

const drawBullet = (actor: Actor) => {
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

    const x = actor.x_ / WORLD_SCALE;
    const y = (actor.y_ - actor.z_) / WORLD_SCALE;
    const a = atan2(actor.v_, actor.u_);
    const type = actor.btn_;
    const color = fxRandElement(BULLET_COLOR[type] as number[]);
    const longing = BULLET_LENGTH[type];
    const longing2 = BULLET_LENGTH_LIGHT[type];
    const sz = BULLET_SIZE[type] +
        BULLET_PULSE[type] * sin(32 * lastFrameTs + actor.anim0_) / 2;
    let res = type * 3;

    drawAt(BULLET_IMAGE[res++], x, y, sz * longing, sz, a, 0.1, COLOR_WHITE, 1);
    drawAt(BULLET_IMAGE[res++], x, y, sz * longing / 2, sz / 2, a, 1, color);
    drawAt(BULLET_IMAGE[res++], x, y, 2 * longing2, 2, a);
}

const drawAt = (i: Img, x: number, y: number, sx: number = 1, sy: number = 1, rotation?: number, alpha?: number, color?: number, additive?: number, offset?: number) => {
    draw(img[i], x, y, rotation, sx, sy, alpha, color, additive, offset);
}

const drawPlayer = (p: Actor): void => {
    const co = getHitColorOffset(p.animHit_);
    const basePhase = p.anim0_ + lastFrameTs;
    const imgHead = p.client_ ? (Img.avatar0 + p.anim0_ % Img.num_avatars) : (Img.npc0 + p.anim0_ % Img.num_npc);
    const colorC = COLOR_BODY[p.anim0_ % COLOR_BODY.length];
    const colorArm = colorC;
    const colorBody = colorC;
    const x = p.x_ / WORLD_SCALE;
    const y = (p.y_ - p.z_) / WORLD_SCALE;
    const speed = hypot(p.u_, p.v_, p.w_);
    const runK = (p.btn_ & ControlsFlag.Run) ? 1 : 0.8;
    const walk = min(1, speed / 100);
    let base = -0.5 * walk * 0.5 * (1.0 + sin(40 * runK * basePhase));
    const idle_base = (1 - walk) * ((1 + sin(10 * basePhase) ** 2) / 4);
    base = base + idle_base;
    const leg1 = 5 - 4 * walk * 0.5 * (1.0 + sin(40 * runK * basePhase));
    const leg2 = 5 - 4 * walk * 0.5 * (1.0 + sin(40 * runK * basePhase + PI));

    /////

    const wpn = weapons[p.weapon_];
    let viewAngle = unpackAngleByte(p.btn_ >> ControlsFlag.LookAngleBit, ControlsFlag.LookAngleMax);
    const weaponBaseAngle = wpn.gfxRot_ * TO_RAD;
    const weaponBaseScaleX = wpn.gfxSx_;
    const weaponBaseScaleY = 1;
    let weaponX = x;
    let weaponY = y - PLAYER_HANDS_PX_Z;
    let weaponAngle = atan2(
        y + 1000 * sin(viewAngle) - weaponY,
        x + 1000 * cos(viewAngle) - weaponX
    );
    let weaponSX = weaponBaseScaleX;
    let weaponSY = weaponBaseScaleY;
    let weaponBack = 0;
    if (weaponAngle < -0.2 && weaponAngle > -PI + 0.2) {
        weaponBack = 1;
        //weaponY -= 16 * 4;
    }
    const A = sin(weaponAngle - PI);
    let wd = 6 + 12 * (weaponBack ? (A * A) : 0);
    let wx = 1;
    if (weaponAngle < -PI * 0.5 || weaponAngle > PI * 0.5) {
        wx = -1;
    }
    if (wpn.handsAnim_) {
        // const t = max(0, (p.s - 0.8) * 5);
        // anim := 1 -> 0
        const t = min(1, wpn.launchTime_ > 0 ? (p.s_ / wpn.launchTime_) : max(0, (p.s_ / wpn.reloadTime_ - 0.5) * 2));
        wd += sin(t * PI) * wpn.handsAnim_;
        weaponAngle -= -wx * PI * 0.25 * sin((1 - (1 - t) ** 2) * PI2);
    }
    weaponX += wd * cos(weaponAngle);
    weaponY += wd * sin(weaponAngle);

    if (wx < 0) {
        weaponSX *= wx;
        weaponAngle -= PI + 2 * weaponBaseAngle;
    }

    weaponAngle += weaponBaseAngle;

    if (weaponBack && p.weapon_) {
        drawAt(Img.weapon0 + p.weapon_, weaponX, weaponY, weaponSX, weaponSY, weaponAngle);
    }

    drawAt(Img.box_t, x - 3, y - 5, 2, leg1, 0, 1, colorArm, 0, co);
    drawAt(Img.box_t, x + 3, y - 5, 2, leg2, 0, 1, colorArm, 0, co);
    drawAt(Img.box, x, y - 7 + base, 8, 6, 0, 1, colorBody, 0, co);

    {
        const s = p.w_ / 500;
        const a = p.u_ / 500;
        drawAt(imgHead, x, y - 16 + base * 2, 1 - s, 1 + s, a, 1, COLOR_WHITE, 0, co);
    }

    // DRAW HANDS
    const rArmX = x + 4;
    const lArmX = x - 4;
    const armY = y - PLAYER_HANDS_PX_Z + base * 2;
    const rArmRot = atan2(weaponY - armY, weaponX - rArmX);
    const lArmRot = atan2(weaponY - armY, weaponX - lArmX);
    const lArmLen = hypot(weaponX - lArmX, weaponY - armY) - 1;
    const rArmLen = hypot(weaponX - rArmX, weaponY - armY) - 1;

    if (p.weapon_) {
        drawAt(Img.box_l, x + 4, y - 10 + base, rArmLen, 2, rArmRot, 1, colorArm, 0, co);
        drawAt(Img.box_l, x - 4, y - 10 + base, lArmLen, 2, lArmRot, 1, colorArm, 0, co);
    } else {
        let sw1 = walk * sin(20 * runK * basePhase);
        let sw2 = walk * cos(20 * runK * basePhase);
        let armLen = 5;
        if (!p.client_ && p.hp_ < 10) {
            sw1 -= PI / 2;
            sw2 += PI / 2;
            armLen += 4;
        }
        drawAt(Img.box_l, x + 4, y - 10 + base, armLen, 2, sw1 + PI / 4, 1, colorArm, 0, co);
        drawAt(Img.box_l, x - 4, y - 10 + base, armLen, 2, sw2 + PI - PI / 4, 1, colorArm, 0, co);
    }

    if (!weaponBack && p.weapon_) {
        drawAt(Img.weapon0 + p.weapon_, weaponX, weaponY, weaponSX, weaponSY, weaponAngle);
    }
}

const getHitColorOffset = (anim: number) =>
    getLumaColor32(0xFF * min(1, 2 * anim / ANIM_HIT_MAX));

const drawObject = (p: Actor, id: Img, z: number = 0, scale: number = 1) =>
    drawAt(id, p.x_ / WORLD_SCALE, (p.y_ - p.z_) / WORLD_SCALE - z, scale, scale, 0, 1, COLOR_WHITE, 0, getHitColorOffset(p.animHit_));

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
    // TODO: check sort, scale to floats and compare
    drawList.sort((a, b) => WORLD_BOUNDS_SIZE * (a.y_ - b.y_) + a.x_ - b.x_);
    drawShadows();
    for (const actor of drawList) {
        DRAW_BY_TYPE[actor.type_](actor);
    }
}
/// SOUND ENV ///

const playAt = (actor: Actor, id: Snd) => {
    if (gameTic > lastAudioTic) {
        const dx = (actor.x_ - gameCamera[0]) / (256 * WORLD_SCALE);
        const dy = (actor.y_ - gameCamera[1]) / (256 * WORLD_SCALE);
        const v = 1 - hypot(dx, dy);
        if (v > 0) {
            play(snd[id], v, clamp(dx, -1, 1));
        }
    }
}
