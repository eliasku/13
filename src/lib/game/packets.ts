import {Actor, newStateData, Packet} from "./types";
import {Const} from "./config";
import {decodeRLE, encodeRLE} from "../utils/rle";

const _packI32 = new Int32Array(1024 * 16);
const _packU8 = new Uint8Array(_packI32.buffer);
//const _packF64 = new Float64Array(_packU8.buffer);
const _rleBuffer = new Uint8Array(1024 * 16 * 4);

export const unpack = (data: ArrayBuffer): Packet | undefined => {
    const i32 = Const.RLE ? _packI32 : new Int32Array(data);
    const gotByteLength = Const.RLE ? decodeRLE(new Uint8Array(data), data.byteLength, _packU8) : data.byteLength;

    let ptr = 0;
    const packetDwordsSize = i32[ptr++];
    if (packetDwordsSize * 4 > gotByteLength) {
        console.warn("income packet size mismatch: ", packetDwordsSize * 4, " expected, actual: ", gotByteLength);
        return;
    }
    const flags0 = i32[ptr++];
    const packet: Packet = {
        sync_: !!(flags0 & 1),
        client_: i32[ptr++],
        receivedOnSender_: i32[ptr++],
        tic_: i32[ptr++],
        checkTic_: i32[ptr++],
        checkSeed_: i32[ptr++] >>> 0,
        checkNextId_: i32[ptr++],
        events_: []
    };
    const eventsCount = i32[ptr++];
    let event_t = i32[ptr++];
    // 10
    for (let i = 0; i < eventsCount; ++i) {
        const btn = i32[ptr++];
        if (btn != -1) {
            packet.events_.push({
                tic_: event_t + i,
                client_: packet.client_,
                btn_: btn,
            });
        }
    }
    if (flags0 & 2) {
        const state = newStateData();
        state.mapSeed_ = i32[ptr++] >>> 0;
        state.seed_ = i32[ptr++] >>> 0;
        state.nextId_ = i32[ptr++];
        let count = i32[ptr++];
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
            state.actors_[p.type_].push(p);
        }
        const scoreCount = i32[ptr++];
        for(let i = 0; i < scoreCount; ++i) {
            state.scores_[i32[ptr++]] = i32[ptr++];
        }
        packet.state_ = state;
    }
    if (process.env.NODE_ENV === "development") {
        if (flags0 & 4) {
            const state = newStateData();
            state.mapSeed_ = i32[ptr++] >>> 0;
            state.seed_ = i32[ptr++] >>> 0;
            state.nextId_ = i32[ptr++];
            let count = i32[ptr++];
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
                state.actors_[p.type_].push(p);
            }
            packet.checkState_ = state;
        }
    }
    return packet;
}

export const pack = (packet: Packet): ArrayBuffer => {
    const i32 = _packI32;
    let ptr = 1;
    {
        // 1 - sync
        // 2 - init-packet
        let flags0 = packet.sync_ ? 1 : 0;
        if (!!packet.state_) {
            flags0 |= 2;
        }
        if(process.env.NODE_ENV === "development") {
            if (!!packet.checkState_) {
                flags0 |= 4;
            }
        }
        i32[ptr++] = flags0;
    }
    i32[ptr++] = packet.client_;
    i32[ptr++] = packet.receivedOnSender_;
    i32[ptr++] = packet.tic_;
    i32[ptr++] = packet.checkTic_;
    i32[ptr++] = packet.checkSeed_;
    i32[ptr++] = packet.checkNextId_;

    const events = packet.events_;
    events.sort((a, b) => a.tic_ - b.tic_);
    let event_t = events.length ? events[0].tic_ : 0;
    const event_end = events.length ? events[events.length - 1].tic_ : -1;
    i32[ptr++] = event_end - event_t + 1;
    i32[ptr++] = event_t;

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
        i32[ptr++] = packet.state_.mapSeed_;
        i32[ptr++] = packet.state_.seed_;
        i32[ptr++] = packet.state_.nextId_;
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
        for(const id in packet.state_.scores_) {
            i32[ptr++] = +id;
            i32[ptr++] = packet.state_.scores_[id];
        }
    }
    if (process.env.NODE_ENV === "development") {
        if (packet.checkState_) {
            i32[ptr++] = packet.checkState_.mapSeed_;
            i32[ptr++] = packet.checkState_.seed_;
            i32[ptr++] = packet.checkState_.nextId_;
            const list: Actor[] = [].concat(...packet.checkState_.actors_);
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
    // save packet dwords size to header
    i32[0] = ptr;

    if (Const.RLE) {
        const size = encodeRLE(_packU8, ptr * 4, _rleBuffer);
        return _rleBuffer.buffer.slice(0, size);
    } else {
        return i32.buffer.slice(0, ptr * 4);
    }
}
