import {Actor, ClientEvent, newStateData, Packet, PacketDebug, StateData} from "./types";
import {Const} from "./config";
import {ClientID} from "../../shared/types";
//import {decodeRLE, encodeRLE} from "../utils/rle";

const DEBUG_SIGN = 0xdeb51a1e;

// const _packU8 = new Uint8Array(_packI32.buffer);
// const _rleBuffer = new Uint8Array(1024 * 16 * 4);

export const unpack = (client: ClientID, i32: Int32Array,/* let */ _events: ClientEvent[] = [], _state?: StateData, _debug?: PacketDebug): Packet => {
    const eventsCount = i32[3];
    let event_t = i32[4];
    // 10
    let ptr = 5;
    for (let i = 0; i < eventsCount; ++i) {
        const btn = i32[ptr++];
        if (btn != -1) {
            _events.push({
                tic_: event_t + i,
                client_: client,
                btn_: btn,
            });
        }
    }
    if (i32[0] & 2) {
        _state = newStateData();
        _state.nextId_ = i32[ptr++];
        _state.tic_ = i32[ptr++];
        _state.seed_ = i32[ptr++] >>> 0;
        _state.mapSeed_ = i32[ptr++] >>> 0;
        const count = i32[ptr++];
        for (let i = 0; i < count; ++i) {
            const hdr = i32[ptr++];
            const c = i32[ptr++];
            const btn_ = i32[ptr++];

            const anim = i32[ptr++];
            const anim0_ = anim & 0xFF;
            const anim_ = (anim >> 8) & 0xFF;

            const p: Actor = {
                id_: i32[ptr++],
                type_: hdr & 0xFF,
                hp_: (hdr >> 8) & 0xFF,
                weapon_: (hdr >> 16) & 0xFF,
                client_: c,
                btn_,
                anim0_,
                animHit_: anim_,

                x_: i32[ptr++] / Const.NetPrecision,
                y_: i32[ptr++] / Const.NetPrecision,
                z_: i32[ptr++] / Const.NetPrecision,
                u_: i32[ptr++] / Const.NetPrecision,
                v_: i32[ptr++] / Const.NetPrecision,
                w_: i32[ptr++] / Const.NetPrecision,
                s_: i32[ptr++] / Const.NetPrecision,
                t_: i32[ptr++] / Const.NetPrecision,
            };
            _state.actors_[p.type_].push(p);
        }
        const scoreCount = i32[ptr++];
        for (let i = 0; i < scoreCount; ++i) {
            _state.scores_[i32[ptr++]] = i32[ptr++];
        }
    }
    if (process.env.NODE_ENV === "development") {
        if (i32[ptr++] === DEBUG_SIGN) {
            _debug = {
                tic: i32[ptr++],
                nextId: i32[ptr++],
                seed: i32[ptr++] >>> 0,
            };
            if (i32[ptr++] === DEBUG_SIGN) {
                _debug.state = newStateData();
                _debug.state.nextId_ = i32[ptr++];
                _debug.state.tic_ = i32[ptr++];
                _debug.state.seed_ = i32[ptr++] >>> 0;
                _debug.state.mapSeed_ = i32[ptr++] >>> 0;

                const count = i32[ptr++];
                for (let i = 0; i < count; ++i) {
                    const hdr = i32[ptr++];
                    const c = i32[ptr++];
                    const btn_ = i32[ptr++];

                    const anim = i32[ptr++];
                    const anim0_ = anim & 0xFF;
                    const anim_ = (anim >> 8) & 0xFF;

                    const p: Actor = {
                        id_: i32[ptr++],
                        type_: hdr & 0xFF,
                        hp_: (hdr >> 8) & 0xFF,
                        weapon_: (hdr >> 16) & 0xFF,
                        client_: c,
                        btn_,
                        anim0_,
                        animHit_: anim_,

                        x_: i32[ptr++] / Const.NetPrecision,
                        y_: i32[ptr++] / Const.NetPrecision,
                        z_: i32[ptr++] / Const.NetPrecision,
                        u_: i32[ptr++] / Const.NetPrecision,
                        v_: i32[ptr++] / Const.NetPrecision,
                        w_: i32[ptr++] / Const.NetPrecision,
                        s_: i32[ptr++] / Const.NetPrecision,
                        t_: i32[ptr++] / Const.NetPrecision,
                    };
                    _debug.state.actors_[p.type_].push(p);
                }
                const scoreCount = i32[ptr++];
                for (let i = 0; i < scoreCount; ++i) {
                    _state.scores_[i32[ptr++]] = i32[ptr++];
                }
            }
        }
    }
    return {
        sync_: (i32[0] & 1) as any as boolean,
        receivedOnSender_: i32[1],
        tic_: i32[2],
        events_: _events,
        state_: _state,
        debug: _debug,
    };
}

