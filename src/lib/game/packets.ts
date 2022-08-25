import {Actor, ClientEvent, InitData, Packet} from "./types";
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
        return undefined;
    }
    const flags0 = u32[ptr++];
    const packet: Packet = {
        sync_: !!(flags0 & 1),
        c: u32[ptr++],
        receivedOnSender_: u32[ptr++],
        t: u32[ptr++],
        check_tic_: u32[ptr++],
        check_seed_: u32[ptr++],
        e: []
    };
    const eventsCount = u32[ptr++];
    let event_t = u32[ptr++];
    const GAP = u32[ptr++];
    // 10
    for (let i = 0; i < eventsCount; ++i) {
        const e: ClientEvent = {
            t: event_t++,
        };
        const flags = u32[ptr++];
        const GAP = u32[ptr++];
        const hasBtn = flags & 1;
        const hasSpawn = flags & 2;
        const hasClientID = flags & 4;
        if (hasBtn) {
            e.btn_ = u32[ptr++];
            const GAP = u32[ptr++];
        }
        if (hasSpawn) {
            e.spawn_ = {
                x: u32[ptr++],
                y: u32[ptr++],
                z: u32[ptr++],
            };
            const GAP = u32[ptr++];
        }
        if (hasClientID) {
            e.c = u32[ptr++];
            const GAP = u32[ptr++];
        } else {
            e.c = packet.c;
        }
        packet.e.push(e);
    }
    if (flags0 & 2) {
        const init: InitData = {
            mapSeed_: u32[ptr++],
            seed_: u32[ptr++],
            players_: [],
            barrels_: [],
            bullets_: [],
            items_: [],
        };
        let count = u32[ptr++];
        const GAP = u32[ptr++];
        let lists = [init.players_, init.barrels_, init.bullets_, init.items_];
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
                c,
                btn_,
                anim0_,
                animHit_: anim_,

                x: f64[(ptr >> 1) + 0],
                y: f64[(ptr >> 1) + 1],
                z: f64[(ptr >> 1) + 2],
                vx: f64[(ptr >> 1) + 3],
                vy: f64[(ptr >> 1) + 4],
                vz: f64[(ptr >> 1) + 5],
                t: f64[(ptr >> 1) + 6],
                t2: f64[(ptr >> 1) + 7],
            };
            ptr += 8 * 2;
            lists[p.type_].push(p);
        }
        packet.s = init;
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
        if (!!packet.s) {
            flags0 |= 2;
        }
        u32[ptr++] = flags0;
    }
    u32[ptr++] = packet.c;
    u32[ptr++] = packet.receivedOnSender_;
    u32[ptr++] = packet.t;
    u32[ptr++] = packet.check_tic_;
    u32[ptr++] = packet.check_seed_;

    packet.e.sort((a, b) => a.t - b.t);
    let event_t = packet.e.length > 0 ? packet.e[0].t : 0;
    const event_end = packet.e.length > 0 ? packet.e[packet.e.length - 1].t : -1;
    u32[ptr++] = event_end - event_t + 1;
    u32[ptr++] = event_t;
    // GAP:
    u32[ptr++] = 0;

    let i = 0;
    while (event_t <= event_end) {
        const e = packet.e[i];
        const t = event_t++;
        if (t < e.t) {
            u32[ptr++] = 0;
            // GAP:
            u32[ptr++] = 0;
            continue;
        }
        ++i;
        let flags = 0;
        if (e.btn_ !== undefined) flags |= 1;
        if (e.spawn_) flags |= 2;
        if (!!e.c) flags |= 4;
        u32[ptr++] = flags;
        // GAP:
        u32[ptr++] = 0;

        if (e.btn_ !== undefined) {
            u32[ptr++] = e.btn_;
            // GAP:
            u32[ptr++] = 0;
        }
        if (e.spawn_) {
            u32[ptr++] = e.spawn_.x;
            u32[ptr++] = e.spawn_.y;
            u32[ptr++] = e.spawn_.z;
            // GAP:
            u32[ptr++] = 0;
        }
        if (!!e.c) {
            u32[ptr++] = e.c;
            // GAP:
            u32[ptr++] = 0;
        }
    }
    if (packet.s) {
        u32[ptr++] = packet.s.mapSeed_;
        u32[ptr++] = packet.s.seed_;
        const list = packet.s.players_.concat(packet.s.barrels_, packet.s.bullets_, packet.s.items_);
        u32[ptr++] = list.length;
        // GAP:
        u32[ptr++] = 0;
        for (let i = 0; i < list.length; ++i) {
            const p = list[i];
            u32[ptr++] = p.type_ | (p.hp_ << 8) | (p.weapon_ << 16);
            u32[ptr++] = p.c;
            u32[ptr++] = p.btn_;
            u32[ptr++] = ((p.animHit_ & 0xFF) << 8) | (p.anim0_ & 0xFF);

            f64[(ptr >> 1) + 0] = p.x;
            f64[(ptr >> 1) + 1] = p.y;
            f64[(ptr >> 1) + 2] = p.z;
            f64[(ptr >> 1) + 3] = p.vx;
            f64[(ptr >> 1) + 4] = p.vy;
            f64[(ptr >> 1) + 5] = p.vz;
            f64[(ptr >> 1) + 6] = p.t;
            f64[(ptr >> 1) + 7] = p.t2;
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
