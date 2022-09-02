import {Actor, ClientEvent, newStateData, Packet} from "./types";
import {Const} from "./config";
import {decodeRLE, encodeRLE} from "../utils/rle";

const _packU8 = new Uint8Array(1024 * 64);
const _packU32 = new Uint32Array(_packU8.buffer);
const _packF64 = new Float64Array(_packU8.buffer);
const _rleBuffer = new Uint8Array(1024 * 64);

export function unpack(data: ArrayBuffer): Packet | undefined {
    const u32 = Const.RLE ? _packU32 : new Uint32Array(data);
    const f64 = Const.RLE ? _packF64 : new Float64Array(data);
    const gotByteLength = Const.RLE ? decodeRLE(new Uint8Array(data), data.byteLength, _packU8) : data.byteLength;

    let ptr = 0;
    const packetDwordsSize = u32[ptr++];
    if (packetDwordsSize * 4 > gotByteLength) {
        return;
    }
    const flags0 = u32[ptr++];
    const packet: Packet = {
        sync_: !!(flags0 & 1),
        client_: u32[ptr++],
        receivedOnSender_: u32[ptr++],
        tic_: u32[ptr++],
        check_tic_: u32[ptr++],
        check_seed_: u32[ptr++],
        events_: []
    };
    const eventsCount = u32[ptr++];
    let event_t = u32[ptr++];
    const GAP = u32[ptr++];
    // 10
    for (let i = 0; i < eventsCount; ++i) {
        const e: ClientEvent = {
            tic_: event_t++,
        };
        const flags = u32[ptr++];
        const GAP = u32[ptr++];
        const hasBtn = flags & 1;
        const hasClientID = flags & 2;
        if (hasBtn) {
            e.btn_ = u32[ptr++];
            const GAP = u32[ptr++];
        }
        if (hasClientID) {
            e.client_ = u32[ptr++];
            const GAP = u32[ptr++];
        } else {
            e.client_ = packet.client_;
        }
        packet.events_.push(e);
    }
    if (flags0 & 2) {
        const init = newStateData();
        init.mapSeed_ = u32[ptr++];
        init.seed_ = u32[ptr++];
        let count = u32[ptr++];
        const GAP = u32[ptr++];
        for (let i = 0; i < count; ++i) {
            const hdr = u32[ptr++];
            const c = u32[ptr++];
            const btn_ = u32[ptr++];

            const anim = u32[ptr++];
            const anim0_ = anim & 0xFF;
            const anim_ = (anim >> 8) & 0xFF;

            const p: Actor = {
                type_: hdr & 0xFF,
                hp_: (hdr >> 8) & 0xFF,
                weapon_: (hdr >> 16) & 0xFF,
                client_: c,
                btn_,
                anim0_,
                animHit_: anim_,

                x: f64[(ptr >> 1) + 0],
                y: f64[(ptr >> 1) + 1],
                z: f64[(ptr >> 1) + 2],
                u: f64[(ptr >> 1) + 3],
                v: f64[(ptr >> 1) + 4],
                w: f64[(ptr >> 1) + 5],
                s: f64[(ptr >> 1) + 6],
                t: f64[(ptr >> 1) + 7],
            };
            ptr += 8 * 2;
            init.actors_[p.type_].push(p);
        }
        packet.state_ = init;
    }
    return packet;
}

export function pack(packet: Packet): ArrayBuffer {
    const u32 = _packU32;
    const f64 = _packF64;
    let ptr = 0;
    u32[ptr++] = 0;
    {
        // 1 - sync
        // 2 - init-packet
        let flags0 = packet.sync_ ? 1 : 0;
        if (!!packet.state_) {
            flags0 |= 2;
        }
        u32[ptr++] = flags0;
    }
    u32[ptr++] = packet.client_;
    u32[ptr++] = packet.receivedOnSender_;
    u32[ptr++] = packet.tic_;
    u32[ptr++] = packet.check_tic_;
    u32[ptr++] = packet.check_seed_;

    packet.events_.sort((a, b) => a.tic_ - b.tic_);
    let event_t = packet.events_.length > 0 ? packet.events_[0].tic_ : 0;
    const event_end = packet.events_.length > 0 ? packet.events_[packet.events_.length - 1].tic_ : -1;
    u32[ptr++] = event_end - event_t + 1;
    u32[ptr++] = event_t;
    // GAP:
    u32[ptr++] = 0;

    let i = 0;
    while (event_t <= event_end) {
        const e = packet.events_[i];
        const t = event_t++;
        if (t < e.tic_) {
            u32[ptr++] = 0;
            // GAP:
            u32[ptr++] = 0;
            continue;
        }
        ++i;
        let flags = 0;
        if (e.btn_ !== undefined) flags |= 1;
        if (!!e.client_) flags |= 2;
        u32[ptr++] = flags;
        // GAP:
        u32[ptr++] = 0;

        if (e.btn_ !== undefined) {
            u32[ptr++] = e.btn_;
            // GAP:
            u32[ptr++] = 0;
        }
        if (!!e.client_) {
            u32[ptr++] = e.client_;
            // GAP:
            u32[ptr++] = 0;
        }
    }
    if (packet.state_) {
        u32[ptr++] = packet.state_.mapSeed_;
        u32[ptr++] = packet.state_.seed_;
        const list:Actor[] = [].concat(...packet.state_.actors_);
        u32[ptr++] = list.length;
        // GAP:
        u32[ptr++] = 0;
        for (const p of list) {
            u32[ptr++] = p.type_ | (p.hp_ << 8) | (p.weapon_ << 16);
            u32[ptr++] = p.client_;
            u32[ptr++] = p.btn_;
            u32[ptr++] = ((p.animHit_ & 0xFF) << 8) | (p.anim0_ & 0xFF);

            f64[(ptr >> 1) + 0] = p.x;
            f64[(ptr >> 1) + 1] = p.y;
            f64[(ptr >> 1) + 2] = p.z;
            f64[(ptr >> 1) + 3] = p.u;
            f64[(ptr >> 1) + 4] = p.v;
            f64[(ptr >> 1) + 5] = p.w;
            f64[(ptr >> 1) + 6] = p.s;
            f64[(ptr >> 1) + 7] = p.t;
            ptr += 8 * 2;
        }
    }

    // save packet dwords size to header
    u32[0] = ptr;

    if (Const.RLE) {
        const size = encodeRLE(_packU8, ptr * 4, _rleBuffer);
        return _rleBuffer.buffer.slice(0, size);
    } else {
        return u32.buffer.slice(0, ptr * 4);
    }
}
