import {Actor, ClientEvent, newStateData, Packet, PacketDebug, StateData} from "./types";
import {ClientID} from "../../shared/types";

const DEBUG_SIGN = 0xdeb51a1e;

export const unpack = (client: ClientID, i32: Int32Array,/* let */ _events: ClientEvent[] = [], _state?: StateData, _debug?: PacketDebug): Packet => {
    let event_t = i32[2];
    // 10
    let ptr = 3;
    for(;event_t;) {
        const v = i32[ptr++];
        let c = v >> 19;
        _events.push({
            tic_: event_t,
            client_: client,
            btn_: v & 0x7ffff,
        });
        event_t += c;
        if(!c) break;
    }
    if (i32[1] & 2) {
        _state = newStateData();
        _state.nextId_ = i32[ptr++];
        _state.tic_ = i32[ptr++];
        _state.seed_ = i32[ptr++] >>> 0;
        _state.mapSeed_ = i32[ptr++] >>> 0;
        const count = i32[ptr++];
        for (let i = 0; i < count; ++i) {
            const hdr = i32[ptr++];
            const ux = i32[ptr++];
            const vy = i32[ptr++];
            const wz = i32[ptr++];
            const p: Actor = {
                type_: hdr & 7,
                weapon_: (hdr >> 3) & 15,
                s_: (hdr >> 7) & 0xFF,
                anim0_: (hdr >> 15) & 0xFF,
                hp_: (ux >> 16) & 31,
                detune_: (vy >> 16) & 31,
                animHit_: (wz >> 16) & 31,

                x_: ux & 0xFFFF,
                y_: vy & 0xFFFF,
                z_: wz & 0xFFFF,
                u_: ux >> 21,
                v_: vy >> 21,
                w_: wz >> 21,

                id_: i32[ptr++],
                client_: i32[ptr++],
                btn_: i32[ptr++],
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
                    const ux = i32[ptr++];
                    const vy = i32[ptr++];
                    const wz = i32[ptr++];
                    const p: Actor = {
                        type_: hdr & 7,
                        weapon_: (hdr >> 3) & 15,
                        s_: (hdr >> 7) & 0xFF,
                        anim0_: (hdr >> 15) & 0xFF,
                        hp_: (ux >> 16) & 31,
                        detune_: (vy >> 16) & 31,
                        animHit_: (wz >> 16) & 31,

                        x_: ux & 0xFFFF,
                        y_: vy & 0xFFFF,
                        z_: wz & 0xFFFF,
                        u_: ux >> 21,
                        v_: vy >> 21,
                        w_: wz >> 21,

                        id_: i32[ptr++],
                        client_: i32[ptr++],
                        btn_: i32[ptr++],
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
        sync_: (i32[1] & 1) as any as boolean,
        tic_: i32[0],
        receivedOnSender_: i32[0] + (i32[1] >> 16),
        events_: _events,
        state_: _state,
        debug: _debug,
    };
}

export const pack = (packet: Packet, i32: Int32Array): ArrayBuffer => {
    i32[0] = packet.tic_;
    // 1 - sync
    // 2 - init-packet
    i32[1] = ((packet.receivedOnSender_ - packet.tic_) << 16) | (packet.sync_ as any) | (!!packet.state_ as any << 1);
    const events = packet.events_;
    events.sort((a, b) => a.tic_ - b.tic_);
    let event_t = events.length ? events[0].tic_ : 0;
    i32[2] = event_t;
    let ptr = 3;
    let i = 0;
    while (i < events.length) {
        const e = events[i++];
        const c = events[i] ? (events[i].tic_ - e.tic_) : 0;
        i32[ptr++] = (c << 19) | e.btn_;
    }
    if (packet.state_) {
        i32[ptr++] = packet.state_.nextId_;
        i32[ptr++] = packet.state_.tic_;
        i32[ptr++] = packet.state_.seed_;
        i32[ptr++] = packet.state_.mapSeed_;
        const list: Actor[] = [].concat(...packet.state_.actors_);
        i32[ptr++] = list.length;
        for (const p of list) {
            // type: 3
            // weapon: 4
            // hp: 5
            // detune: 5
            // animHit: 5
            i32[ptr++] = p.type_ | (p.weapon_ << 3) | (p.s_ << 7) | (p.anim0_ << 15);
            i32[ptr++] = (p.u_ << 21) | (p.hp_ << 16) | p.x_;
            i32[ptr++] = (p.v_ << 21) | (p.detune_ << 16) | p.y_;
            i32[ptr++] = (p.w_ << 21) | (p.animHit_ << 16) | p.z_;
            i32[ptr++] = p.id_;
            i32[ptr++] = p.client_;
            i32[ptr++] = p.btn_;
        }
        i32[ptr++] = Object.keys(packet.state_.scores_).length;
        for (const id in packet.state_.scores_) {
            i32[ptr++] = id as any;
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
                    // type: 3
                    // weapon: 4
                    // hp: 5
                    // detune: 5
                    // animHit: 5
                    i32[ptr++] = p.type_ | (p.weapon_ << 3) | (p.s_ << 7) | (p.anim0_ << 15);
                    i32[ptr++] = (p.u_ << 21) | (p.hp_ << 16) | p.x_;
                    i32[ptr++] = (p.v_ << 21) | (p.detune_ << 16) | p.y_;
                    i32[ptr++] = (p.w_ << 21) | (p.animHit_ << 16) | p.z_;
                    i32[ptr++] = p.id_;
                    i32[ptr++] = p.client_;
                    i32[ptr++] = p.btn_;
                }
            }
        }
    }
    return i32.buffer.slice(0, ptr * 4);
}
