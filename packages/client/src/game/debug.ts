import {Actor, ActorType, Client, cloneStateData, Packet, PacketDebug, StateData} from "./types.js";
import {_debugLagK, Const, GAME_CFG, setDebugLagK} from "./config.js";
import {_room, clientId, clientName, disconnect, remoteClients} from "../net/messaging.js";
import {getChannelPacketSize} from "../net/channels_send.js";
import {termPrint} from "../graphics/gui.js";
import {keyboardDown, KeyCode} from "../utils/input.js";
import {draw, setDrawZ} from "../graphics/draw2d.js";
import {img} from "../assets/gfx.js";
import {ClientID} from "@iioi/shared/types.js";
import {min} from "../utils/math.js";
import {getDevFlag, SettingFlag, toggleSettingsFlag} from "./settings.js";
import {WORLD_SCALE} from "../assets/params.js";
import {opaqueParticles, splats, textParticles} from "./particles.js";
import {Img} from "../assets/img.js";

//// DEBUG UTILITIES ////

const debugStateCache: Map<number, PacketDebug> = new Map();
let debugStateSnapshotEnabled = process.env.NODE_ENV === "development";
let prevSimulatedTic = 0;

const icons_iceState = {
    disconnected: "⭕",
    closed: "🔴",
    failed: "❌",
    connected: "🟢",
    completed: "✅",
    new: "🆕",
    checking: "🟡",
};

const icons_channelState = {
    connecting: "🟡",
    open: "🟢",
    closed: "🔴",
    closing: "❌",
};

const _dmin = [
    Number.MAX_VALUE,
    Number.MAX_VALUE,
    Number.MAX_VALUE,
    Number.MAX_VALUE,
    Number.MAX_VALUE,
    Number.MAX_VALUE,
];
const _dmax = [
    Number.MIN_VALUE,
    Number.MIN_VALUE,
    Number.MIN_VALUE,
    Number.MIN_VALUE,
    Number.MIN_VALUE,
    Number.MIN_VALUE,
];

export const printDebugInfo = (
    gameTic: number,
    netTic: number,
    lastFrameTs: number,
    prevTime: number,
    drawList: Actor[],
    state: StateData,
    trees: Actor[],
    clients: Map<ClientID, Client>,
) => {
    let text = gameTic > prevSimulatedTic ? "🌐" : "🥶";
    const ticsAhead = ((lastFrameTs - prevTime) * Const.NetFq) | 0;
    const ticsPrediction = min(Const.PredictionMax, ticsAhead);
    if (ticsPrediction) text += "🔮";
    text += `~ ${ticsPrediction} of ${ticsAhead}\n`;
    prevSimulatedTic = gameTic;

    if (_room) {
        text += `ROOM: ${_room._code} ${_room._npcLevel}\n`;
    }
    if (_debugLagK) {
        text += `debug-lag K: ${_debugLagK}\n`;
    }
    text += "visible: " + drawList.length + "\n";
    text += "players: " + state._actors[ActorType.Player].length + "\n";
    text += "barrels: " + state._actors[ActorType.Barrel].length + "\n";
    text += "items: " + state._actors[ActorType.Item].length + "\n";
    text += "bullets: " + state._actors[ActorType.Bullet].length + "\n";
    text += "trees: " + trees.length + "\n";
    text += `* ${opaqueParticles.length} | t ${textParticles.length} | $ ${splats.length}\n`;
    //text += " | clients: " + clients.size + " | " + "remoteClients: " + remoteClients.size + "\n";

    text += `┌ ${clientName} #${clientId} | tic: ${gameTic}, net-game: ${netTic - gameTic}\n`;
    for (const [, remoteClient] of remoteClients) {
        const pc = remoteClient._pc;
        const dc = remoteClient._dc;
        const cl = clients.get(remoteClient._id);
        text += `├ ${remoteClient._name} #${remoteClient._id}`;
        text += pc ? icons_iceState[pc.iceConnectionState] ?? "❓" : "🧿";
        text += dc ? icons_channelState[dc.readyState] : "🧿";
        if (cl) {
            text += `+${cl._tic - (gameTic - 1)}`;
            text += "| x" + getChannelPacketSize(remoteClient).toString(16);
        }
        text += "\n";
    }

    for (const a of [].concat(...state._actors)) {
        if (a._x < _dmin[0]) _dmin[0] = a._x;
        if (a._x > _dmax[0]) _dmax[0] = a._x;
        if (a._y < _dmin[1]) _dmin[1] = a._y;
        if (a._y > _dmax[1]) _dmax[1] = a._y;
        if (a._z < _dmin[2]) _dmin[2] = a._z;
        if (a._z > _dmax[2]) _dmax[2] = a._z;

        if (a._u < _dmin[3]) _dmin[3] = a._u;
        if (a._u > _dmax[3]) _dmax[3] = a._u;
        if (a._v < _dmin[4]) _dmin[4] = a._v;
        if (a._v > _dmax[4]) _dmax[4] = a._v;
        if (a._w < _dmin[5]) _dmin[5] = a._w;
        if (a._w > _dmax[5]) _dmax[5] = a._w;
    }

    text += "x := [" + _dmin[0] + " .. " + _dmax[0] + "]\n";
    text += "y := [" + _dmin[1] + " .. " + _dmax[1] + "]\n";
    text += "z := [" + _dmin[2] + " .. " + _dmax[2] + "]\n";
    text += "u := [" + _dmin[3] + " .. " + _dmax[3] + "]\n";
    text += "v := [" + _dmin[4] + " .. " + _dmax[4] + "]\n";
    text += "w := [" + _dmin[5] + " .. " + _dmax[5] + "]\n";

    termPrint(text, 4);
};

