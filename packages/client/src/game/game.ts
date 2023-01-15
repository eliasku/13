import {ClientID} from "../../../shared/src/types";
import {_room, _sseState, clientId, clientName, disconnect, isPeerConnected, remoteClients} from "../net/messaging";
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
    BarrelActor,
    BulletActor,
    Client,
    ClientEvent,
    ItemActor,
    ItemType,
    newStateData,
    packAngleByte,
    packDirByte,
    Packet,
    PlayerActor,
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
import {newSeedFromTime} from "@eliasku/13-shared/src/seed";

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
let playersGrid: PlayerActor[][] = [];
let barrelsGrid: BarrelActor[][] = [];
let treesGrid: Actor[][] = [];
let hotUsable: ItemActor | null = null;

// dynamic state
let state: StateData = newStateData();
let lastState: StateData;
export const gameMode = {
    title: false,
    runAI: false,
    playersAI: false,
    hasPlayer: false,
    tiltCamera: 0.0,
    bloodRain: false,
    npcLevel: 0,
};

// 0...50
let cameraShake = 0;

// 0...5
let cameraFeedback = 0;

// colors
const newActor = (type: ActorType): Actor =>
    ({
        _id: state._nextId++,

        _type: type,
        _subtype: 0,

        _x: 0,
        _y: 0,
        _z: 0,

        _u: 0,
        _v: 0,
        _w: 0,

        _client: 0,

        _s: 0,

        _weapon: 0,
        _anim0: rand(0x100),
        _animHit: 31,
        _hp: 1,
        _sp: 0,
        _mags: 0,

        _clipAmmo: 0,

        _fstate: 0,
    });

const newPlayerActor = (): PlayerActor => Object.assign(newActor(ActorType.Player), {
    _input: 0,
    _trig: 0,
    _detune: 0,
    _weapon2: 0,
    _clipAmmo2: 0,
    _clipReload: 0,
});

const createItemActor = (subtype: number): ItemActor => {
    const item = newActor(ActorType.Item) as ItemActor;
    item._subtype = subtype;
    item._s = GAME_CFG._items._lifetime;
    item._animHit = ANIM_HIT_OVER;
    pushActor(item);
    return item;
}

const createRandomItem = (): Actor => {
    return createItemActor(rand(6));
}

const requireClient = (id: ClientID): Client => getOrCreate(clients, id, () => ({
    _id: id,
    _tic: 0,
    _ts0: 0,
    _ts1: 0,
    _acknowledgedTic: 0
}));

const requireStats = (id: ClientID): PlayerStat => getOrCreate(state._stats, id, () => ({_frags: 0, _scores: 0}));

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
    gameMode.npcLevel = 0;
    gameMode.bloodRain = false;
}

const recreateMap = (themeIdx: number, seed: number) => {
    // generate map
    _SEEDS[0] = seed;
    const theme = generateMapBackground(themeIdx);
    trees.length = 0;
    treesGrid.length = 0;
    const nextId = state._nextId;
    for (let i = 0; i < GAME_CFG._trees._initCount; ++i) {
        const tree = newActor(ActorType.Tree);
        tree._subtype = theme.treeGfx[rand(theme.treeGfx.length)];
        tree._hp = 0;
        setRandomPosition(tree);
        trees.push(tree);
        addToGrid(treesGrid, tree);
    }
    _SEEDS[0] = state._seed;
    state._nextId = nextId;
}

const pushActor = <T extends Actor>(a: T) => {
    const list = state._actors[a._type as (0 | 1 | 2 | 3)] as T[];
    if (process.env.NODE_ENV === "development") {
        console.assert(list && list.indexOf(a) < 0);
    }
    list.push(a);
}

function initBarrels() {
    const count = GAME_CFG._barrels._initCount;
    const hp = GAME_CFG._barrels._hp;
    for (let i = 0; i < count; ++i) {
        const barrel: BarrelActor = newActor(ActorType.Barrel);
        barrel._hp = hp[0] + rand(hp[1] - hp[0]);
        barrel._subtype = rand(2);
        setRandomPosition(barrel);
        pushActor(barrel);
    }
}

export const createSeedGameState = () => {
    startTic = 0;
    gameTic = 1;
    state._mapSeed = state._seed = _SEEDS[0];
    recreateMap(_room.mapTheme, _room.mapSeed);
    initBarrels();
}

