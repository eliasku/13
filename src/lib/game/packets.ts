import {Actor, ClientEvent, newStateData, Packet} from "./types";

//const _packU8 = new Uint8Array(1024 * 64);
const _packI32 = new Int32Array(1024 * 16);
//const _packF64 = new Float64Array(_packU8.buffer);
//const _rleBuffer = new Uint8Array(1024 * 64);

export function unpack(data: ArrayBuffer): Packet | undefined {
    const i32 = new Int32Array(data);
    // const u32 = Const.RLE ? _packU32 : new Uint32Array(data);
    // const f64 = Const.RLE ? _packF64 : new Float64Array(data);
    // const gotByteLength = Const.RLE ? decodeRLE(new Uint8Array(data), data.byteLength, _packU8) : data.byteLength;
    //const gotByteLength = Const.RLE ? decodeRLE(new Uint8Array(data), data.byteLength, _packU8) : data.byteLength;

    let ptr = 0;
    const packetDwordsSize = i32[ptr++];
    if (packetDwordsSize * 4 > data.byteLength) {
        return;
    }
    const flags0 = i32[ptr++];
    const packet: Packet = {
        sync_: !!(flags0 & 1),
        client_: i32[ptr++],
        receivedOnSender_: i32[ptr++],
        tic_: i32[ptr++],
        check_tic_: i32[ptr++],
        check_seed_: i32[ptr++] >>> 0,
        events_: []
    };
    const eventsCount = i32[ptr++];
    let event_t = i32[ptr++];
    // 10
    for (let i = 0; i < eventsCount; ++i) {
        const e: ClientEvent = {
            tic_: event_t++,
        };
        const flags = i32[ptr++];
        const hasBtn = flags & 1;
        const hasClientID = flags & 2;
        if (hasBtn) {
            e.btn_ = i32[ptr++];
        }
        if (hasClientID) {
            e.client_ = i32[ptr++];
        } else {
            e.client_ = packet.client_;
        }
        packet.events_.push(e);
    }
    if (flags0 & 2) {
        const init = newStateData();
        init.mapSeed_ = i32[ptr++] >>> 0;
        init.seed_ = i32[ptr++] >>> 0;
        let count = i32[ptr++];
        for (let i = 0; i < count; ++i) {
            const hdr = i32[ptr++];
            const c = i32[ptr++];
            const btn_ = i32[ptr++];

            const anim = i32[ptr++];
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

                x: i32[ptr++] / 1000,
                y: i32[ptr++] / 1000,
                z: i32[ptr++] / 1000,
                u: i32[ptr++] / 1000,
                v: i32[ptr++] / 1000,
                w: i32[ptr++] / 1000,
                s: i32[ptr++] / 1000,
                t: i32[ptr++] / 1000,
            };
            init.actors_[p.type_].push(p);
        }
        packet.state_ = init;
    }
    return packet;
}

export function pack(packet: Packet): ArrayBuffer {
    const i32 = _packI32;
    let ptr = 1;
    {
        // 1 - sync
        // 2 - init-packet
        let flags0 = packet.sync_ ? 1 : 0;
        if (!!packet.state_) {
            flags0 |= 2;
        }
        i32[ptr++] = flags0;
    }
    i32[ptr++] = packet.client_;
    i32[ptr++] = packet.receivedOnSender_;
    i32[ptr++] = packet.tic_;
    i32[ptr++] = packet.check_tic_;
    i32[ptr++] = packet.check_seed_;

    packet.events_.sort((a, b) => a.tic_ - b.tic_);
    let event_t = packet.events_.length > 0 ? packet.events_[0].tic_ : 0;
    const event_end = packet.events_.length > 0 ? packet.events_[packet.events_.length - 1].tic_ : -1;
    i32[ptr++] = event_end - event_t + 1;
    i32[ptr++] = event_t;

    let i = 0;
    while (event_t <= event_end) {
        const e = packet.events_[i];
        const t = event_t++;
        if (t < e.tic_) {
            i32[ptr++] = 0;
            continue;
        }
        ++i;
        let flags = 0;
        if (e.btn_ !== undefined) flags |= 1;
        if (!!e.client_) flags |= 2;
        i32[ptr++] = flags;
        if (e.btn_ !== undefined) {
            i32[ptr++] = e.btn_;
        }
        if (!!e.client_) {
            i32[ptr++] = e.client_;
        }
    }
    if (packet.state_) {
        i32[ptr++] = packet.state_.mapSeed_;
        i32[ptr++] = packet.state_.seed_;
        const list: Actor[] = [].concat(...packet.state_.actors_);
        i32[ptr++] = list.length;
        for (const p of list) {
            i32[ptr++] = p.type_ | (p.hp_ << 8) | (p.weapon_ << 16);
            i32[ptr++] = p.client_;
            i32[ptr++] = p.btn_;
            i32[ptr++] = ((p.animHit_ & 0xFF) << 8) | (p.anim0_ & 0xFF);
            i32[ptr++] = p.x * 1000;
            i32[ptr++] = p.y * 1000;
            i32[ptr++] = p.z * 1000;
            i32[ptr++] = p.u * 1000;
            i32[ptr++] = p.v * 1000;
            i32[ptr++] = p.w * 1000;
            i32[ptr++] = p.s * 1000;
            i32[ptr++] = p.t * 1000;
        }
    }

    // save packet dwords size to header
    i32[0] = ptr;

    // if (Const.RLE) {
    //     const size = encodeRLE(_packU8, ptr * 4, _rleBuffer);
    //     return _rleBuffer.buffer.slice(0, size);
    // } else {
    return i32.buffer.slice(0, ptr * 4);
    // }
}
