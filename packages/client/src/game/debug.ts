import {Actor, ActorType, Client, Packet, StateData} from "./types";
import {_debugLagK, Const, setDebugLagK} from "./config";
import {_room, clientId, clientName, remoteClients} from "../net/messaging";
import {getChannelPacketSize} from "../net/channels_send";
import {termPrint} from "../graphics/ui";
import {keyboardDown, KeyCode} from "../utils/input";
import {draw, setDrawZ} from "../graphics/draw2d";
import {Img, img} from "../assets/gfx";
import {ClientID} from "../../../shared/src/types";
import {_SEEDS} from "../utils/rnd";
import {roundActors} from "./phy";
import {min} from "../utils/math";
import {setSetting, settings} from "./settings";
import {WORLD_SCALE} from "../assets/params";
import {actorsConfig} from "./data/world";
import {opaqueParticles, splats, textParticles} from "./particles";
import {gameMode} from "./game";

//// DEBUG UTILITIES ////

let debugState: StateData;
let debugStateEnabled = process.env.NODE_ENV === "development";
//let debugStateEnabled = false;
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

const _dmin = [Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE];
const _dmax = [Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE];

export const printDebugInfo = (
    gameTic: number, netTic: number, lastFrameTs: number, prevTime: number,
    drawList: Actor[],
    state: StateData,
    trees: Actor[],
    clients: Map<ClientID, Client>,
) => {
    let text = gameTic > prevSimulatedTic ? "🌐" : "🥶";
    const ticsAhead = (lastFrameTs - prevTime) * Const.NetFq | 0;
    const ticsPrediction = min(Const.PredictionMax, ticsAhead);
    if (ticsPrediction) text += "🔮";
    text += `~ ${ticsPrediction} of ${ticsAhead}\n`;
    prevSimulatedTic = gameTic;

    if (_room) {
        text += `ROOM: ${_room.code} ${_room.npcLevel} ${gameMode.npcLevel}\n`;
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
        text += pc ? (icons_iceState[pc.iceConnectionState] ?? "❓") : "🧿";
        text += dc ? icons_channelState[dc.readyState] : "🧿";
        if (cl) {
            text += `+${cl._tic - (gameTic - 1)}`;
            text += "| x" + getChannelPacketSize(remoteClient).toString(16);
        }
        text += "\n";
    }

    for (let a of [].concat(...state._actors)) {
        if (a._x < _dmin[0]) _dmin[0] = a._x;
        if (a._x > _dmax[0]) _dmax[0] = a._x;
        if (a._y < _dmin[1]) _dmin[1] = a._y;
        if (a._y > _dmax[1]) _dmax[1] = a._y;
        if (a._z < _dmin[2]) _dmin[2] = a._z;
        if (a._z > _dmax[2]) _dmax[2] = a._z;

        if (a._u < _dmin[0 + 3]) _dmin[0 + 3] = a._u;
        if (a._u > _dmax[0 + 3]) _dmax[0 + 3] = a._u;
        if (a._v < _dmin[1 + 3]) _dmin[1 + 3] = a._v;
        if (a._v > _dmax[1 + 3]) _dmax[1 + 3] = a._v;
        if (a._w < _dmin[2 + 3]) _dmin[2 + 3] = a._w;
        if (a._w > _dmax[2 + 3]) _dmax[2 + 3] = a._w;
    }

    text += "x := [" + _dmin[0] + " .. " + _dmax[0] + "]\n";
    text += "y := [" + _dmin[1] + " .. " + _dmax[1] + "]\n";
    text += "z := [" + _dmin[2] + " .. " + _dmax[2] + "]\n";
    text += "u := [" + _dmin[3] + " .. " + _dmax[3] + "]\n";
    text += "v := [" + _dmin[4] + " .. " + _dmax[4] + "]\n";
    text += "w := [" + _dmin[5] + " .. " + _dmax[5] + "]\n";

    termPrint(text, 4);
}

