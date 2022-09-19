import {Actor, ActorType, Client, Packet, StateData} from "./types";
import {_debugLagK, Const, setDebugLagK} from "./config";
import {clientName, remoteClients} from "../net/messaging";
import {getChannelPacketSize} from "../net/channels_send";
import {termPrint} from "../graphics/ui";
import {keyboardDown, KeyCode} from "../utils/input";
import {OBJECT_HEIGHT, OBJECT_RADIUS_BY_TYPE} from "./data/world";
import {draw} from "../graphics/draw2d";
import {Img, img} from "../assets/gfx";
import {ClientID} from "../../shared/types";
import {_SEEDS} from "../utils/rnd";
import {roundActors} from "./phy";
import {min} from "../utils/math";

//// DEBUG UTILITIES ////

let debugState: StateData;
let showDebugInfo = true;
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

const _dmin = [Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE];
const _dmax = [Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE];

export const printDebugInfo = (
    gameTic: number, netTic: number, lastFrameTs: number, prevTime: number,
    drawList: Actor[],
    state: StateData,
    trees: Actor[],
    clients: Map<ClientID, Client>,
) => {
    if (!showDebugInfo) return;

    let text = gameTic > prevSimulatedTic ? "🌐" : "🥶";
    const ticsAhead = (lastFrameTs - prevTime) * Const.NetFq | 0;
    const ticsPrediction = min(Const.PredictionMax, ticsAhead);
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

    text += `┌ ${clientName} | tic: ${gameTic}, game-net: ${netTic - gameTic}\n`;
    for (const [, remoteClient] of remoteClients) {
        const pc = remoteClient.pc_;
        const dc = remoteClient.dc_;
        const cl = clients.get(remoteClient.id_);
        text += "├ " + remoteClient.name_ + remoteClient.id_;
        text += pc ? (icons_iceState[pc.iceConnectionState] ?? "❓") : "🧿";
        text += dc ? icons_channelState[dc.readyState] : "🧿";
        if (cl) {
            text += `+${cl.tic_ - (gameTic - 1)}`;
            text += "| x" + getChannelPacketSize(remoteClient).toString(16) +
                "";//" max: " + JSON.stringify(pc.localDescription.toJSON());
        }
        text += "\n";
    }

    for (let a of [].concat(...state.actors_)) {
        if (a.x_ < _dmin[0]) _dmin[0] = a.x_;
        if (a.x_ > _dmax[0]) _dmax[0] = a.x_;
        if (a.y_ < _dmin[1]) _dmin[1] = a.y_;
        if (a.y_ > _dmax[1]) _dmax[1] = a.y_;
        if (a.z_ < _dmin[2]) _dmin[2] = a.z_;
        if (a.z_ > _dmax[2]) _dmax[2] = a.z_;

        if (a.u_ < _dmin[0 + 3]) _dmin[0 + 3] = a.u_;
        if (a.u_ > _dmax[0 + 3]) _dmax[0 + 3] = a.u_;
        if (a.v_ < _dmin[1 + 3]) _dmin[1 + 3] = a.v_;
        if (a.v_ > _dmax[1 + 3]) _dmax[1 + 3] = a.v_;
        if (a.w_ < _dmin[2 + 3]) _dmin[2 + 3] = a.w_;
        if (a.w_ > _dmax[2 + 3]) _dmax[2 + 3] = a.w_;
    }

    text += "x := [" + _dmin[0] + " .. " + _dmax[0] + "]\n";
    text += "y := [" + _dmin[1] + " .. " + _dmax[1] + "]\n";
    text += "z := [" + _dmin[2] + " .. " + _dmax[2] + "]\n";
    text += "u := [" + _dmin[3] + " .. " + _dmax[3] + "]\n";
    text += "v := [" + _dmin[4] + " .. " + _dmax[4] + "]\n";
    text += "w := [" + _dmin[5] + " .. " + _dmax[5] + "]\n";

    termPrint(text);
}

export const updateDebugInput = () => {
    if (keyboardDown[KeyCode.Digit0]) {
        showDebugInfo = !showDebugInfo;
    }
    if (keyboardDown[KeyCode.Digit1]) {
        ++debugCheckAvatar;
    }
    if (keyboardDown[KeyCode.Digit2]) {
        drawCollisionEnabled = !drawCollisionEnabled;
    }
    if (keyboardDown[KeyCode.Digit3]) {
        setDebugLagK((_debugLagK + 1) % 3);
    }
    if (keyboardDown[KeyCode.Digit4]) {
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

export const drawCollisions = (list: Actor[]) => {
    if (drawCollisionEnabled) {
        for (const p of list) {
            drawActorBoundingSphere(p);
        }
    }
}

export const saveDebugState = (stateData: StateData) => {
    if (debugStateEnabled) {
        debugState = stateData;
        debugState.seed_ = _SEEDS[0];
        ++debugState.tic_;
        debugState.actors_.map(roundActors);
    }
}

export const addDebugState = (client: Client, packet: Packet, state: StateData) => {
    if (debugStateEnabled && client.ready_ && client.isPlaying_) {
        packet.state_ = state;
        packet.debug.state = debugState;
    }
}

export const assertStateInSync = (from: ClientID, data: Packet, state: StateData, gameTic: number) => {
    if (data.debug && data.debug.tic === (gameTic - 1)) {
        if (data.debug.seed !== _SEEDS[0]) {
            console.warn("seed mismatch from client " + from + " at tic " + data.debug.tic);
            console.warn(data.debug.seed + " != " + _SEEDS[0]);
        }
        if (data.debug.nextId !== state.nextId_) {
            console.warn("gen id mismatch from client " + from + " at tic " + data.debug.tic);
            console.warn(data.debug.nextId + " != " + state.nextId_);
        }
        if (debugStateEnabled) {
            if (data.debug.state && debugState) {
                assertStateEquality("[DEBUG] ", debugState, data.debug.state);
            }
            if (data.state_) {
                assertStateEquality("[FINAL] ", state, data.state_);
            }
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
                    "x_",
                    "y_",
                    "z_",
                    "u_",
                    "v_",
                    "w_",
                    "s_",
                    "detune_",
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