export const createSplashState = () => {
    startTic = 0;
    gameTic = 1;
    state._seed = state._mapSeed = _SEEDS[0];
    recreateMap(Math.floor(Math.random() * 3), newSeedFromTime());
    for (let i = 0; i < 13; ++i) {
        const k = i / 13;
        const player = newPlayerActor();
        player._client = 1 + i;
        player._hp = 10;
        player._mags = 10;
        player._sp = 10;
        setCurrentWeapon(player, 1 + (i % (weapons.length - 1)));
        player._anim0 = i + rand(10) * Img.num_avatars;
        player._input = packAngleByte(k, ControlsFlag.LookAngleMax) << ControlsFlag.LookAngleBit;
        const D = 80 + 20 * sqrt(random());
        player._x = (BOUNDS_SIZE / 2 + D * cos(k * PI2)) * WORLD_SCALE;
        player._y = (BOUNDS_SIZE / 2 + D * sin(k * PI2) + 10) * WORLD_SCALE;
        pushActor(player);
    }
    gameCamera[0] = gameCamera[1] = BOUNDS_SIZE / 2;
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
    if (startTic < 0 && remoteClients.size) {
        const minTic = getMinTic();
        let actualStateCount = 0;
        let maxState: StateData | null = null;
        let maxStateTic: number = 0;
        let playingClients = 0;
        for (const [id, _] of remoteClients) {
            const client = clients.get(id);
            if (client) {
                if (client._isPlaying) {
                    ++playingClients;
                }
                if (client._startState && client._startState._tic > minTic) {
                    ++actualStateCount;
                    if (client._startState._tic > maxStateTic) {
                        maxStateTic = client._startState._tic;
                        maxState = client._startState;
                    }
                }
            }
        }
        if (maxState && actualStateCount >= playingClients) {
            updateFrameTime(performance.now() / 1000);
            prevTime = lastFrameTs;
            state = maxState;
            gameTic = startTic = state._tic + 1;
            recreateMap(_room.mapTheme, _room.mapSeed);
            normalizeState();
        }
    }
    if (startTic >= 0) {
        cleaningUpClients();
        tryRunTicks(lastFrameTs);
        predicted = beginPrediction();
    }
    if (!document.hidden) {
        drawGame();
        drawOverlay();
        updateMapTexture(lastFrameTs);
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
        if (weapon._clipSize) {
            if (reload) {
                txt += ((100 * (weapon._clipReload - reload) / weapon._clipReload) | 0) + "%";
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
                const hp = p0._hp;
                for (let i = 0; i < 10;) {
                    const o2 = hp > i++;
                    const o1 = hp > i++;
                    str += o1 ? "❤️" : (o2 ? "💔" : "🖤");
                }
                const sp = p0._sp;
                for (let i = 0; i < 10;) {
                    const o2 = sp > i++;
                    const o1 = sp > i++;
                    str += o1 ? "🛡" : (o2 ? "🪖️️" : "");
                }
                termPrint(str);
                {
                    let wpnInfo = getWeaponInfoHeader(p0._weapon, p0._clipAmmo, p0._clipReload);
                    if (p0._weapon2) {
                        wpnInfo += " | " + getWeaponInfoHeader(p0._weapon2, p0._clipAmmo2);
                    }
                    termPrint(wpnInfo);
                }
                termPrint(`🧱${p0._mags}`);
            } else {
                termPrint("tap to respawn");
            }
        } else {
            termPrint("joining");
        }

        const getPlayerIcon = (id?: ClientID) => {
            const player = getPlayerByClient(id);
            return player ? EMOJI[Img.avatar0 + player._anim0 % Img.num_avatars] : "👁️";
        }
        const getPlayerStatInfo = (id?: ClientID): string => {
            const stat = state._stats.get(id);
            return `|☠${stat?._frags ?? 0}|🪙${stat?._scores ?? 0}`;
        }

        termPrint(getPlayerIcon(clientId) + clientName + getPlayerStatInfo(clientId));
        for (const [id, rc] of remoteClients) {
            let text = (isPeerConnected(rc) ? getPlayerIcon(id) : "🔴") + rc._name + getPlayerStatInfo(id);
            if (1 || settings.dev) {
                const cl = clients.get(id);
                if (cl && cl._lag !== undefined) {
                    text += " " + cl._lag;
                }
            }
            termPrint(text);
        }
    }
}

const getMyPlayer = (): PlayerActor | undefined =>
    clientId ? getPlayerByClient(clientId) : undefined;

const getPlayerByClient = (c: ClientID): PlayerActor | undefined =>
    state._actors[ActorType.Player].find(p => p._client == c);