export const updateDebugInput = () => {
    if (settings.dev) {
        if (keyboardDown[KeyCode.Digit0]) {
            setSetting("dev_info", settings.dev_info ? 0 : 1);
        }
        if (keyboardDown[KeyCode.Digit1]) {
            ++debugCheckAvatar;
        }
        if (keyboardDown[KeyCode.Digit2]) {
            setSetting("dev_collision", settings.dev_collision ? 0 : 1);
        }
        if (keyboardDown[KeyCode.Digit3]) {
            setDebugLagK((_debugLagK + 1) % 3);
        }
        if (keyboardDown[KeyCode.Digit4]) {
            debugStateEnabled = !debugStateEnabled;
        }
    }
}

const drawActorBoundingSphere = (p: Actor) => {
    const prop = actorsConfig[p._type];
    const r = prop._radius;
    const h = prop._height;
    const x = p._x / WORLD_SCALE;
    const y = (p._y - p._z - h) / WORLD_SCALE;
    const s = (r / WORLD_SCALE) / 16;
    draw(img[Img.box_t], x, y, 0, 1, (p._z + h) / WORLD_SCALE);
    draw(img[Img.circle_16], x, y, 0, s, s, 0.5, 0xFF0000);
}

export const drawCollisions = (list: Actor[]) => {
    setDrawZ(0);
    for (const p of list) {
        drawActorBoundingSphere(p);
    }
}

export const saveDebugState = (stateData: StateData) => {
    if (debugStateEnabled) {
        debugState = stateData;
        debugState._seed = _SEEDS[0];
        ++debugState._tic;
        debugState._actors.map(roundActors);
    }
}

export const addDebugState = (client: Client, packet: Packet, state: StateData) => {
    if (debugStateEnabled && client._ready && client._isPlaying) {
        packet._state = state;
        packet._debug._state = debugState;
    }
}

export const assertStateInSync = (from: ClientID, data: Packet, state: StateData, gameTic: number) => {
    if (data._debug && data._debug._tic === (gameTic - 1)) {
        if (data._debug._seed !== _SEEDS[0]) {
            console.warn("seed mismatch from client " + from + " at tic " + data._debug._tic);
            console.warn(data._debug._seed + " != " + _SEEDS[0]);
        }
        if (data._debug._nextId !== state._nextId) {
            console.warn("gen id mismatch from client " + from + " at tic " + data._debug._tic);
            console.warn(data._debug._nextId + " != " + state._nextId);
        }
        if (debugStateEnabled) {
            if (data._debug._state && debugState) {
                assertStateEquality("[DEBUG] ", debugState, data._debug._state);
            }
            if (data._state) {
                assertStateEquality("[FINAL] ", state, data._state);
            }
        }
    }
}

const assertStateEquality = (label: string, a: StateData, b: StateData) => {

    if (a._nextId != b._nextId) {
        console.warn(label + "NEXT ID MISMATCH", a._nextId, b._nextId);
    }
    if (a._seed != b._seed) {
        console.warn(label + "SEED MISMATCH", a._seed, b._seed);
    }
    if (a._mapSeed != b._mapSeed) {
        console.warn(label + "MAP SEED MISMATCH", a._mapSeed, b._mapSeed);
    }
    for (let i = 0; i < a._actors.length; ++i) {
        const listA = a._actors[i];
        const listB = b._actors[i];
        if (listA.length == listB.length) {
            for (let j = 0; j < listA.length; ++j) {
                const actorA = listA[j];
                const actorB = listB[j];
                for (const key of Object.keys(actorA)) {
                    const valueA = (actorA as any)[key];
                    const valueB = (actorB as any)[key];
                    if (valueA !== valueB) {
                        console.warn(`${label} ACTOR DATA mismatch, key: ${key}`);
                        console.warn(` local.${key} = ${valueA}`);
                        console.warn(`remote.${key} = ${valueB}`);
                    }
                }
            }
        } else {
            console.warn(label + "ACTOR LIST " + i + " SIZE MISMATCH", listA.length, listB.length);
        }
    }
}