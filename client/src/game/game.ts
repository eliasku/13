import {ClientID} from "../../../shared/types";
import {clientId, clientName, disconnect, isPeerConnected, remoteClients} from "../net/messaging";
import {play, speak} from "../audio/context";
import {
    ambientColor,
    beginRenderToMain,
    draw,
    drawMeshSpriteUp,
    emptyTexture,
    flush,
    gl,
    setDrawZ,
    setLightMapTexture
} from "../graphics/draw2d";
import {_SEEDS, fxRand, fxRandElement, fxRandom, fxRandomNorm, rand, random, random1i} from "../utils/rnd";
import {channels_sendObjectData} from "../net/channels_send";
import {EMOJI, img, Img} from "../assets/gfx";
import {Const, GAME_CFG} from "./config";
import {generateMapBackground, mapTexture} from "../assets/map";
import {
    Actor,
    ActorType,
    Client,
    ClientEvent,
    ItemType,
    newStateData,
    packAngleByte,
    packDirByte,
    Packet,
    PlayerStat,
    StateData,
    unpackAngleByte,
    Vel
} from "./types";
import {pack, unpack} from "./packets";
import {
    abs,
    atan2,
    clamp,
    cos,
    dec1,
    hypot,
    lerp,
    lerpLog,
    max,
    min,
    PI,
    PI2,
    reach,
    sin,
    sqrt,
    TO_RAD
} from "../utils/math";
import {
    ControlsFlag,
    couldBeReloadedManually,
    drawVirtualPad,
    dropButton,
    gameCamera,
    jumpButtonDown,
    lookAtX,
    lookAtY,
    moveFast,
    moveX,
    moveY,
    reloadButton,
    shootButtonDown,
    swapButton,
    updateControls,
    viewX,
    viewY
} from "./controls";
import {isAnyKeyDown} from "../utils/input";
import {Snd, snd} from "../assets/sfx";
import {weapons} from "./data/weapons";
import {
    addBoneParticles,
    addFleshParticles,
    addImpactParticles,
    addLandParticles,
    addShellParticle,
    addStepSplat,
    addTextParticle,
    drawOpaqueParticles,
    drawParticleShadows,
    drawSplatsOpaque,
    drawTextParticles,
    resetParticles,
    restoreParticles,
    saveParticles,
    updateMapTexture,
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
    limitVelocity,
    reflectVelocity,
    roundActors,
    setRandomPosition,
    testIntersection,
    testRayWithSphere,
    updateActorPhysics,
    updateAnim,
    updateBody
} from "./phy";
import {BOUNDS_SIZE, WORLD_BOUNDS_SIZE, WORLD_SCALE} from "../assets/params";
import {
    actorsConfig,
    ANIM_HIT_MAX,
    ANIM_HIT_OVER,
    BULLET_RADIUS,
    OBJECT_RADIUS,
    PLAYER_HANDS_PX_Z,
    PLAYER_HANDS_Z,
} from "./data/world";
import {termPrint, ui_renderNormal, ui_renderOpaque} from "../graphics/ui";
import {beginFogRender, drawFogObjects, drawFogPoint, fogTexture} from "./fog";
import {
    addDebugState,
    assertStateInSync,
    drawCollisions,
    printDebugInfo,
    saveDebugState,
    updateDebugInput
} from "./debug";
import {addToGrid, queryGridCollisions} from "./grid";
import {getOrCreate, RGB} from "../utils/utils";
import {drawText, drawTextShadowCenter, fnt} from "../graphics/font";
import {stats} from "../utils/fpsMeter";
import {drawMiniMap} from "./minimap";
import {updateAI} from "./ai";
import {GL} from "../graphics/gl";
import {
    drawBarrelOpaque,
    drawBullet,
    drawCrosshair,
    drawHotUsableHint,
    drawItemOpaque,
    drawShadows,
    drawTreeOpaque,
    getHitColorOffset,
    setupWorldCameraMatrix
} from "./gameDraw";
import {getDevSetting, settings} from "./settings";
import {bullets, BulletType} from "./data/bullets";
import {getNameByClientId, getScreenScale, lastFrameTs, resetLastFrameTs, updateFrameTime} from "./gameState";

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

let lastInputTic = 0;
let lastInputCmd = 0;
let lastAudioTic = 0;

// static state
let trees: Actor[] = [];
let playersGrid: Actor[][] = [];
let barrelsGrid: Actor[][] = [];
let treesGrid: Actor[][] = [];
let hotUsable: Actor | null = null;

// dynamic state
let state: StateData = newStateData();
let lastState: StateData;
export const gameMode = {
    title: false,
    runAI: false,
    playersAI: false,
    hasPlayer: false,
    tiltCamera: 0.0,
    spawnNPC: true,
    bloodRain: false,
};

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
        sp_: 0,
        mags_: 0,

        clipAmmo_: 0,
        clipReload_: 0,

        clipAmmo2_: 0,
        weapon2_: 0,
        trig_: 0,
        fstate_: 0,
    });

const createRandomItem = (): Actor => {
    const item = newActorObject(ActorType.Item);
    item.btn_ = rand(6);
    item.clipReload_ = GAME_CFG.items.lifetime;
    pushActor(item);
    return item;
}

const requireClient = (id: ClientID): Client => getOrCreate(clients, id, () => ({
    id_: id,
    tic_: 0,
    acknowledgedTic_: 0
}));

const requireStats = (id: ClientID): PlayerStat => getOrCreate(state.stats_, id, () => ({frags_: 0, scores_: 0}));

