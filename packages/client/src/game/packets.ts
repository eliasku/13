import {Actor, ClientEvent, newStateData, Packet, PacketDebug, StateData} from "./types";
import {ClientID} from "../../../shared/src/types";

const DEBUG_SIGN = 0xdeb51a1e;

const readState = (state: StateData, i32: Int32Array, ptr: number): number => {
    state._nextId = i32[ptr++];
    state._tic = i32[ptr++];
    state._seed = i32[ptr++] >>> 0;
    state._mapSeed = i32[ptr++] >>> 0;
    const count = i32[ptr++];
    for (let i = 0; i < count; ++i) {
        const hdr = i32[ptr++];
        const ux = i32[ptr++];
        const vy = i32[ptr++];
        const wz = i32[ptr++];
        const ammoData = i32[ptr++];
        const p: Actor = {
            _type: hdr & 7,
            _weapon: (hdr >> 3) & 15,
            _s: (hdr >> 7) & 0xFF,
            _anim0: (hdr >> 15) & 0xFF,
            _hp: (hdr >> 23) & 15,
            _sp: (ux >> 16) & 15,
            _detune: (vy >> 16) & 31,
            _animHit: (wz >> 16) & 31,

            _x: ux & 0xFFFF,
            _y: vy & 0xFFFF,
            _z: wz & 0xFFFF,
            _u: ux >> 21,
            _v: vy >> 21,
            _w: wz >> 21,

            _id: i32[ptr++],
            _client: i32[ptr++],
            _btn: i32[ptr++],

            _clipAmmo: ammoData & 63,
            _clipReload: (ammoData >> 6) & 63,
            _mags: (ammoData >> 12) & 0b1111,
            _clipAmmo2: (ammoData >> 16) & 63,
            _weapon2: (ammoData >> 22) & 0b1111,
            _trig: (ammoData >> 26) & 0b1111,
        };
        state._actors[p._type].push(p);
    }
    const statMapSize = i32[ptr++];
    for (let i = 0; i < statMapSize; ++i) {
        state._stats.set(i32[ptr++], {
            _frags: i32[ptr++],
            _scores: i32[ptr++],
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
            _tic: event_tic,
            _client: client,
            _btn: v & 0x1fffff,
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
                _tic: i32[ptr++],
                _nextId: i32[ptr++],
                _seed: i32[ptr++] >>> 0,
            };
            if (i32[ptr++] === DEBUG_SIGN) {
                _debug._state = newStateData();
                ptr = readState(_debug._state, i32, ptr);
            }
        }
    }
    return {
        _sync: (i32[1] & 1) as any as boolean,
        _tic: i32[0],
        _receivedOnSender: i32[0] + (i32[1] >> 2),
        _events: _events,
        _state: _state,
        _debug: _debug,
        _ts0: ts0,
        _ts1: ts1,
    };
}

const validateFieldSize = (a: Actor) => {
    console.assert(a._type >= 0 && a._type < (2 ** 3));
    console.assert(a._weapon >= 0 && a._weapon < (2 ** 4));
    console.assert(a._s >= 0 && a._s < (2 ** 8));
    console.assert(a._anim0 >= 0 && a._anim0 < (2 ** 8));
    console.assert(a._hp >= 0 && a._hp < (2 ** 4));

    console.assert(a._u >= -1024 && a._u <= 1024);
    console.assert(a._v >= -1024 && a._v <= 1024);
    console.assert(a._w >= -1024 && a._w <= 1024);
    console.assert(a._x >= 0 && a._x <= 0xFFFF);
    console.assert(a._y >= 0 && a._y <= 0xFFFF);
    console.assert(a._z >= 0 && a._z <= 0xFFFF);

    console.assert(a._id >= 0 && a._id < 2 ** 31);
    //console.assert(a.client_);
    console.assert(a._btn >= 0 && a._btn < 2 ** 31);

    console.assert(a._clipAmmo >= 0 && a._clipAmmo < 2 ** 6);
    console.assert(a._clipReload >= 0 && a._clipReload < 2 ** 6);
    console.assert(a._mags >= 0 && a._mags < 2 ** 4);
    console.assert(a._clipAmmo2 >= 0 && a._clipAmmo2 < 2 ** 6);
    console.assert(a._weapon2 >= 0 && a._weapon2 < 2 ** 4);
    console.assert(a._trig >= 0 && a._trig < 2 ** 4);
};

const writeState = (state: StateData | undefined, i32: Int32Array, ptr: number): number => {
    if (state) {
        i32[ptr++] = state._nextId;
        i32[ptr++] = state._tic;
        i32[ptr++] = state._seed;
        i32[ptr++] = state._mapSeed;
        const list: Actor[] = [].concat(...state._actors);
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
            i32[ptr++] = p._type | (p._weapon << 3) | (p._s << 7) | (p._anim0 << 15) | (p._hp << 23);
            i32[ptr++] = (p._u << 21) | (p._sp << 16) | p._x;
            i32[ptr++] = (p._v << 21) | (p._detune << 16) | p._y;
            i32[ptr++] = (p._w << 21) | (p._animHit << 16) | p._z;
            i32[ptr++] = p._clipAmmo | (p._clipReload << 6) | (p._mags << 12) | (p._clipAmmo2 << 16) | (p._weapon2 << 22) | (p._trig << 26);
            i32[ptr++] = p._id;
            i32[ptr++] = p._client;
            i32[ptr++] = p._btn;
        }
        i32[ptr++] = state._stats.size;
        for (const [id, stat] of state._stats) {
            i32[ptr++] = id;
            i32[ptr++] = stat._frags;
            i32[ptr++] = stat._scores;
        }
    }
    return ptr;
}

export const pack = (packet: Packet, i32: Int32Array): ArrayBuffer => {
    i32[0] = packet._tic;
    // 0-bit - sync
    // 1-bit - init-packet
    i32[1] = ((packet._receivedOnSender - packet._tic) << 2) | ((!!packet._state) as any << 1) | (packet._sync as any);
    const events = packet._events;
    events.sort((a, b) => a._tic - b._tic);
    const event_tic = events.length ? events[0]._tic : 0;
    i32[2] = event_tic;
    i32[3] = packet._ts0;
    i32[4] = packet._ts1;
    let ptr = 5;
    let i = 0;
    while (i < events.length) {
        const e = events[i++];
        const c = events[i] ? (events[i]._tic - e._tic) : 0;
        i32[ptr++] = (c << 21) | e._btn;
    }
    ptr = writeState(packet._state, i32, ptr);
    if (process.env.NODE_ENV === "development") {
        if (packet._debug) {
            i32[ptr++] = DEBUG_SIGN;
            i32[ptr++] = packet._debug._tic;
            i32[ptr++] = packet._debug._nextId;
            i32[ptr++] = packet._debug._seed;
            if (packet._debug._state) {
                i32[ptr++] = DEBUG_SIGN;
                ptr = writeState(packet._debug._state, i32, ptr);
            }
        }
    }
    return i32.buffer.slice(0, ptr * 4);
}