export const pack = (packet: Packet, i32: Int32Array): ArrayBuffer => {
    // 1 - sync
    // 2 - init-packet
    i32[0] = +packet.sync_ | ((!!packet.state_) as any as number << 1);
    i32[1] = packet.receivedOnSender_;
    i32[2] = packet.tic_;
    const events = packet.events_;
    events.sort((a, b) => a.tic_ - b.tic_);
    let event_t = events.length ? events[0].tic_ : 0;
    const event_end = events.length ? events[events.length - 1].tic_ : -1;
    i32[3] = event_end - event_t + 1;
    i32[4] = event_t;

    let ptr = 5;
    let i = 0;
    // const debug :number[] = [];
    while (event_t <= event_end) {
        const e = packet.events_[i];
        if (event_t++ == e.tic_) {
            ++i;
            i32[ptr++] = e.btn_ ?? -1;
        } else {
            i32[ptr++] = -1;
        }
        // debug.push(e.btn_);
    }
    // console.info(JSON.stringify(debug));
    if (packet.state_) {
        i32[ptr++] = packet.state_.nextId_;
        i32[ptr++] = packet.state_.tic_;
        i32[ptr++] = packet.state_.seed_;
        i32[ptr++] = packet.state_.mapSeed_;
        const list: Actor[] = [].concat(...packet.state_.actors_);
        i32[ptr++] = list.length;
        for (const p of list) {
            i32[ptr++] = p.type_ | ((p.hp_ & 0xFF) << 8) | ((p.weapon_ & 0xFF) << 16);
            i32[ptr++] = p.client_;
            i32[ptr++] = p.btn_;
            i32[ptr++] = ((p.animHit_ & 0xFF) << 8) | (p.anim0_ & 0xFF);
            i32[ptr++] = p.id_;
            i32[ptr++] = p.x_ * Const.NetPrecision;
            i32[ptr++] = p.y_ * Const.NetPrecision;
            i32[ptr++] = p.z_ * Const.NetPrecision;
            i32[ptr++] = p.u_ * Const.NetPrecision;
            i32[ptr++] = p.v_ * Const.NetPrecision;
            i32[ptr++] = p.w_ * Const.NetPrecision;
            i32[ptr++] = p.s_ * Const.NetPrecision;
            i32[ptr++] = p.t_ * Const.NetPrecision;
        }
        i32[ptr++] = Object.keys(packet.state_.scores_).length;
        for (const id in packet.state_.scores_) {
            i32[ptr++] = +id;
            i32[ptr++] = packet.state_.scores_[id];
        }
    }
    if (process.env.NODE_ENV === "development") {
        if (packet.debug) {
            i32[ptr++] = DEBUG_SIGN;
            i32[ptr++] = packet.debug.tic;
            i32[ptr++] = packet.debug.nextId;
            i32[ptr++] = packet.debug.seed;
            if (packet.debug.state) {
                i32[ptr++] = DEBUG_SIGN;
                i32[ptr++] = packet.debug.state.nextId_;
                i32[ptr++] = packet.debug.state.tic_;
                i32[ptr++] = packet.debug.state.seed_;
                i32[ptr++] = packet.debug.state.mapSeed_;
                const list: Actor[] = [].concat(...packet.debug.state.actors_);
                i32[ptr++] = list.length;
                for (const p of list) {
                    i32[ptr++] = p.type_ | ((p.hp_ & 0xFF) << 8) | ((p.weapon_ & 0xFF) << 16);
                    i32[ptr++] = p.client_;
                    i32[ptr++] = p.btn_;
                    i32[ptr++] = ((p.animHit_ & 0xFF) << 8) | (p.anim0_ & 0xFF);
                    i32[ptr++] = p.id_;
                    i32[ptr++] = p.x_ * Const.NetPrecision;
                    i32[ptr++] = p.y_ * Const.NetPrecision;
                    i32[ptr++] = p.z_ * Const.NetPrecision;
                    i32[ptr++] = p.u_ * Const.NetPrecision;
                    i32[ptr++] = p.v_ * Const.NetPrecision;
                    i32[ptr++] = p.w_ * Const.NetPrecision;
                    i32[ptr++] = p.s_ * Const.NetPrecision;
                    i32[ptr++] = p.t_ * Const.NetPrecision;
                }
            }
        }
    }
    return i32.buffer.slice(0, ptr * 4);
}
