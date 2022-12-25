import {Actor, ClientEvent, newStateData, Packet, PacketDebug, StateData} from "./types";
import {ClientID} from "../../../shared/src/types";

const DEBUG_SIGN = 0xdeb51a1e;

const readState = (state: StateData, i32: Int32Array, ptr: number): number => {
    state.nextId_ = i32[ptr++];
    state.tic_ = i32[ptr++];
    state.seed_ = i32[ptr++] >>> 0;
    state.mapSeed_ = i32[ptr++] >>> 0;
    const count = i32[ptr++];
    for (let i = 0; i < count; ++i) {
        const hdr = i32[ptr++];
        const ux = i32[ptr++];
        const vy = i32[ptr++];
        const wz = i32[ptr++];
        const ammoData = i32[ptr++];
        const p: Actor = {
            type_: hdr & 7,
            weapon_: (hdr >> 3) & 15,
            s_: (hdr >> 7) & 0xFF,
            anim0_: (hdr >> 15) & 0xFF,
            hp_: (hdr >> 23) & 15,
            sp_: (ux >> 16) & 15,
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

            clipAmmo_: ammoData & 63,
            clipReload_: (ammoData >> 6) & 63,
            mags_: (ammoData >> 12) & 0b1111,
            clipAmmo2_: (ammoData >> 16) & 63,
            weapon2_: (ammoData >> 22) & 0b1111,
            trig_: (ammoData >> 26) & 0b1111,
        };
        state.actors_[p.type_].push(p);
    }
    const statMapSize = i32[ptr++];
    for (let i = 0; i < statMapSize; ++i) {
        state.stats_.set(i32[ptr++], {
            frags_: i32[ptr++],
            scores_: i32[ptr++],
        });
    }
    return ptr;
}
export const unpack = (client: ClientID, i32: Int32Array,/* let */ _events: ClientEvent[] = [], _state?: StateData, _debug?: PacketDebug): Packet => {
    let event_tic = i32[2];
    const ts0 = i32[3];
    const ts1 = i32[4];
    // 10
    let ptr = 5;
    for (; event_tic;) {
        const v = i32[ptr++];
        const delta = v >> 21;
        _events.push({
            tic_: event_tic,
            client_: client,
            btn_: v & 0x1fffff,
        });
        event_tic += delta;
        if (!delta) break;
    }
    if (i32[1] & 2) {
        _state = newStateData();
        ptr = readState(_state, i32, ptr);
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
                ptr = readState(_debug.state, i32, ptr);
            }
        }
    }
    return {
        sync_: (i32[1] & 1) as any as boolean,
        tic_: i32[0],
        receivedOnSender_: i32[0] + (i32[1] >> 2),
        events_: _events,
        state_: _state,
        debug: _debug,
        _ts0: ts0,
        _ts1: ts1,
    };
}

const validateFieldSize = (a: Actor) => {
    console.assert(a.type_ >= 0 && a.type_ < (2 ** 3));
    console.assert(a.weapon_ >= 0 && a.weapon_ < (2 ** 4));
    console.assert(a.s_ >= 0 && a.s_ < (2 ** 8));
    console.assert(a.anim0_ >= 0 && a.anim0_ < (2 ** 8));
    console.assert(a.hp_ >= 0 && a.hp_ < (2 ** 4));

    console.assert(a.u_ >= -1024 && a.u_ <= 1024);
    console.assert(a.v_ >= -1024 && a.v_ <= 1024);
    console.assert(a.w_ >= -1024 && a.w_ <= 1024);
    console.assert(a.x_ >= 0 && a.x_ <= 0xFFFF);
    console.assert(a.y_ >= 0 && a.y_ <= 0xFFFF);
    console.assert(a.z_ >= 0 && a.z_ <= 0xFFFF);

    console.assert(a.id_ >= 0 && a.id_ < 2 ** 31);
    //console.assert(a.client_);
    console.assert(a.btn_ >= 0 && a.btn_ < 2 ** 31);

    console.assert(a.clipAmmo_ >= 0 && a.clipAmmo_ < 2 ** 6);
    console.assert(a.clipReload_ >= 0 && a.clipReload_ < 2 ** 6);
    console.assert(a.mags_ >= 0 && a.mags_ < 2 ** 4);
    console.assert(a.clipAmmo2_ >= 0 && a.clipAmmo2_ < 2 ** 6);
    console.assert(a.weapon2_ >= 0 && a.weapon2_ < 2 ** 4);
    console.assert(a.trig_ >= 0 && a.trig_ < 2 ** 4);
};

const writeState = (state: StateData | undefined, i32: Int32Array, ptr: number): number => {
    if (state) {
        i32[ptr++] = state.nextId_;
        i32[ptr++] = state.tic_;
        i32[ptr++] = state.seed_;
        i32[ptr++] = state.mapSeed_;
        const list: Actor[] = [].concat(...state.actors_);
        i32[ptr++] = list.length;
        for (const p of list) {
            if (process.env.NODE_ENV === "development") {
                validateFieldSize(p);
            }
            // type: 3
            // weapon: 4
            // hp: 5
            // detune: 5
            // animHit: 5
            i32[ptr++] = p.type_ | (p.weapon_ << 3) | (p.s_ << 7) | (p.anim0_ << 15) | (p.hp_ << 23);
            i32[ptr++] = (p.u_ << 21) | (p.sp_ << 16) | p.x_;
            i32[ptr++] = (p.v_ << 21) | (p.detune_ << 16) | p.y_;
            i32[ptr++] = (p.w_ << 21) | (p.animHit_ << 16) | p.z_;
            i32[ptr++] = p.clipAmmo_ | (p.clipReload_ << 6) | (p.mags_ << 12) | (p.clipAmmo2_ << 16) | (p.weapon2_ << 22) | (p.trig_ << 26);
            i32[ptr++] = p.id_;
            i32[ptr++] = p.client_;
            i32[ptr++] = p.btn_;
        }
        i32[ptr++] = state.stats_.size;
        for (const [id, stat] of state.stats_) {
            i32[ptr++] = id;
            i32[ptr++] = stat.frags_;
            i32[ptr++] = stat.scores_;
        }
    }
    return ptr;
}

export const pack = (packet: Packet, i32: Int32Array): ArrayBuffer => {
    i32[0] = packet.tic_;
    // 0-bit - sync
    // 1-bit - init-packet
    i32[1] = ((packet.receivedOnSender_ - packet.tic_) << 2) | ((!!packet.state_) as any << 1) | (packet.sync_ as any);
    const events = packet.events_;
    events.sort((a, b) => a.tic_ - b.tic_);
    const event_tic = events.length ? events[0].tic_ : 0;
    i32[2] = event_tic;
    i32[3] = packet._ts0;
    i32[4] = packet._ts1;
    let ptr = 5;
    let i = 0;
    while (i < events.length) {
        const e = events[i++];
        const c = events[i] ? (events[i].tic_ - e.tic_) : 0;
        i32[ptr++] = (c << 21) | e.btn_;
    }
    ptr = writeState(packet.state_, i32, ptr);
    if (process.env.NODE_ENV === "development") {
        if (packet.debug) {
            i32[ptr++] = DEBUG_SIGN;
            i32[ptr++] = packet.debug.tic;
            i32[ptr++] = packet.debug.nextId;
            i32[ptr++] = packet.debug.seed;
            if (packet.debug.state) {
                i32[ptr++] = DEBUG_SIGN;
                ptr = writeState(packet.debug.state, i32, ptr);
            }
        }
    }
    return i32.buffer.slice(0, ptr * 4);
}