const getLocalEvent = (tic: number, _e?: ClientEvent): ClientEvent => {
    if (!(_e = localEvents.find(e => e._tic == tic))) {
        _e = {_tic: tic, _client: clientId};
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

    if (lastInputCmd !== btn) {
        if (inputTic <= lastInputTic) {
            inputTic = lastInputTic + 1;
        }
        lastInputTic = inputTic;
        // copy flag in case of rewriting local event for ONE-SHOT events
        const g = getLocalEvent(inputTic);
        if (g._btn & ControlsFlag.Spawn) {
            btn |= ControlsFlag.Spawn;
        }

        getLocalEvent(inputTic)._btn = btn;
        lastInputCmd = btn;
    }
}

const checkJoinSync = () => {
    if (!joined && startTic >= 0) {
        for (const [id, rc] of remoteClients) {
            if (isPeerConnected(rc)) {
                const cl = clients.get(id);
                if (!cl || !cl._ready) {
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
    if (!clientId || !joined) {
        _tic = gameTic + Const.InputDelay + (((lastFrameTs - prevTime) * Const.NetFq) | 0);
    }
    let clientsTotal = 0;
    for (const [, client] of clients) {
        if (client._isPlaying) {
            ++clientsTotal;
            if (_tic > client._tic) {
                _tic = client._tic;
            }
        }
    }
    if (!clientsTotal) {
        _tic = gameTic + (((lastFrameTs - prevTime) * Const.NetFq) | 0);
    }
    return _tic;
}

// get minimum tic that already received by
const getMinAckAndInput = (lastTic: number) => {
    for (const [, client] of clients) {
        if (lastTic > client._acknowledgedTic && client._isPlaying) {
            lastTic = client._acknowledgedTic;
        }
    }
    return lastTic;
}

const correctPrevTime = (netTic: number, ts: number) => {
    const lastTic = gameTic - 1;
    if (netTic === lastTic) {
        // limit predicted tics
        if ((ts - prevTime) > Const.InputDelay / Const.NetFq) {
            prevTime = lerp(prevTime, ts - Const.InputDelay / Const.NetFq, 0.01);
        }
    }
    if (lastTic + Const.InputDelay < netTic) {
        prevTime -= 1 / Const.NetFq;
    }
};

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

    correctPrevTime(netTic, ts);

    const lastTic = gameTic - 1;
    receivedEvents = receivedEvents.filter(v => v._tic > lastTic);
    const ackTic = getMinAckAndInput(lastTic);
    localEvents = localEvents.filter(v => v._tic > ackTic);

    return framesSimulated;
}

const _packetBuffer = new Int32Array(1024 * 256);

const sendInput = () => {
    const lastTic = gameTic - 1;
    for (const [id, rc] of remoteClients) {
        if (isPeerConnected(rc)) {
            const cl = requireClient(id);
            const inputTic = getNextInputTic(lastTic);
            if (inputTic > cl._acknowledgedTic) {
                cl._ts0 = performance.now() & 0x7FFFFFFF;
                const packet: Packet = {
                    _sync: cl._isPlaying,
                    // send to Client info that we know already
                    _receivedOnSender: cl._tic,
                    // t: lastTic + simTic + Const.InputDelay,
                    _tic: inputTic,
                    _ts0: cl._ts0,
                    _ts1: cl._ts1,
                    _events: localEvents.filter(e => e._tic > cl._acknowledgedTic && e._tic <= inputTic),
                };
                //console.log(JSON.stringify(packet.events_));
                if (!cl._ready && joined) {
                    packet._state = state;
                    cl._tic = state._tic;
                    cl._acknowledgedTic = state._tic;
                }
                if (process.env.NODE_ENV === "development") {
                    packet._debug = {
                        _nextId: state._nextId,
                        _tic: state._tic,
                        _seed: state._seed,
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
    sender._ts1 = data._ts0;
    sender._lag = (performance.now() & 0x7FFFFFFF) - data._ts1;
    if (startTic < 0 && data._state) {
        if (!sender._startState || data._state._tic > sender._startState._tic) {
            sender._startState = data._state;
        }
    }

    if (process.env.NODE_ENV === "development") {
        if (startTic >= 0) {
            assertStateInSync(sender._id, data, state, gameTic);
        }
    }

    sender._ready = data._sync;
    // ignore old packets
    if (data._tic > sender._tic) {
        sender._isPlaying = true;
        // const debug = [];
        for (const e of data._events) {
            if (e._tic > sender._tic /*alreadyReceivedTic*/) {
                receivedEvents.push(e);
                // debug.push(e);
            }
        }
        // if(debug.length) {
        //     console.info("R: " + JSON.stringify(debug));
        // }
        sender._tic = data._tic;
    }
    // IMPORTANT TO NOT UPDATE ACK IF WE GOT OLD PACKET!! WE COULD TURN REMOTE TO THE PAST
    // just update last ack, now we know that Remote got `acknowledgedTic` amount of our tics,
    // then we will send only events from [acknowledgedTic + 1] index
    if (sender._acknowledgedTic < data._receivedOnSender) {
        // update ack
        sender._acknowledgedTic = data._receivedOnSender;
    }
    // }
}

export const onRTCPacket = (from: ClientID, buffer: ArrayBuffer) => {
    if (_sseState < 3) {
        return;
    }
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
            if (clients.get(id)?._ready && !isPeerConnected(rc)) {
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

const setCurrentWeapon = (player: PlayerActor, weaponId: number) => {
    player._weapon = weaponId;
    const weapon = weapons[weaponId];
    if (weapon) {
        player._clipReload = 0;
        player._clipAmmo = weapon._clipSize;
    }
}

const dropWeapon1 = (player: PlayerActor) => {
    const lookAngle = unpackAngleByte(player._input >> ControlsFlag.LookAngleBit, ControlsFlag.LookAngleMax);
    const lookDirX = cos(lookAngle);
    const lookDirY = sin(lookAngle);

    const item = createItemActor(ItemType.Weapon);
    copyPosFromActorCenter(item, player);
    addPos(item, lookDirX, lookDirY, 0, OBJECT_RADIUS);
    addVelFrom(item, player);
    addVelocityDir(item, lookDirX, lookDirY, 0, 64);
    // set weapon item
    item._weapon = player._weapon;
    item._clipAmmo = player._clipAmmo;
    item._mags = 0;
    player._weapon = 0;
    player._clipAmmo = 0;
}

const lateUpdateDropButton = (player: PlayerActor) => {
    if (player._input & ControlsFlag.Drop) {
        if (!(player._trig & ControlsFlag.DownEvent_Drop)) {
            player._trig |= ControlsFlag.DownEvent_Drop;
            if (player._weapon) {
                dropWeapon1(player);
                if (player._weapon2) {
                    swapWeaponSlot(player);
                }
            }
        }
    } else {
        player._trig &= ~ControlsFlag.DownEvent_Drop;
    }
}

const updateWeaponPickup = (item: Actor, player: PlayerActor) => {
    if (player._input & ControlsFlag.Drop) {
        if (!(player._trig & ControlsFlag.DownEvent_Drop)) {
            player._trig |= ControlsFlag.DownEvent_Drop;
            if (!player._weapon2) {
                swapWeaponSlot(player);
            } else {
                // if 2 slot occupied - replace 1-st weapon
                dropWeapon1(player);
            }
            setCurrentWeapon(player, item._weapon);
            player._mags = min(10, player._mags + item._mags);
            player._clipAmmo = item._clipAmmo;
            playAt(player, Snd.pick);
            item._hp = item._subtype = 0;
        }
    }
}

const isMyPlayer = (actor: PlayerActor) => clientId && actor._client === clientId && actor._type === ActorType.Player;

const pickItem = (item: ItemActor, player: PlayerActor) => {
    if (testIntersection(item, player)) {
        const withMyPlayer = isMyPlayer(player);
        if (item._subtype & ItemType.Weapon) {
            if (withMyPlayer && !hotUsable) {
                hotUsable = item;
            }
            // suck in mags
            if (item._mags && player._mags < 10) {
                const freeQty = 10 - player._mags;
                const qty = clamp(0, item._mags, freeQty);
                item._mags -= qty;
                player._mags = min(10, player._mags + qty);
                playAt(player, Snd.pick);
                if (withMyPlayer) {
                    addTextParticle(item, `+${qty} mags`);
                }
            }
            updateWeaponPickup(item, player);
        } else {
            if (item._subtype === ItemType.Hp || item._subtype === ItemType.Hp2) {
                if (player._hp < 10) {
                    const qty = item._subtype === ItemType.Hp2 ? 2 : 1;
                    player._hp = min(10, player._hp + qty);
                    item._hp = item._subtype = 0;
                    playAt(player, Snd.heal);
                    if (withMyPlayer) {
                        addTextParticle(item, `+${qty} hp`);
                    }
                }
            } else if (item._subtype === ItemType.Credit || item._subtype === ItemType.Credit2) {
                if (player._client) {
                    const stat = requireStats(player._client);
                    const qty = item._subtype === ItemType.Credit2 ? 5 : 1;
                    stat._scores += qty;
                    item._hp = item._subtype = 0;
                    playAt(player, Snd.pick);
                    if (withMyPlayer) {
                        addTextParticle(item, `+${qty} cr`);
                    }
                }
            } else if (item._subtype === ItemType.Ammo) {
                if (player._mags < 10) {
                    const qty = 1;
                    player._mags = min(10, player._mags + qty);
                    item._hp = item._subtype = 0;
                    playAt(player, Snd.pick);
                    if (withMyPlayer) {
                        addTextParticle(item, `+${qty} mags`);
                    }
                }
            } else if (item._subtype === ItemType.Shield) {
                if (player._sp < 10) {
                    const qty = 1;
                    ++player._sp;
                    item._hp = item._subtype = 0;
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
        const l = state._actors[ActorType.Player].filter(p => p._client && clients.has(p._client));
        return l.length ? l[((lastFrameTs / 5) | 0) % l.length] : undefined;
    }
    let scale = GAME_CFG._camera._baseScale;
    let cameraX = gameCamera[0];
    let cameraY = gameCamera[1];
    if (clientId && !gameMode.title) {
        const myPlayer = getMyPlayer();
        const p0 = myPlayer ?? getRandomPlayer();
        if (p0?._client) {
            const wpn = weapons[p0._weapon];
            const px = p0._x / WORLD_SCALE;
            const py = p0._y / WORLD_SCALE;
            cameraX = px;
            cameraY = py;
            if (myPlayer) {
                const viewM = 100 * wpn._cameraFeedback * cameraFeedback / (hypot(viewX, viewY) + 0.001);
                cameraX += wpn._cameraLookForward * (lookAtX - px) - viewM * viewX;
                cameraY += wpn._cameraLookForward * (lookAtY - py) - viewM * viewY;
            }
            scale *= wpn._cameraScale;
        }
    }
    gameCamera[0] = lerp(gameCamera[0], cameraX, 0.1);
    gameCamera[1] = lerp(gameCamera[1], cameraY, 0.1);
    gameCamera[2] = lerpLog(gameCamera[2], scale / getScreenScale(), 0.05);
}

const normalizeState = () => {
    for (const list of state._actors) {
        // sort by id
        list.sort((a: Actor, b: Actor): number => a._id - b._id);
        // normalize properties
        roundActors(list);
    }
}

const checkBulletCollision = (bullet: BulletActor, actor: Actor) => {
    if (bullet._hp &&
        bullet._weapon &&
        (bullet._client > 0 ? (bullet._client - actor._client) : (-bullet._client - actor._id)) &&
        testIntersection(bullet, actor)) {
        hitWithBullet(actor, bullet);
    }
};

const simulateTic = () => {
    const processTicCommands = (tic_events: number | ClientEvent[]) => {
        tic_events = localEvents.concat(receivedEvents).filter(v => v._tic == tic_events);
        tic_events.sort((a, b) => a._client - b._client);
        for (const cmd of tic_events) {
            if (cmd._btn !== undefined) {
                const player = getPlayerByClient(cmd._client);
                if (player) {
                    player._input = cmd._btn;
                } else if (cmd._btn & ControlsFlag.Spawn) {
                    const p = newPlayerActor();
                    p._client = cmd._client;
                    setRandomPosition(p);

                    if (clientId == cmd._client) {
                        gameCamera[0] = p._x / WORLD_SCALE;
                        gameCamera[1] = p._y / WORLD_SCALE;
                    }
                    p._hp = GAME_CFG._player._hp;
                    p._sp = GAME_CFG._player._sp;
                    p._mags = GAME_CFG._player._mags;
                    p._input = cmd._btn;
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

    for (const a of state._actors[ActorType.Player]) {
        updatePlayer(a);
        addToGrid(playersGrid, a);
        a._fstate = 1;
    }

    if (process.env.NODE_ENV === "development") {
        saveDebugState(cloneState());
    }

    for (const a of state._actors[ActorType.Barrel]) {
        updateActorPhysics(a);
        addToGrid(barrelsGrid, a);
        a._fstate = 1;
    }

    hotUsable = null;
    for (const item of state._actors[ActorType.Item]) {
        updateActorPhysics(item);
        if (!item._animHit) {
            queryGridCollisions(item, playersGrid, pickItem);
        }
        if (item._hp && item._s) {
            if ((gameTic % 3) === 0) {
                --item._s;
                if (!item._s) {
                    item._hp = 0;
                }
            }
        }
    }

    for (const player of state._actors[ActorType.Player]) {
        lateUpdateDropButton(player);
    }

    for (const bullet of state._actors[ActorType.Bullet]) {
        if (bullet._subtype != BulletType.Ray) {
            updateBody(bullet, 0, 0);
            if (bullet._hp && collideWithBoundsA(bullet)) {
                --bullet._hp;
                addImpactParticles(8, bullet, bullet, bullets[bullet._subtype as BulletType]._color);
            }
            queryGridCollisions(bullet, playersGrid, checkBulletCollision);
            queryGridCollisions(bullet, barrelsGrid, checkBulletCollision);
            queryGridCollisions(bullet, treesGrid, checkBulletCollision);
        }
        if (bullet._s && !--bullet._s) {
            bullet._hp = 0;
        }
    }
    state._actors[0] = state._actors[0].filter(x => x._hp > 0);
    state._actors[1] = state._actors[1].filter(x => x._hp > 0);
    state._actors[2] = state._actors[2].filter(x => x._hp > 0);
    state._actors[3] = state._actors[3].filter(x => x._hp > 0);

    for (const a of state._actors[ActorType.Player]) {
        a._fstate = 0;
        queryGridCollisions(a, treesGrid, checkBodyCollision);
        queryGridCollisions(a, barrelsGrid, checkBodyCollision);
        queryGridCollisions(a, playersGrid, checkBodyCollision, 0);
    }
    for (const a of state._actors[ActorType.Barrel]) {
        a._fstate = 0;
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

    if (gameMode.npcLevel) {
        const npcConfig = GAME_CFG._npc[gameMode.npcLevel];
        const NPC_PERIOD_MASK = (1 << npcConfig._period) - 1;
        if ((gameTic & NPC_PERIOD_MASK) === 0) {
            let count = 0;
            for (const player of state._actors[ActorType.Player]) {
                if (!player._client) {
                    ++count;
                }
            }
            // while (count < GAME_CFG.npc.max) {
            if (count < npcConfig._max) {
                const p = newPlayerActor();
                setRandomPosition(p);
                p._hp = 10;
                p._mags = 1;
                setCurrentWeapon(p, rand(npcConfig._initWeaponLen));
                pushActor(p);
                ++count;
            }
        }
    }

    if (gameMode.bloodRain) {
        const source = newActor(0);
        source._x = fxRand(WORLD_BOUNDS_SIZE);
        source._y = fxRand(WORLD_BOUNDS_SIZE);
        source._z = fxRand(128) * WORLD_SCALE;
        source._type = 0;
        spawnFleshParticles(source, 128, 1);
    }

    if (lastAudioTic < gameTic) {
        lastAudioTic = gameTic;
    }

    state._seed = _SEEDS[0];
    state._tic = gameTic++;
}

const castRayBullet = (bullet: Actor, dx: number, dy: number) => {
    for (const a of state._actors[ActorType.Player]) {
        if (a._client - bullet._client &&
            testRayWithSphere(bullet, a, dx, dy)) {
            hitWithBullet(a, bullet);
        }
    }
    for (const a of state._actors[ActorType.Barrel]) {
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
    const player = actor._type == ActorType.Player ? (actor as PlayerActor) : null;

    let dropWeapon1 = 0;
    if (actor._type === ActorType.Barrel && actor._subtype < 2) {
        const weaponChance = GAME_CFG._barrels._dropWeapon._chance;
        const weaponMin = GAME_CFG._barrels._dropWeapon._min;
        if (rand(100) < weaponChance) {
            dropWeapon1 = weaponMin + rand(weapons.length - weaponMin);
        }
    } else if (actor._weapon) {
        dropWeapon1 = actor._weapon;
        actor._weapon = 0;
    }

    for (let i = 0; i < amount; ++i) {
        const item = createRandomItem();
        copyPosFromActorCenter(item, actor);
        addVelFrom(item, actor);
        const v = 16 + 48 * sqrt(random());
        addRadialVelocity(item, random(PI2), v, v);
        limitVelocity(item, 64);
        if (dropWeapon1) {
            item._subtype = ItemType.Weapon;
            item._weapon = dropWeapon1;
            const weapon = weapons[dropWeapon1];
            item._clipAmmo = weapon._clipSize;
            item._mags = weapon._clipSize ? 1 : 0;
            dropWeapon1 = 0;
        } else if (player?._weapon2) {
            item._subtype = ItemType.Weapon;
            item._weapon = player._weapon2;
            const weapon = weapons[player._weapon2];
            item._clipAmmo = weapon._clipSize;
            item._mags = weapon._clipSize ? 1 : 0;
            player._weapon2 = 0;
        }
    }
    if (player) {
        const grave = newActor(ActorType.Barrel);
        copyPosFromActorCenter(grave, actor);
        addVelFrom(grave, actor);
        grave._w += 32;
        grave._hp = 15;
        grave._sp = 4;
        grave._subtype = 2;
        pushActor(grave);

        addFleshParticles(256, actor, 128, grave);
        addBoneParticles(32, actor, grave);
    }
}

const hitWithBullet = (actor: Actor, bullet: BulletActor) => {

    let absorbed = false;
    addVelFrom(actor, bullet, 0.1);
    actor._animHit = ANIM_HIT_MAX;
    addImpactParticles(8, bullet, bullet, bullets[bullet._subtype as BulletType]._color);
    playAt(actor, Snd.hit);
    if (actor._hp) {
        let damage = bullet._weapon;
        if (actor._sp > 0) {
            const q = clamp(damage, 0, actor._sp);
            if (q > 0) {
                actor._sp -= q;
                damage -= q;
                if (actor._type === ActorType.Player) {
                    addImpactParticles(16, actor, bullet, [0x999999, 0x00CCCC, 0xFFFF00]);
                    playAt(actor, Snd.hurt);
                }
                absorbed = true;
            }
        }
        if (damage) {
            const q = clamp(damage, 0, actor._hp);
            if (q > 0) {
                actor._hp -= q;
                damage -= q;
                if (actor._type === ActorType.Player) {
                    addFleshParticles(16, actor, 64, bullet);
                    playAt(actor, Snd.hurt);
                }
                absorbed = true;
            }
        }
        if (damage) {
            // over-damage effect
        }

        if (!actor._hp) {
            // could be effect if damage is big
            kill(actor);
            if (actor._type === ActorType.Player) {
                // reset frags on death
                const killed = state._stats.get(actor._client);
                if (killed) {
                    killed._frags = 0;
                }

                const killerID = bullet._client;
                if (killerID > 0 && !actor._type) {
                    const stat: PlayerStat = state._stats.get(killerID) ?? {_scores: 0, _frags: 0};
                    stat._scores += actor._client > 0 ? 5 : 1;
                    ++stat._frags;
                    state._stats.set(killerID, stat);
                    if (settings.speech && gameTic > lastAudioTic) {
                        const a = getNameByClientId(killerID);
                        const b = getNameByClientId(actor._client);
                        if (a) {
                            let text = fxRandElement(b ? GAME_CFG._voice._killAB : GAME_CFG._voice._killNPC);
                            text = text.replace("{0}", a);
                            text = text.replace("{1}", b);
                            speak(text);
                        }
                    }
                }
            }
        }
    }
    if (bullet._hp && bullet._subtype != BulletType.Ray) {
        // bullet hit or bounced?
        if (absorbed) {
            bullet._hp = 0;
        } else {
            --bullet._hp;
            if (bullet._hp) {
                let nx = bullet._x - actor._x;
                let ny = bullet._y - actor._y;
                const dist = sqrt(nx * nx + ny * ny);
                if (dist > 0) {
                    nx /= dist;
                    ny /= dist;
                    reflectVelocity(bullet, nx, ny, 1);
                    const pen = actorsConfig[actor._type]._radius + BULLET_RADIUS + 1;
                    bullet._x = actor._x + pen * nx;
                    bullet._y = actor._y + pen * ny;
                }
            }
        }
    }
}

const swapWeaponSlot = (player: PlayerActor) => {
    const weapon = player._weapon;
    const ammo = player._clipAmmo;
    player._weapon = player._weapon2;
    player._clipAmmo = player._clipAmmo2;
    player._weapon2 = weapon;
    player._clipAmmo2 = ammo;
}

const needReloadWeaponIfOutOfAmmo = (player: PlayerActor) => {
    if (player._weapon && !player._clipReload) {
        const weapon = weapons[player._weapon];
        if (weapon._clipSize && !player._clipAmmo) {
            if (player._mags) {
                // start auto reload
                player._clipReload = weapon._clipReload;
            }
            // auto swap to available full weapon
            else {
                if (player._weapon2 && (player._clipAmmo2 || !weapons[player._weapon2]._clipSize)) {
                    swapWeaponSlot(player);
                }
                if (isMyPlayer(player) && !(player._trig & ControlsFlag.DownEvent_Fire)) {
                    addTextParticle(player, "EMPTY!");
                }
                player._s = weapon._reloadTime;
            }
        }
    }
}

function calcVelocityWithWeapon(player: PlayerActor, velocity: number): number {
    const k = player._weapon ? weapons[player._weapon]._moveWeightK : 1.0;
    return (velocity * k) | 0;
}

const updatePlayer = (player: PlayerActor) => {
    if (gameMode.runAI && (!player._client || gameMode.playersAI)) {
        updateAI(state, player);
    }
    let landed = player._z == 0 && player._w == 0;
    if (player._input & ControlsFlag.Jump) {
        if (landed) {
            player._z = 1;
            player._w = calcVelocityWithWeapon(player, GAME_CFG._player._jumpVel);
            landed = false;
            playAt(player, Snd.jump);
            addLandParticles(player, 240, 8);
        }
    }
    const c = (landed ? 16 : 8) / Const.NetFq;
    const moveAngle = unpackAngleByte(player._input >> ControlsFlag.MoveAngleBit, ControlsFlag.MoveAngleMax);
    const lookAngle = unpackAngleByte(player._input >> ControlsFlag.LookAngleBit, ControlsFlag.LookAngleMax);
    const moveDirX = cos(moveAngle);
    const moveDirY = sin(moveAngle);
    const lookDirX = cos(lookAngle);
    const lookDirY = sin(lookAngle);
    if (player._input & ControlsFlag.Move) {
        const vel = calcVelocityWithWeapon(player,
            (player._input & ControlsFlag.Run) ? GAME_CFG._player._runVel : GAME_CFG._player._walkVel
        );
        player._u = reach(player._u, vel * moveDirX, vel * c);
        player._v = reach(player._v, vel * moveDirY, vel * c);
        if (landed) {
            const L = 256;
            const S = (L / vel) | 0;
            const moment = (gameTic + player._anim0) % S;
            if (!moment) {
                if (!random1i(4)) {
                    addLandParticles(player, 240, 1);
                }
                const moment2 = (gameTic + player._anim0) % (2 * S);
                addStepSplat(player, moment2 ? 120 : -120);

                const moment4 = (gameTic + player._anim0) % (4 * S);
                if (!moment4) {
                    playAt(player, Snd.step);
                }
            }
        }
    } else {
        applyGroundFriction(player, 32 * c);
    }

    if (player._input & ControlsFlag.Swap) {
        if (!(player._trig & ControlsFlag.DownEvent_Swap)) {
            player._trig |= ControlsFlag.DownEvent_Swap;
            if (player._weapon2) {
                swapWeaponSlot(player);
            }
        }
    } else {
        player._trig &= ~ControlsFlag.DownEvent_Swap;
    }

    if (player._weapon) {
        const weapon = weapons[player._weapon];
        // Reload button
        if (player._input & ControlsFlag.Reload) {
            if (couldBeReloadedManually(player)) {
                if (player._mags) {
                    player._clipReload = weapon._clipReload;
                } else {
                    if (isMyPlayer(player) && !(player._trig & ControlsFlag.DownEvent_Reload)) {
                        addTextParticle(player, "NO MAGS!");
                    }
                }
            }
            player._trig |= ControlsFlag.DownEvent_Reload;
        } else {
            player._trig &= ~ControlsFlag.DownEvent_Reload;
        }
        if (weapon._clipSize && player._clipReload && player._mags) {
            --player._clipReload;
            if (!player._clipReload) {
                --player._mags;
                player._clipAmmo = weapon._clipSize;
            }
        }
        if (player._input & ControlsFlag.Fire) {
            // reload-tics = NetFq / Rate
            player._s = dec1(player._s);
            if (!player._s) {
                needReloadWeaponIfOutOfAmmo(player);
                const loaded = !weapon._clipSize || (!player._clipReload && player._clipAmmo);
                if (loaded) {
                    if (weapon._clipSize) {
                        --player._clipAmmo;
                        if (!player._clipAmmo) {
                            needReloadWeaponIfOutOfAmmo(player);
                        }
                    }
                    if (isMyPlayer(player)) {
                        cameraShake = max(weapon._cameraShake, cameraShake);
                        cameraFeedback = 5;
                    }
                    player._s = weapon._reloadTime;
                    player._detune = reach(player._detune, weapon._detuneSpeed, 1);
                    if (player._z <= 0) {
                        addVelocityDir(player, lookDirX, lookDirY, -1, -weapon._kickBack);
                    }
                    playAt(player, Snd.shoot);
                    for (let i = 0; i < weapon._spawnCount; ++i) {
                        const a = lookAngle +
                            weapon._angleVar * (random() - 0.5) +
                            weapon._angleSpread * (player._detune / weapon._detuneSpeed) * (random() - 0.5);
                        const dx = cos(a);
                        const dy = sin(a);
                        const bulletVelocity = weapon._velocity + weapon._velocityVar * (random() - 0.5);
                        const bullet = newActor(ActorType.Bullet);
                        bullet._client = player._client || -player._id;
                        copyPosFromActorCenter(bullet, player);
                        addPos(bullet, dx, dy, 0, WORLD_SCALE * weapon._offset);
                        bullet._z += PLAYER_HANDS_Z - 12 * WORLD_SCALE;
                        addVelocityDir(bullet, dx, dy, 0, bulletVelocity);
                        bullet._weapon = weapon._bulletDamage;
                        bullet._subtype = weapon._bulletType;
                        bullet._hp = weapon._bulletHp;
                        bullet._s = weapon._bulletLifetime;
                        pushActor(bullet);

                        if (weapon._bulletType == BulletType.Ray) {
                            castRayBullet(bullet, dx, dy);
                            bullet._weapon = 0;
                        }
                    }

                    if (weapon._bulletType) {
                        addShellParticle(player, PLAYER_HANDS_Z, weapon._bulletShellColor);
                    }
                }
                player._trig |= ControlsFlag.DownEvent_Fire;
            }
        } else {
            player._trig &= ~ControlsFlag.DownEvent_Fire;
            player._detune = (player._detune / 3) | 0;
            player._s = reach(player._s, weapon._launchTime, weapon._relaunchSpeed);
        }
    }

    const prevVelZ = player._w;
    updateActorPhysics(player);

    if (!landed) {
        const isLanded = player._z <= 0 && prevVelZ <= 0;
        if (isLanded) {
            const count = 8;
            const n = abs(count * prevVelZ / GAME_CFG._player._jumpVel) | 0;
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
    _actors: [
        _state._actors[0].map(a => ({...a})),
        _state._actors[1].map(a => ({...a})),
        _state._actors[2].map(a => ({...a})),
        _state._actors[3].map(a => ({...a})),
    ],
    _stats: new Map(_state._stats.entries()),
});

const beginPrediction = (): boolean => {
    // if (!Const.Prediction || time < 0.001) return false;
    if (!Const.Prediction || !joined) return false;

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
    _SEEDS[0] = state._seed;
    gameTic = state._tic + 1;
    // restore particles
    restoreParticles();
}

/*** DRAWING ***/

const drawGame = () => {
    // prepare objects draw list first
    collectVisibleActors(trees, ...state._actors);
    drawList.sort((a, b) => WORLD_BOUNDS_SIZE * (a._y - b._y) + a._x - b._x);

    beginFogRender();
    drawFogObjects(state._actors[ActorType.Player], state._actors[ActorType.Bullet], state._actors[ActorType.Item]);
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
        const add = ((getHitColorOffset(getMyPlayer()?._animHit) & 0x990000) >>> 16) / 0xFF;
        ambientColor[0] = clamp(0x40 / 0xFF + (0x20 / 0xFF) * sin(lastFrameTs) + add, 0, 1);
        ambientColor[1] = 0x11 / 0xFF;
        ambientColor[2] = 0x33 / 0xFF;
        ambientColor[3] = 0.8;
        setLightMapTexture(fogTexture._texture);
    }

    drawOpaqueParticles();
    drawOpaqueObjects();
    drawSplatsOpaque();
    flush();

    // gl.enable(GL.DEPTH_TEST);
    gl.depthFunc(GL.LEQUAL);
    gl.depthMask(false);

    setLightMapTexture(emptyTexture._texture);
    // skybox
    {
        const tex = fnt[0]._textureBoxLT;
        const fullAmbientColor = RGB(ambientColor[0] * 0xFF, ambientColor[1] * 0xFF, ambientColor[2] * 0xFF);
        draw(tex, -1000, -1000, 0, BOUNDS_SIZE + 2000, 1001, 1, fullAmbientColor);
        draw(tex, -1000, BOUNDS_SIZE - 1, 0, BOUNDS_SIZE + 2000, 1001, 1, fullAmbientColor);
        draw(tex, -1000, 0, 0, 1001, BOUNDS_SIZE, 1, fullAmbientColor);
        draw(tex, BOUNDS_SIZE - 1, 0, 0, 1001, BOUNDS_SIZE, 1, fullAmbientColor);
    }
    flush();

    setLightMapTexture(fogTexture._texture);

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

    setLightMapTexture(emptyTexture._texture);
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

    if (getDevSetting("dev_fps")) {
        drawText(fnt[0], `FPS: ${stats.fps} | DC: ${stats.drawCalls} |  ⃤ ${stats.triangles} | ∷${stats.vertices}`, 4, 2, 5, 0, 0);
    }

    if (getDevSetting("dev_info")) {
        printDebugInfo((lastState ?? state)._tic + 1, getMinTic(), lastFrameTs, prevTime, drawList, state, trees, clients);
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
            const x = a._x / WORLD_SCALE;
            const y = a._y / WORLD_SCALE;
            if ((x > l && x < r && y > t && y < b) ||
                (a._type == ActorType.Bullet && a._subtype == BulletType.Ray)) {
                drawList.push(a);
            }
        }
    }
}


function drawPlayerOpaque(p: PlayerActor): void {
    const co = getHitColorOffset(p._animHit);
    const basePhase = p._anim0 + lastFrameTs;
    const colorC = GAME_CFG._bodyColor[p._anim0 % GAME_CFG._bodyColor.length];
    const colorArm = colorC;
    const colorBody = colorC;
    const x = p._x / WORLD_SCALE;
    const y = p._y / WORLD_SCALE;
    const z = p._z / WORLD_SCALE;
    const speed = hypot(p._u, p._v, p._w);
    const runK = (p._input & ControlsFlag.Run) ? 1 : 0.8;
    const walk = min(1, speed / 100);
    let base = -0.5 * walk * 0.5 * (1.0 + sin(40 * runK * basePhase));
    const idle_base = (1 - walk) * ((1 + sin(10 * basePhase) ** 2) / 4);
    base = base + idle_base;
    const leg1 = 5 - 4 * walk * 0.5 * (1.0 + sin(40 * runK * basePhase));
    const leg2 = 5 - 4 * walk * 0.5 * (1.0 + sin(40 * runK * basePhase + PI));

    /////

    const wpn = weapons[p._weapon];
    let viewAngle = unpackAngleByte(p._input >> ControlsFlag.LookAngleBit, ControlsFlag.LookAngleMax);
    const weaponBaseAngle = wpn._gfxRot * TO_RAD;
    const weaponBaseScaleX = wpn._gfxSx;
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
    if (wpn._handsAnim) {
        // const t = max(0, (p.s - 0.8) * 5);
        // anim := 1 -> 0
        const t = min(1, wpn._launchTime > 0 ? (p._s / wpn._launchTime) : max(0, (p._s / wpn._reloadTime - 0.5) * 2));
        wd += sin(t * PI) * wpn._handsAnim;
        weaponAngle -= -wx * PI * 0.25 * sin((1 - (1 - t) ** 2) * PI2);
    }
    weaponX += wd * cos(weaponAngle);
    weaponY += wd * sin(weaponAngle);

    if (wx < 0) {
        weaponSX *= wx;
        weaponAngle -= PI + 2 * weaponBaseAngle;
    }

    weaponAngle += weaponBaseAngle;

    if (p._weapon) {
        drawMeshSpriteUp(img[Img.weapon0 + p._weapon], weaponX, weaponY/* + (weaponBack ? -1 : 1)*/, weaponZ, weaponAngle, weaponSX, weaponSY);
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

    if (p._weapon) {
        drawMeshSpriteUp(img[Img.box_l], x + 4, y + 0.2, z + 10 - base, rArmRot, rArmLen, 2, 1, colorArm, 0, co);
        drawMeshSpriteUp(img[Img.box_l], x - 4, y + 0.2, z + 10 - base, lArmRot, lArmLen, 2, 1, colorArm, 0, co);
    } else {
        let sw1 = walk * sin(20 * runK * basePhase);
        let sw2 = walk * cos(20 * runK * basePhase);
        let armLen = 5;
        if (!p._client && p._hp < 10 && !p._sp) {
            sw1 -= PI / 2;
            sw2 += PI / 2;
            armLen += 4;
        }
        drawMeshSpriteUp(img[Img.box_l], x + 4, y + 0.2, z + 10 - base, sw1 + PI / 4, armLen, 2, 1, colorArm, 0, co);
        drawMeshSpriteUp(img[Img.box_l], x - 4, y + 0.2, z + 10 - base, sw2 + PI - PI / 4, armLen, 2, 1, colorArm, 0, co);
    }

    {
        const imgHead = p._client ? (Img.avatar0 + p._anim0 % Img.num_avatars) : (Img.npc0 + p._anim0 % Img.num_npc);
        const s = p._w / 500;
        const a = p._u / 500;
        drawMeshSpriteUp(img[imgHead], x, y + 0.1, z + 16 - base * 2, a, 1 - s, 1 + s, 1, 0xFFFFFF, 0, co);
    }
}

const drawPlayer = (p: Actor): void => {
    const x = p._x / WORLD_SCALE;
    const y = p._y / WORLD_SCALE;

    if (p._client > 0 && p._client !== clientId) {
        let name = getNameByClientId(p._client);
        if (process.env.NODE_ENV === "development") {
            name = (name ?? "") + " #" + p._client
        }
        if (name) {
            setDrawZ(32 + p._z / WORLD_SCALE);
            drawTextShadowCenter(fnt[0], name, 6, x, y + 2);
        }
    }
}

type ActorDrawFunction = (p: Actor) => void;
const DRAW_BY_TYPE: (ActorDrawFunction)[] = [
    drawPlayer,
    undefined,
    drawBullet,
    undefined,
    undefined,
];

const DRAW_OPAQUE_BY_TYPE: (ActorDrawFunction | undefined)[] = [
    drawPlayerOpaque,
    drawBarrelOpaque,
    undefined,
    drawItemOpaque,
    drawTreeOpaque,
];

function drawOpaqueObjects() {
    for (let i = drawList.length - 1; i >= 0; --i) {
        const actor = drawList[i];
        DRAW_OPAQUE_BY_TYPE[actor._type]?.(actor);
    }
}

const drawObjects = () => {
    setDrawZ(0.15);
    drawShadows(drawList);
    drawParticleShadows();
    for (const actor of drawList) {
        DRAW_BY_TYPE[actor._type]?.(actor);
    }
}

const playAt = (actor: Actor, id: Snd) => {
    if (gameTic > lastAudioTic) {
        const r = GAME_CFG._camera._listenerRadius;
        const dx = (actor._x / WORLD_SCALE - gameCamera[0]) / r;
        const dy = (actor._y / WORLD_SCALE - gameCamera[1]) / r;
        const v = 1 - hypot(dx, dy);
        if (v > 0) {
            play(snd[id], v, clamp(dx, -1, 1));
        }
    }
}