export const resetGame = () => {
    resetParticles();

    clients.clear();
    localEvents.length = 0;
    receivedEvents.length = 0;

    state = newStateData();
    normalizeState();

    startTic = -1;
    gameTic = 1;
    // prevTime = 0;
    // startTime = 0;
    // ackMin = 0;
    joined = false;

    waitToAutoSpawn = false;
    waitToSpawn = false;

    resetLastFrameTs();
    lastInputTic = 0;
    lastInputCmd = 0;
    lastAudioTic = 0;
    console.log("reset game");

    gameMode.title = false;
    gameMode.runAI = true;
    gameMode.playersAI = false;
    gameMode.hasPlayer = true;
    gameMode.tiltCamera = 0.0;
    gameMode.spawnNPC = true;
    gameMode.bloodRain = false;
}

const recreateMap = () => {
    // generate map
    _SEEDS[0] = state.mapSeed_;
    const theme = generateMapBackground();
    trees.length = 0;
    treesGrid.length = 0;
    const nextId = state.nextId_;
    for (let i = 0; i < GAME_CFG.trees.initCount; ++i) {
        const tree = newActorObject(ActorType.Tree);
        tree.btn_ = theme.treeGfx[rand(theme.treeGfx.length)];
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

function initBarrels() {
    const count = GAME_CFG.barrels.initCount;
    const hp = GAME_CFG.barrels.hp;
    const weaponChance = GAME_CFG.barrels.dropWeapon.chance;
    const weaponMin = GAME_CFG.barrels.dropWeapon.min;
    for (let i = 0; i < count; ++i) {
        const actor = newActorObject(ActorType.Barrel);
        actor.hp_ = hp[0] + rand(hp[1] - hp[0]);
        actor.btn_ = rand(2);
        // Drop weapon from barrels with 70% chance
        if (rand(100) < weaponChance) {
            actor.weapon_ = weaponMin + rand(weapons.length - weaponMin);
        }
        setRandomPosition(actor)
        pushActor(actor);
    }
}

export const createSeedGameState = () => {
    startTic = 0;
    gameTic = 1;
    state.mapSeed_ = state.seed_ = _SEEDS[0];
    recreateMap();
    initBarrels();
}

export const createSplashState = () => {
    state.seed_ = state.mapSeed_ = _SEEDS[0];
    recreateMap();
    for (let i = 0; i < 13; ++i) {
        const k = i / 13;
        const actor = newActorObject(ActorType.Player);
        actor.client_ = 1 + i;
        actor.hp_ = 10;
        actor.mags_ = 10;
        actor.sp_ = 10;
        setCurrentWeapon(actor, 1 + (i % (weapons.length - 1)));
        actor.anim0_ = i + rand(10) * Img.num_avatars;
        actor.btn_ = packAngleByte(k, ControlsFlag.LookAngleMax) << ControlsFlag.LookAngleBit;
        const D = 80 + 20 * sqrt(random());
        actor.x_ = (BOUNDS_SIZE / 2 + D * cos(k * PI2)) * WORLD_SCALE;
        actor.y_ = (BOUNDS_SIZE / 2 + D * sin(k * PI2) + 10) * WORLD_SCALE;
        pushActor(actor);
    }
    gameCamera[0] = gameCamera[1] = BOUNDS_SIZE / 2;
    startTic = 0;
    gameMode.hasPlayer = false;
    gameMode.tiltCamera = 0.05;
    gameMode.bloodRain = true;
    gameMode.title = true;
}

export const updateGame = (ts: number) => {
    updateFrameTime(ts);

    if (clientId && startTic < 0 && !remoteClients.size) {
        createSeedGameState();
    }

    let predicted = false;
    if (startTic >= 0) {
        cleaningUpClients();
        tryRunTicks(lastFrameTs);
        updateMapTexture(lastFrameTs);
        predicted = beginPrediction();
    }
    if (!document.hidden) {
        drawGame();
        drawOverlay();
    }
    if (startTic >= 0) {
        // check input before overlay, or save camera settings
        updatePlayerControls();

        if (predicted) endPrediction();

        checkJoinSync();
        checkPlayerInput();
        sendInput();
    }
}

const getWeaponInfoHeader = (wpn: number, ammo: number, reload: number = 0): string => {
    if (wpn) {
        const weapon = weapons[wpn];
        let txt = EMOJI[Img.weapon0 + wpn];
        if (weapon.clipSize_) {
            if (reload) {
                txt += ((100 * (weapon.clipReload_ - reload) / weapon.clipReload_) | 0) + "%";
            } else {
                txt += ammo;
            }
        } else {
            txt += "∞";
        }
        return txt;
    }
    return "";
}

const printStatus = () => {
    if (clientId) {
        if (joined) {
            const p0 = getMyPlayer();
            if (p0) {
                let str = "";
                const hp = p0.hp_;
                for (let i = 0; i < 10;) {
                    const o2 = hp > i++;
                    const o1 = hp > i++;
                    str += o1 ? "❤️" : (o2 ? "💔" : "🖤");
                }
                const sp = p0.sp_;
                for (let i = 0; i < 10;) {
                    const o2 = sp > i++;
                    const o1 = sp > i++;
                    str += o1 ? "🛡" : (o2 ? "🪖️️" : "");
                }
                termPrint(str);
                {
                    let wpnInfo = getWeaponInfoHeader(p0.weapon_, p0.clipAmmo_, p0.clipReload_);
                    if (p0.weapon2_) {
                        wpnInfo += " | " + getWeaponInfoHeader(p0.weapon2_, p0.clipAmmo2_);
                    }
                    termPrint(wpnInfo);
                }
                termPrint(`🧱${p0.mags_}`);
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
        const getPlayerStatInfo = (id?: ClientID): string => {
            const stat = state.stats_.get(id);
            return `|☠${stat?.frags_ ?? 0}|🪙${stat?.scores_ ?? 0}`;
        }

        termPrint(getPlayerIcon(clientId) + clientName + getPlayerStatInfo(clientId));
        for (const [id, rc] of remoteClients) {
            termPrint((isPeerConnected(rc) ? getPlayerIcon(id) : "🔴") + rc.name_ + getPlayerStatInfo(id));
        }
    }
}

const getMyPlayer = (): Actor | undefined =>
    clientId ? getPlayerByClient(clientId) : undefined;

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

const updatePlayerControls = () => {
    updateDebugInput();

    const player = getMyPlayer();
    if (player) {
        updateControls(player);
    }
}

const checkPlayerInput = () => {
    let inputTic = getNextInputTic(gameTic);
    // if (lastInputTic >= inputTic) {

    // if (inputTic < lastInputTic) {
    //     return;
    // }
    // lastInputTic = inputTic;


    // localEvents = localEvents.filter((x) => x.t < inputTic || x.spawn);
    const player = getMyPlayer();
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
                btn |= ControlsFlag.Fire;
            }
        }

        if (jumpButtonDown) {
            btn |= ControlsFlag.Jump;
        }

        if (dropButton) {
            btn |= ControlsFlag.Drop;
        }

        if (reloadButton) {
            btn |= ControlsFlag.Reload;
        }

        if (swapButton) {
            btn |= ControlsFlag.Swap;
        }
    }

    // RESPAWN EVENT
    if (!gameMode.title && clientId && !waitToSpawn && !player && joined) {
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

const getMinTic = (_tic: number = 1 << 30) => {
    if (!remoteClients.size || !clients.size || !joined) {
        _tic = gameTic + (((lastFrameTs - prevTime) * Const.NetFq) | 0);
    }
    for (const [, client] of clients) {
        if (_tic > client.tic_ && client.ready_) {
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
    let frames = ((ts - prevTime) * Const.NetFq) | 0;
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
    // const nearPrevTime = lerp(prevTime, ts - Const.InputDelay / Const.NetFq, 0.01);
    const nearPrevTime = lerp(prevTime, ts - Const.InputDelay / Const.NetFq, 0.1);
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

const _packetBuffer = new Int32Array(1024 * 256);

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
        if (data.state_.tic_ > getMinTic()) {
            updateFrameTime(performance.now() / 1000);
            prevTime = lastFrameTs;
            state = data.state_;
            gameTic = startTic = state.tic_ + 1;
            recreateMap();
            normalizeState();
        }
    }

    if (process.env.NODE_ENV === "development") {
        if (startTic >= 0) {
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
        cleaningUpClients();
        if (tryRunTicks(lastFrameTs)) {
            sendInput();
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

const setCurrentWeapon = (player: Actor, weaponId: number) => {
    player.weapon_ = weaponId;
    const weapon = weapons[weaponId];
    if (weapon) {
        player.clipReload_ = 0;
        player.clipAmmo_ = weapon.clipSize_;
    }
}

const dropWeapon1 = (player: Actor) => {
    const lookAngle = unpackAngleByte(player.btn_ >> ControlsFlag.LookAngleBit, ControlsFlag.LookAngleMax);
    const lookDirX = cos(lookAngle);
    const lookDirY = sin(lookAngle);

    const item = newActorObject(ActorType.Item);
    pushActor(item);
    copyPosFromActorCenter(item, player);
    addPos(item, lookDirX, lookDirY, 0, OBJECT_RADIUS);
    addVelFrom(item, player);
    addVelocityDir(item, lookDirX, lookDirY, 0, 64);
    // set weapon item
    item.btn_ = ItemType.Weapon;
    item.weapon_ = player.weapon_;
    item.clipAmmo_ = player.clipAmmo_;
    item.mags_ = 0;
    item.clipReload_ = GAME_CFG.items.lifetime;
    item.animHit_ = ANIM_HIT_OVER;
    player.weapon_ = 0;
    player.clipAmmo_ = 0;
}

const lateUpdateDropButton = (player: Actor) => {
    if (player.btn_ & ControlsFlag.Drop) {
        if (!(player.trig_ & ControlsFlag.DownEvent_Drop)) {
            player.trig_ |= ControlsFlag.DownEvent_Drop;
            if (player.weapon_) {
                dropWeapon1(player);
                if (player.weapon2_) {
                    swapWeaponSlot(player);
                }
            }
        }
    } else {
        player.trig_ &= ~ControlsFlag.DownEvent_Drop;
    }
}

const updateWeaponPickup = (item: Actor, player: Actor) => {
    if (player.btn_ & ControlsFlag.Drop) {
        if (!(player.trig_ & ControlsFlag.DownEvent_Drop)) {
            player.trig_ |= ControlsFlag.DownEvent_Drop;
            if (!player.weapon2_) {
                swapWeaponSlot(player);
            } else {
                // if 2 slot occupied - replace 1-st weapon
                dropWeapon1(player);
            }
            setCurrentWeapon(player, item.weapon_);
            player.mags_ = min(10, player.mags_ + item.mags_);
            player.clipAmmo_ = item.clipAmmo_;
            playAt(player, Snd.pick);
            item.hp_ = item.btn_ = 0;
        }
    }
}

const isMyPlayer = (actor: Actor) => clientId && actor.client_ === clientId && actor.type_ === ActorType.Player;

const pickItem = (item: Actor, player: Actor) => {
    if (testIntersection(item, player)) {
        const withMyPlayer = isMyPlayer(player);
        if (item.btn_ & ItemType.Weapon) {
            if (withMyPlayer && !hotUsable) {
                hotUsable = item;
            }
            // suck in mags
            if (item.mags_ && player.mags_ < 10) {
                const freeQty = 10 - player.mags_;
                const qty = clamp(0, item.mags_, freeQty);
                item.mags_ -= qty;
                player.mags_ = min(10, player.mags_ + qty);
                playAt(player, Snd.pick);
                if (withMyPlayer) {
                    addTextParticle(item, `+${qty} mags`);
                }
            }
            updateWeaponPickup(item, player);
        } else {
            if (item.btn_ === ItemType.Hp || item.btn_ === ItemType.Hp2) {
                if (player.hp_ < 10) {
                    const qty = item.btn_ === ItemType.Hp2 ? 2 : 1;
                    player.hp_ = min(10, player.hp_ + qty);
                    item.hp_ = item.btn_ = 0;
                    playAt(player, Snd.heal);
                    if (withMyPlayer) {
                        addTextParticle(item, `+${qty} hp`);
                    }
                }
            } else if (item.btn_ === ItemType.Credit || item.btn_ === ItemType.Credit2) {
                if (player.client_) {
                    const stat = requireStats(player.client_);
                    const qty = item.btn_ === ItemType.Credit2 ? 5 : 1;
                    stat.scores_ += qty;
                    item.hp_ = item.btn_ = 0;
                    playAt(player, Snd.pick);
                    if (withMyPlayer) {
                        addTextParticle(item, `+${qty} cr`);
                    }
                }
            } else if (item.btn_ === ItemType.Ammo) {
                if (player.mags_ < 10) {
                    const qty = 1;
                    player.mags_ = min(10, player.mags_ + qty);
                    item.hp_ = item.btn_ = 0;
                    playAt(player, Snd.pick);
                    if (withMyPlayer) {
                        addTextParticle(item, `+${qty} mags`);
                    }
                }
            } else if (item.btn_ === ItemType.Shield) {
                if (player.sp_ < 10) {
                    const qty = 1;
                    ++player.sp_;
                    item.hp_ = item.btn_ = 0;
                    playAt(player, Snd.med);
                    if (withMyPlayer) {
                        addTextParticle(item, `+${qty} sp`);
                    }
                }
            }
        }
    }
}

const updateGameCamera = () => {
    const getRandomPlayer = () => {
        const l = state.actors_[ActorType.Player].filter(p => p.client_ && clients.has(p.client_));
        return l.length ? l[((lastFrameTs / 5) | 0) % l.length] : undefined;
    }
    let scale = GAME_CFG.camera.baseScale;
    let cameraX = gameCamera[0];
    let cameraY = gameCamera[1];
    if (clientId && !gameMode.title) {
        const myPlayer = getMyPlayer();
        const p0 = myPlayer ?? getRandomPlayer();
        if (p0?.client_) {
            const wpn = weapons[p0.weapon_];
            const px = p0.x_ / WORLD_SCALE;
            const py = p0.y_ / WORLD_SCALE;
            cameraX = px;
            cameraY = py;
            if (myPlayer) {
                const viewM = 100 * wpn.cameraFeedback_ * cameraFeedback / (hypot(viewX, viewY) + 0.001);
                cameraX += wpn.cameraLookForward_ * (lookAtX - px) - viewM * viewX;
                cameraY += wpn.cameraLookForward_ * (lookAtY - py) - viewM * viewY;
            }
            scale *= wpn.cameraScale_;
        }
    }
    gameCamera[0] = lerp(gameCamera[0], cameraX, 0.1);
    gameCamera[1] = lerp(gameCamera[1], cameraY, 0.1);
    gameCamera[2] = lerpLog(gameCamera[2], scale / getScreenScale(), 0.05);
}

const normalizeState = () => {
    for (const list of state.actors_) {
        // sort by id
        list.sort((a: Actor, b: Actor): number => a.id_ - b.id_);
        // normalize properties
        roundActors(list);
    }
}

const checkBulletCollision = (bullet: Actor, actor: Actor) => {
    if (bullet.hp_ &&
        bullet.weapon_ &&
        (bullet.client_ > 0 ? (bullet.client_ - actor.client_) : (-bullet.client_ - actor.id_)) &&
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
                    p.hp_ = GAME_CFG.player.hp;
                    p.sp_ = GAME_CFG.player.sp;
                    p.mags_ = GAME_CFG.player.mags;
                    p.btn_ = cmd.btn_;
                    setCurrentWeapon(p, 1 + rand(3));
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

    hotUsable = null;
    for (const a of state.actors_[ActorType.Item]) {
        updateActorPhysics(a);
        if (!a.animHit_) {
            queryGridCollisions(a, playersGrid, pickItem);
        }
        if (a.hp_ && a.clipReload_) {
            if ((gameTic % 10) === 0) {
                --a.clipReload_;
                if (!a.clipReload_) {
                    a.hp_ = 0;
                }
            }
        }
    }

    for (const a of state.actors_[ActorType.Player]) {
        lateUpdateDropButton(a);
    }

    for (const bullet of state.actors_[ActorType.Bullet]) {
        if (bullet.btn_ != BulletType.Ray) {
            updateBody(bullet, 0, 0);
            if (bullet.hp_ && collideWithBoundsA(bullet)) {
                --bullet.hp_;
                addImpactParticles(8, bullet, bullet, bullets[bullet.btn_ as BulletType].color);
            }
            queryGridCollisions(bullet, playersGrid, checkBulletCollision);
            queryGridCollisions(bullet, barrelsGrid, checkBulletCollision);
            queryGridCollisions(bullet, treesGrid, checkBulletCollision);
        }
        if (bullet.s_ && !--bullet.s_) {
            bullet.hp_ = 0;
        }
    }
    state.actors_ = state.actors_.map(list => list.filter(x => x.hp_ > 0));

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

    if (gameMode.spawnNPC) {
        const NPC_PERIOD_MASK = (1 << GAME_CFG.npc.period) - 1;
        if ((gameTic & NPC_PERIOD_MASK) === 0) {
            let count = 0;
            for (const actor of state.actors_[ActorType.Player]) {
                if (!actor.client_) {
                    ++count;
                }
            }
            // while (count < GAME_CFG.npc.max) {
            if (count < GAME_CFG.npc.max) {
                const p = newActorObject(ActorType.Player);
                setRandomPosition(p);
                p.hp_ = 10;
                p.mags_ = 1;
                setCurrentWeapon(p, rand(GAME_CFG.npc.initWeaponLen));
                pushActor(p);
                ++count;
            }
        }
    }

    if (gameMode.bloodRain) {
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
        const item = createRandomItem();
        copyPosFromActorCenter(item, actor);
        addVelFrom(item, actor);
        const v = 16 + 48 * sqrt(random());
        addRadialVelocity(item, random(PI2), v, v);
        limitVelocity(item, 64);
        item.animHit_ = ANIM_HIT_MAX;
        if (actor.weapon_) {
            item.btn_ = ItemType.Weapon;
            item.weapon_ = actor.weapon_;
            //item.clipAmmo_ = actor.clipAmmo_;
            const weapon = weapons[actor.weapon_];
            item.clipAmmo_ = weapon.clipSize_;
            item.mags_ = weapon.clipSize_ ? 1 : 0;
            item.clipReload_ = GAME_CFG.items.lifetime;
            actor.weapon_ = 0;
        } else if (actor.weapon2_) {
            item.btn_ = ItemType.Weapon;
            item.weapon_ = actor.weapon2_;
            //item.clipAmmo_ = actor.clipAmmo2_;
            const weapon = weapons[actor.weapon2_];
            item.clipAmmo_ = weapon.clipSize_;
            item.mags_ = weapon.clipSize_ ? 1 : 0;
            item.clipReload_ = GAME_CFG.items.lifetime;
            actor.weapon2_ = 0;
        }
    }
    if (actor.type_ == ActorType.Player) {
        const grave = newActorObject(ActorType.Barrel);
        copyPosFromActorCenter(grave, actor);
        addVelFrom(grave, actor);
        grave.w_ += 32;
        grave.hp_ = 15;
        grave.sp_ = 4;
        grave.btn_ = 2;
        pushActor(grave);

        addFleshParticles(256, actor, 128, grave);
        addBoneParticles(32, actor, grave);
    }
}

const hitWithBullet = (actor: Actor, bullet: Actor) => {

    let absorbed = false;
    addVelFrom(actor, bullet, 0.1);
    actor.animHit_ = ANIM_HIT_MAX;
    addImpactParticles(8, bullet, bullet, bullets[bullet.btn_ as BulletType].color);
    playAt(actor, Snd.hit);
    if (actor.hp_) {
        let damage = bullet.weapon_;
        if (actor.sp_ > 0) {
            const q = clamp(damage, 0, actor.sp_);
            if (q > 0) {
                actor.sp_ -= q;
                damage -= q;
                if (actor.type_ === ActorType.Player) {
                    addImpactParticles(16, actor, bullet, [0x999999, 0x00CCCC, 0xFFFF00]);
                    playAt(actor, Snd.hurt);
                }
                absorbed = true;
            }
        }
        if (damage) {
            const q = clamp(damage, 0, actor.hp_);
            if (q > 0) {
                actor.hp_ -= q;
                damage -= q;
                if (actor.type_ === ActorType.Player) {
                    addFleshParticles(16, actor, 64, bullet);
                    playAt(actor, Snd.hurt);
                }
                absorbed = true;
            }
        }
        if (damage) {
            // over-damage effect
        }

        if (!actor.hp_) {
            // could be effect if damage is big
            kill(actor);
            if (actor.type_ === ActorType.Player) {
                // reset frags on death
                const killed = state.stats_.get(actor.client_);
                if (killed) {
                    killed.frags_ = 0;
                }

                const killerID = bullet.client_;
                if (killerID > 0 && !actor.type_) {
                    const stat = state.stats_.get(killerID) ?? {scores_: 0, frags_: 0};
                    stat.scores_ += actor.client_ > 0 ? 5 : 1;
                    ++stat.frags_;
                    state.stats_.set(killerID, stat);
                    if (settings.speech && gameTic > lastAudioTic) {
                        const a = getNameByClientId(killerID);
                        const b = getNameByClientId(actor.client_);
                        if (a) {
                            let text = fxRandElement(b ? GAME_CFG.voice.killAB : GAME_CFG.voice.killNPC);
                            text = text.replace("{0}", a);
                            text = text.replace("{1}", b);
                            speak(text);
                        }
                    }
                }
            }
        }
    }
    if (bullet.hp_ && bullet.btn_ != BulletType.Ray) {
        // bullet hit or bounced?
        if (absorbed) {
            bullet.hp_ = 0;
        } else {
            --bullet.hp_;
            if (bullet.hp_) {
                let nx = bullet.x_ - actor.x_;
                let ny = bullet.y_ - actor.y_;
                const dist = sqrt(nx * nx + ny * ny);
                if (dist > 0) {
                    nx /= dist;
                    ny /= dist;
                    reflectVelocity(bullet, nx, ny, 1);
                    const pen = actorsConfig[actor.type_].radius + BULLET_RADIUS + 1;
                    bullet.x_ = actor.x_ + pen * nx;
                    bullet.y_ = actor.y_ + pen * ny;
                }
            }
        }
    }
}

const swapWeaponSlot = (player: Actor) => {
    const weapon = player.weapon_;
    const ammo = player.clipAmmo_;
    player.weapon_ = player.weapon2_;
    player.clipAmmo_ = player.clipAmmo2_;
    player.weapon2_ = weapon;
    player.clipAmmo2_ = ammo;
}

const needReloadWeaponIfOutOfAmmo = (player: Actor) => {
    if (player.weapon_ && !player.clipReload_) {
        const weapon = weapons[player.weapon_];
        if (weapon.clipSize_ && !player.clipAmmo_) {
            if (player.mags_) {
                // start auto reload
                player.clipReload_ = weapon.clipReload_;
            }
            // auto swap to available full weapon
            else {
                if (player.weapon2_ && (player.clipAmmo2_ || !weapons[player.weapon2_].clipSize_)) {
                    swapWeaponSlot(player);
                }
                if (isMyPlayer(player) && !(player.trig_ & ControlsFlag.DownEvent_Fire)) {
                    addTextParticle(player, "EMPTY!");
                }
                player.s_ = weapon.reloadTime_;
            }
        }
    }
}

function calcVelocityWithWeapon(player: Actor, velocity: number): number {
    const k = player.weapon_ ? weapons[player.weapon_].moveWeightK : 1.0;
    return (velocity * k) | 0;
}

const updatePlayer = (player: Actor) => {
    if (gameMode.runAI && (!player.client_ || gameMode.playersAI)) {
        updateAI(state, player);
    }
    let landed = player.z_ == 0 && player.w_ == 0;
    if (player.btn_ & ControlsFlag.Jump) {
        if (landed) {
            player.z_ = 1;
            player.w_ = calcVelocityWithWeapon(player, GAME_CFG.player.jumpVel);
            landed = false;
            playAt(player, Snd.jump);
            addLandParticles(player, 240, 8);
        }
    }
    const c = (landed ? 16 : 8) / Const.NetFq;
    const moveAngle = unpackAngleByte(player.btn_ >> ControlsFlag.MoveAngleBit, ControlsFlag.MoveAngleMax);
    const lookAngle = unpackAngleByte(player.btn_ >> ControlsFlag.LookAngleBit, ControlsFlag.LookAngleMax);
    const moveDirX = cos(moveAngle);
    const moveDirY = sin(moveAngle);
    const lookDirX = cos(lookAngle);
    const lookDirY = sin(lookAngle);
    if (player.btn_ & ControlsFlag.Move) {
        const vel = calcVelocityWithWeapon(player,
            (player.btn_ & ControlsFlag.Run) ? GAME_CFG.player.runVel : GAME_CFG.player.walkVel
        );
        player.u_ = reach(player.u_, vel * moveDirX, vel * c);
        player.v_ = reach(player.v_, vel * moveDirY, vel * c);
        if (landed) {
            const L = 256;
            const S = (L / vel) | 0;
            const moment = (gameTic + player.anim0_) % S;
            if (!moment) {
                if (!random1i(4)) {
                    addLandParticles(player, 240, 1);
                }
                const moment2 = (gameTic + player.anim0_) % (2 * S);
                addStepSplat(player, moment2 ? 120 : -120);

                const moment4 = (gameTic + player.anim0_) % (4 * S);
                if (!moment4) {
                    playAt(player, Snd.step);
                }
            }
        }
    } else {
        applyGroundFriction(player, 32 * c);
    }

    if (player.btn_ & ControlsFlag.Swap) {
        if (!(player.trig_ & ControlsFlag.DownEvent_Swap)) {
            player.trig_ |= ControlsFlag.DownEvent_Swap;
            if (player.weapon2_) {
                swapWeaponSlot(player);
            }
        }
    } else {
        player.trig_ &= ~ControlsFlag.DownEvent_Swap;
    }

    if (player.weapon_) {
        const weapon = weapons[player.weapon_];
        // Reload button
        if (player.btn_ & ControlsFlag.Reload) {
            if (couldBeReloadedManually(player)) {
                if (player.mags_) {
                    player.clipReload_ = weapon.clipReload_;
                } else {
                    if (isMyPlayer(player) && !(player.trig_ & ControlsFlag.DownEvent_Reload)) {
                        addTextParticle(player, "NO MAGS!");
                    }
                }
            }
            player.trig_ |= ControlsFlag.DownEvent_Reload;
        } else {
            player.trig_ &= ~ControlsFlag.DownEvent_Reload;
        }
        if (weapon.clipSize_ && player.clipReload_ && player.mags_) {
            --player.clipReload_;
            if (!player.clipReload_) {
                --player.mags_;
                player.clipAmmo_ = weapon.clipSize_;
            }
        }
        if (player.btn_ & ControlsFlag.Fire) {
            // reload-tics = NetFq / Rate
            player.s_ = dec1(player.s_);
            if (!player.s_) {
                needReloadWeaponIfOutOfAmmo(player);
                const loaded = !weapon.clipSize_ || (!player.clipReload_ && player.clipAmmo_);
                if (loaded) {
                    if (weapon.clipSize_) {
                        --player.clipAmmo_;
                        if (!player.clipAmmo_) {
                            needReloadWeaponIfOutOfAmmo(player);
                        }
                    }
                    if (isMyPlayer(player)) {
                        cameraShake = max(weapon.cameraShake_, cameraShake);
                        cameraFeedback = 5;
                    }
                    player.s_ = weapon.reloadTime_;
                    player.detune_ = reach(player.detune_, weapon.detuneSpeed_, 1);
                    if (player.z_ <= 0) {
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
                        bullet.client_ = player.client_ || -player.id_;
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
                player.trig_ |= ControlsFlag.DownEvent_Fire;
            }
        } else {
            player.trig_ &= ~ControlsFlag.DownEvent_Fire;
            player.detune_ = (player.detune_ / 3) | 0;
            player.s_ = reach(player.s_, weapon.launchTime_, weapon.relaunchSpeed_);
        }
    }

    const prevVelZ = player.w_;
    updateActorPhysics(player);

    if (!landed) {
        const isLanded = player.z_ <= 0 && prevVelZ <= 0;
        if (isLanded) {
            const count = 8;
            const n = abs(count * prevVelZ / GAME_CFG.player.jumpVel) | 0;
            if (n > 0) {
                addLandParticles(player, 240, n);
            }
        }
    }
}

export const spawnFleshParticles = (actor: Actor, expl: number, amount: number, vel?: Vel) => {
    addFleshParticles(amount, actor, expl, vel);
}

const cloneState = (_state: StateData = state): StateData => ({
    ..._state,
    actors_: _state.actors_.map(list => list.map(a => ({...a}))),
    stats_: new Map(_state.stats_.entries()),
});

const beginPrediction = (): boolean => {
    // if (!Const.Prediction || time < 0.001) return false;
    if (!Const.Prediction) return false;

    // global state
    let frames = min(Const.PredictionMax, ((lastFrameTs - prevTime) * Const.NetFq) | 0);
    if (!frames) return false;

    // save particles
    saveParticles();

    // save state
    lastState = state;
    state = cloneState();

    // && gameTic <= lastInputTic
    while (frames--) {
        simulateTic();
        normalizeState();
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
    // prepare objects draw list first
    collectVisibleActors(trees, ...state.actors_);
    drawList.sort((a, b) => WORLD_BOUNDS_SIZE * (a.y_ - b.y_) + a.x_ - b.x_);

    beginFogRender();
    drawFogObjects(state.actors_[ActorType.Player], state.actors_[ActorType.Bullet], state.actors_[ActorType.Item]);
    if (gameMode.title) {
        drawFogPoint(gameCamera[0], gameCamera[1], 3 + fxRandom(1), 1);
    }
    flush();

    gl.clear(GL.DEPTH_BUFFER_BIT);
    gl.clearDepth(1);
    gl.enable(GL.DEPTH_TEST);
    gl.depthFunc(GL.LESS);
    gl.depthMask(true);
    gl.depthRange(0, 1);

    beginRenderToMain(0, 0, 0, 0, 0, getScreenScale());
    ui_renderOpaque();
    flush();

    beginRenderToMain(
        gameCamera[0] + (fxRandomNorm(cameraShake / 5) | 0),
        gameCamera[1] + (fxRandomNorm(cameraShake / 5) | 0),
        0.5, 0.5,
        fxRandomNorm(cameraShake / (8 * 50)),
        1 / gameCamera[2]
    );

    {
        const cameraCenterX = gameCamera[0] + (fxRandomNorm(cameraShake / 5) | 0);
        const cameraCenterY = gameCamera[1] + (fxRandomNorm(cameraShake / 5) | 0);
        const viewScale = 1 / gameCamera[2];
        let fx = fxRandomNorm(cameraShake / (8 * 50));
        let fz = fxRandomNorm(cameraShake / (8 * 50));
        fx += gameMode.tiltCamera * Math.sin(lastFrameTs);
        fz += gameMode.tiltCamera * Math.cos(lastFrameTs);
        setupWorldCameraMatrix(cameraCenterX, cameraCenterY, viewScale, fx, fz);
    }

    {
        const add = ((getHitColorOffset(getMyPlayer()?.animHit_) & 0x990000) >>> 16) / 0xFF;
        ambientColor[0] = clamp(0x40 / 0xFF + (0x20 / 0xFF) * sin(lastFrameTs) + add, 0, 1);
        ambientColor[1] = 0x11 / 0xFF;
        ambientColor[2] = 0x33 / 0xFF;
        ambientColor[3] = 0.8;
        setLightMapTexture(fogTexture.texture_);
    }

    drawOpaqueParticles();
    drawOpaqueObjects();
    drawSplatsOpaque();
    flush();

    // gl.enable(GL.DEPTH_TEST);
    gl.depthFunc(GL.LEQUAL);
    gl.depthMask(false);

    setLightMapTexture(emptyTexture.texture_);
    // skybox
    {
        const tex = fnt[0].textureBoxLT;
        const fullAmbientColor = RGB(ambientColor[0] * 0xFF, ambientColor[1] * 0xFF, ambientColor[2] * 0xFF);
        draw(tex, -1000, -1000, 0, BOUNDS_SIZE + 2000, 1001, 1, fullAmbientColor);
        draw(tex, -1000, BOUNDS_SIZE - 1, 0, BOUNDS_SIZE + 2000, 1001, 1, fullAmbientColor);
        draw(tex, -1000, 0, 0, 1001, BOUNDS_SIZE, 1, fullAmbientColor);
        draw(tex, BOUNDS_SIZE - 1, 0, 0, 1001, BOUNDS_SIZE, 1, fullAmbientColor);
    }
    flush();

    setLightMapTexture(fogTexture.texture_);

    setDrawZ(0);
    draw(mapTexture, 0, 0);

    drawObjects();

    if (getDevSetting("dev_collision")) {
        drawCollisions(drawList);
    }

    if (gameMode.title) {
        setDrawZ(1);
        for (let i = 10; i > 0; --i) {
            let a = 0.5 * sin(i / 4 + lastFrameTs * 16);
            const color = RGB((0x20 * (11 - i) + 0x20 * a) & 0xFF, 0, 0);
            const scale = 1 + i / 100;
            const angle = a * i / 100;
            const i4 = i / 4;
            const y1 = gameCamera[1] + i4;
            drawMeshSpriteUp(img[Img.logo_title], gameCamera[0] + fxRandomNorm(i4), y1 + 40 + fxRandomNorm(i4), 40, angle, scale, scale, 1, color);
        }
    }
    flush();

    setLightMapTexture(emptyTexture.texture_);
    gl.disable(GL.DEPTH_TEST);
    setDrawZ(0);
    drawTextParticles();
    drawHotUsableHint(hotUsable);
    flush();
}

const drawOverlay = () => {
    setDrawZ(1000);
    const scale = getScreenScale();
    beginRenderToMain(0, 0, 0, 0, 0, scale);

    if (clientId) {
        drawMiniMap(state, trees, gl.drawingBufferWidth / scale, 0);
    }

    if (!gameMode.title) {
        printStatus();
        drawVirtualPad();
    }

    if (getDevSetting("dev_info")) {
        printDebugInfo(gameTic, getMinTic(), lastFrameTs, prevTime, drawList, state, trees, clients);
    }

    if (getDevSetting("dev_fps")) {
        drawText(fnt[0], `FPS: ${stats.fps} | DC: ${stats.drawCalls} |  ⃤ ${stats.triangles} | ∷${stats.vertices}`, 4, 2, 5, 0, 0);
    }

    ui_renderNormal();

    drawCrosshair(getMyPlayer(), gameCamera, scale);

    flush();
}

const drawList: Actor[] = [];

const collectVisibleActors = (...lists: Actor[][]) => {
    drawList.length = 0;
    const pad = 2 * OBJECT_RADIUS / WORLD_SCALE;
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


function drawPlayerOpaque(p: Actor): void {
    const co = getHitColorOffset(p.animHit_);
    const basePhase = p.anim0_ + lastFrameTs;
    const colorC = GAME_CFG.bodyColor[p.anim0_ % GAME_CFG.bodyColor.length];
    const colorArm = colorC;
    const colorBody = colorC;
    const x = p.x_ / WORLD_SCALE;
    const y = p.y_ / WORLD_SCALE;
    const z = p.z_ / WORLD_SCALE;
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
    let weaponY = y;
    let weaponZ = z + PLAYER_HANDS_PX_Z;
    let weaponAngle = atan2(
        y + 1000 * sin(viewAngle) - weaponY + weaponZ,
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

    if (p.weapon_) {
        drawMeshSpriteUp(img[Img.weapon0 + p.weapon_], weaponX, weaponY/* + (weaponBack ? -1 : 1)*/, weaponZ, weaponAngle, weaponSX, weaponSY);
    }

    drawMeshSpriteUp(img[Img.box_t], x - 3, y, z + 5, 0, 2, leg1, 1, colorArm, 0, co);
    drawMeshSpriteUp(img[Img.box_t], x + 3, y, z + 5, 0, 2, leg2, 1, colorArm, 0, co);
    drawMeshSpriteUp(img[Img.box], x, y, z + 7 - base, 0, 8, 6, 1, colorBody, 0, co);

    // DRAW HANDS
    const rArmX = x + 4;
    const lArmX = x - 4;
    const armAY = y - z - PLAYER_HANDS_PX_Z + base * 2;
    const weaponAY = weaponY - weaponZ;
    const rArmRot = atan2(-armAY + weaponAY, weaponX - rArmX);
    const lArmRot = atan2(-armAY + weaponAY, weaponX - lArmX);
    const lArmLen = hypot(weaponX - lArmX, weaponAY - armAY) - 1;
    const rArmLen = hypot(weaponX - rArmX, weaponAY - armAY) - 1;

    if (p.weapon_) {
        drawMeshSpriteUp(img[Img.box_l], x + 4, y + 0.2, z + 10 - base, rArmRot, rArmLen, 2, 1, colorArm, 0, co);
        drawMeshSpriteUp(img[Img.box_l], x - 4, y + 0.2, z + 10 - base, lArmRot, lArmLen, 2, 1, colorArm, 0, co);
    } else {
        let sw1 = walk * sin(20 * runK * basePhase);
        let sw2 = walk * cos(20 * runK * basePhase);
        let armLen = 5;
        if (!p.client_ && p.hp_ < 10 && !p.sp_) {
            sw1 -= PI / 2;
            sw2 += PI / 2;
            armLen += 4;
        }
        drawMeshSpriteUp(img[Img.box_l], x + 4, y + 0.2, z + 10 - base, sw1 + PI / 4, armLen, 2, 1, colorArm, 0, co);
        drawMeshSpriteUp(img[Img.box_l], x - 4, y + 0.2, z + 10 - base, sw2 + PI - PI / 4, armLen, 2, 1, colorArm, 0, co);
    }

    {
        const imgHead = p.client_ ? (Img.avatar0 + p.anim0_ % Img.num_avatars) : (Img.npc0 + p.anim0_ % Img.num_npc);
        const s = p.w_ / 500;
        const a = p.u_ / 500;
        drawMeshSpriteUp(img[imgHead], x, y + 0.1, z + 16 - base * 2, a, 1 - s, 1 + s, 1, 0xFFFFFF, 0, co);
    }
}

const drawPlayer = (p: Actor): void => {
    const x = p.x_ / WORLD_SCALE;
    const y = p.y_ / WORLD_SCALE;

    if (p.client_ > 0 && p.client_ !== clientId) {
        let name = getNameByClientId(p.client_);
        if (process.env.NODE_ENV === "development") {
            name = (name ?? "") + " #" + p.client_
        }
        if (name) {
            setDrawZ(32);
            drawTextShadowCenter(fnt[0], name, 6, x, y + 1);
        }
    }
}

type ActorDrawFunction = (p: Actor) => void;
const DRAW_BY_TYPE: (ActorDrawFunction)[] = [
    drawPlayer,
    ,
    drawBullet,
    ,
    ,
];

const DRAW_OPAQUE_BY_TYPE: (ActorDrawFunction | undefined)[] = [
    drawPlayerOpaque,
    drawBarrelOpaque,
    ,
    drawItemOpaque,
    drawTreeOpaque,
];

function drawOpaqueObjects() {
    for (let i = drawList.length - 1; i >= 0; --i) {
        const actor = drawList[i];
        DRAW_OPAQUE_BY_TYPE[actor.type_]?.(actor);
    }
}

const drawObjects = () => {
    setDrawZ(0.15);
    drawShadows(drawList);
    drawParticleShadows();
    for (const actor of drawList) {
        DRAW_BY_TYPE[actor.type_]?.(actor);
    }
}

const playAt = (actor: Actor, id: Snd) => {
    if (gameTic > lastAudioTic) {
        const r = GAME_CFG.camera.listenerRadius;
        const dx = (actor.x_ / WORLD_SCALE - gameCamera[0]) / r;
        const dy = (actor.y_ / WORLD_SCALE - gameCamera[1]) / r;
        const v = 1 - hypot(dx, dy);
        if (v > 0) {
            play(snd[id], v, clamp(dx, -1, 1));
        }
    }
}