export const updateDebugInput = () => {
    if (getDevFlag()) {
        if (keyboardDown[KeyCode.Digit1]) {
            toggleSettingsFlag(SettingFlag.DevShowDebugInfo);
        }
        if (keyboardDown[KeyCode.Digit2]) {
            toggleSettingsFlag(SettingFlag.DevShowFrameStats);
        }
        if (keyboardDown[KeyCode.Digit3]) {
            toggleSettingsFlag(SettingFlag.DevShowCollisionInfo);
        }
        if (keyboardDown[KeyCode.Digit4]) {
            setDebugLagK((_debugLagK + 1) % 3);
        }
        if (keyboardDown[KeyCode.Digit5]) {
            debugStateSnapshotEnabled = !debugStateSnapshotEnabled;
        }
    }
};

const drawActorBoundingSphere = (p: Actor) => {
    const prop = GAME_CFG.actors[p._type];
    const r = prop.radius;
    const h = prop.height;
    const x = p._x / WORLD_SCALE;
    const y = (p._y - p._z - h) / WORLD_SCALE;
    const s = r / WORLD_SCALE / 16;
    draw(img[Img.box_t], x, y, 0, 1, (p._z + h) / WORLD_SCALE);
    draw(img[Img.circle_16], x, y, 0, s, s, 0.5, 0xff0000);
};

export const drawCollisions = (list: Actor[]) => {
    setDrawZ(0);
    for (const p of list) {
        drawActorBoundingSphere(p);
    }
};

export const resetDebugStateCache = () => debugStateCache.clear();

export const saveDebugState = (stateData: StateData) => {
    const debug: PacketDebug = {
        _seed: stateData._seed,
        _tic: stateData._tic,
        _nextId: stateData._nextId,
    };
    if (debugStateSnapshotEnabled) {
        debug._state = cloneStateData(stateData);
    }
    // console.log("save debug state #", stateData._tic);
    debugStateCache.set(debug._tic, debug);
};

export const addPacketDebugState = (client: Client, packet: Packet, state: StateData) => {
    if (client._ready && client._isPlaying) {
        //console.log("add debug state #", state._tic, "to packet");
        packet._debug = {
            _nextId: state._nextId,
            _tic: state._tic,
            _seed: state._seed,
        };
        if (debugStateSnapshotEnabled) {
            packet._debug._state = cloneStateData(state);
        }
    }
};

export const assertPacketDebugState = (from: ClientID, data: Packet) => {
    if (data._debug) {
        const tic = data._debug._tic;
        const localDebugState = debugStateCache.get(tic);
        if (localDebugState) {
            let failed = false;
            if (data._debug._seed !== localDebugState._seed) {
                console.warn("seed mismatch from client " + from + " at tic " + tic);
                console.warn(data._debug._seed + " != " + localDebugState._seed);
                failed = true;
            }
            if (data._debug._nextId !== localDebugState._nextId) {
                console.warn("gen id mismatch from client " + from + " at tic " + tic);
                console.warn(data._debug._nextId + " != " + localDebugState._nextId);
                failed = true;
            }
            if (data._debug._state && localDebugState._state && debugStateSnapshotEnabled) {
                failed ||= assertStateEquality("[DEBUG] ", localDebugState._state, data._debug._state);
            }
            if (failed) {
                console.error("Failed state assertion", from, tic);
                disconnect("State is out of sync!");
            }
        }
    }
};

const assertStateEquality = (label: string, a: StateData, b: StateData): boolean => {
    let failed = false;
    if (a._nextId !== b._nextId) {
        console.warn(label + "NEXT ID MISMATCH", a._nextId, b._nextId);
        failed = true;
    }
    if (a._seed !== b._seed) {
        console.warn(label + "SEED MISMATCH", a._seed, b._seed);
        failed = true;
    }
    for (let i = 0; i < a._actors.length; ++i) {
        const listA = a._actors[i];
        const listB = b._actors[i];
        if (listA.length == listB.length) {
            for (let j = 0; j < listA.length; ++j) {
                const actorA = listA[j];
                const actorB = listB[j];
                for (const key of Object.keys(actorA)) {
                    const valueA = (actorA as object)[key];
                    const valueB = (actorB as object)[key];
                    if (valueA !== valueB) {
                        console.warn(`${label} ACTOR DATA mismatch, key: ${key}`);
                        console.warn(` local.${key} = ${valueA}`);
                        console.warn(`remote.${key} = ${valueB}`);
                        failed = true;
                    }
                }
            }
        } else {
            console.warn(label + "ACTOR LIST " + i + " SIZE MISMATCH", listA.length, listB.length);
            failed = true;
        }
    }
    return failed;
};
