import {
    Actor,
    ActorType,
    BarrelActor,
    BulletActor,
    ClientEvent,
    ItemActor,
    newStateData,
    Packet,
    PacketDebug,
    PlayerActor,
    StateData
} from "./types";
import {ClientID} from "../../../shared/src/types";

const DEBUG_SIGN = 0xdeb51a1e;

const readActor = (p: Actor, i32: Int32Array, ptr: number): number => {
    p._id = i32[ptr++];
    {
        const ux = i32[ptr++];
        const vy = i32[ptr++];
        const wz = i32[ptr++];
        p._x = ux & 0xFFFF;
        p._y = vy & 0xFFFF;
        p._z = wz & 0xFFFF;
        p._u = ux >> 21;
        p._v = vy >> 21;
        p._w = wz >> 21;
        p._sp = (ux >> 16) & 0b1111;
        p._subtype = (vy >> 16) & 0b1111;
        p._animHit = (wz >> 16) & 31;
    }
    {
        const hdr = i32[ptr++];
        p._lifetime = hdr & 0xFF;
        p._anim0 = (hdr >> 8) & 0xFF;
        p._hp = (hdr >> 16) & 0b1111;
    }
    return ptr;
}
const readPlayerActor = (list: PlayerActor[], i32: Int32Array, ptr: number): number => {
    const p = {_type: ActorType.Player} as PlayerActor;
    ptr = readActor(p, i32, ptr);

    p._client = i32[ptr++];
    p._input = i32[ptr++];

    const data = i32[ptr++];
    p._detune = data & 31;
    p._clipAmmo = (data >> 5) & 63;
    p._weapon2 = (data >> 11) & 0b1111;
    p._trig = (data >> 15) & 0b1111;
    p._clipReload = (data >> 19) & 63;
    p._mags = (data >> 25) & 0b1111;

    const data2 = i32[ptr++];
    p._clipAmmo2 = (data2) & 63;
    p._weapon = (data2 >> 6) & 0b1111;

    list.push(p);
    return ptr;
}

const readBarrelActor = (list: BarrelActor[], i32: Int32Array, ptr: number): number => {
    const p = {_type: ActorType.Barrel} as BarrelActor;
    ptr = readActor(p, i32, ptr);
    list.push(p);
    return ptr;
}

const readBulletActor = (list: BulletActor[], i32: Int32Array, ptr: number): number => {
    const p = {_type: ActorType.Bullet} as BulletActor;
    ptr = readActor(p, i32, ptr);
    p._ownerId = i32[ptr++];
    const data = i32[ptr++];
    p._damage = data & 0b1111;
    list.push(p);
    return ptr;
}

const readItemActor = (list: ItemActor[], i32: Int32Array, ptr: number): number => {
    const p = {_type: ActorType.Item} as ItemActor;
    ptr = readActor(p, i32, ptr);
    const data = i32[ptr++];
    p._itemWeapon = data & 0b1111;
    p._itemWeaponAmmo = (data >> 4) & 0b111111;
    list.push(p);
    return ptr;
}

const readState = (state: StateData, i32: Int32Array, ptr: number): number => {
    state._nextId = i32[ptr++];
    state._tic = i32[ptr++];
    state._seed = i32[ptr++] >>> 0;
    {
        let count = i32[ptr++];
        for (let i = 0; i < count; ++i) {
            ptr = readPlayerActor(state._actors[ActorType.Player], i32, ptr);
        }
    }
    {
        let count = i32[ptr++];
        for (let i = 0; i < count; ++i) {
            ptr = readBarrelActor(state._actors[ActorType.Barrel], i32, ptr);
        }
    }
    {
        let count = i32[ptr++];
        for (let i = 0; i < count; ++i) {
            ptr = readBulletActor(state._actors[ActorType.Bullet], i32, ptr);
        }
    }
    {
        let count = i32[ptr++];
        for (let i = 0; i < count; ++i) {
            ptr = readItemActor(state._actors[ActorType.Item], i32, ptr);
        }
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
            _input: v & 0x1fffff,
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

const validateFieldSize = (p: Actor) => {
    console.assert(p._type >= 0 && p._type < (2 ** 3));
    console.assert(p._lifetime >= 0 && p._lifetime < (2 ** 8));
    console.assert(p._anim0 >= 0 && p._anim0 < (2 ** 8));
    console.assert(p._hp >= 0 && p._hp < (2 ** 4));

    console.assert(p._u >= -1024 && p._u <= 1024);
    console.assert(p._v >= -1024 && p._v <= 1024);
    console.assert(p._w >= -1024 && p._w <= 1024);
    console.assert(p._x >= 0 && p._x <= 0xFFFF);
    console.assert(p._y >= 0 && p._y <= 0xFFFF);
    console.assert(p._z >= 0 && p._z <= 0xFFFF);

    console.assert(p._id >= 0 && p._id < 2 ** 31);
    console.assert(p._subtype >= 0 && p._subtype < 2 ** 4);
};

const writeActor = (p: Actor, i32: Int32Array, ptr: number): number => {
    if (process.env.NODE_ENV === "development") {
        validateFieldSize(p);
    }
    // type: 3
    // weapon: 4
    // hp: 5
    // detune: 5
    // animHit: 5
    i32[ptr++] = p._id;
    i32[ptr++] = (p._u << 21) | (p._sp << 16) | p._x;
    i32[ptr++] = (p._v << 21) | (p._subtype << 16) | p._y;
    i32[ptr++] = (p._w << 21) | (p._animHit << 16) | p._z;
    i32[ptr++] = p._lifetime | (p._anim0 << 8) | (p._hp << 16);
    return ptr;
};

const writePlayerActor = (p: PlayerActor, i32: Int32Array, ptr: number): number => {
    ptr = writeActor(p, i32, ptr);
    if (process.env.NODE_ENV === "development") {
        console.assert(p._detune >= 0 && p._detune < 2 ** 5);
        console.assert(p._clipAmmo2 >= 0 && p._clipAmmo2 < 2 ** 6);
        console.assert(p._weapon2 >= 0 && p._weapon2 < 2 ** 4);
        console.assert(p._trig >= 0 && p._trig < 2 ** 4);
        console.assert(p._input >= 0 && p._input < 2 ** 31);
        console.assert(p._clipReload >= 0 && p._clipReload < 2 ** 6);
        console.assert(p._mags >= 0 && p._mags < 2 ** 4);
        console.assert(p._clipAmmo >= 0 && p._clipAmmo < 2 ** 6);
        console.assert(p._weapon >= 0 && p._weapon < (2 ** 4));
    }
    i32[ptr++] = p._client;
    i32[ptr++] = p._input;
    i32[ptr++] = p._detune | (p._clipAmmo << 5) | (p._weapon2 << 11) | (p._trig << 15) | (p._clipReload << 19) | (p._mags << 25) | (0 << 29);
    i32[ptr++] = p._clipAmmo2 | (p._weapon << 6);
    return ptr;
};

const writeBarrelActor = (p: BarrelActor, i32: Int32Array, ptr: number): number => {
    return writeActor(p, i32, ptr);
};

const writeBulletActor = (p: BulletActor, i32: Int32Array, ptr: number): number => {
    ptr = writeActor(p, i32, ptr);
    if (process.env.NODE_ENV === "development") {
        console.assert(p._damage >= 0 && p._damage < (2 ** 4));
    }
    i32[ptr++] = p._ownerId;
    i32[ptr++] = p._damage;
    return ptr;
};

const writeItemActor = (p: ItemActor, i32: Int32Array, ptr: number): number => {
    ptr = writeActor(p, i32, ptr);
    if (process.env.NODE_ENV === "development") {
        console.assert(p._itemWeapon >= 0 && p._itemWeapon < 2 ** 4, p._itemWeapon);
        console.assert(p._itemWeaponAmmo >= 0 && p._itemWeaponAmmo < 2 ** 6, p._itemWeaponAmmo);
    }
    i32[ptr++] = p._itemWeapon | (p._itemWeaponAmmo << 4);
    return ptr;
};

const writeState = (state: StateData | undefined, i32: Int32Array, ptr: number): number => {
    if (state) {
        i32[ptr++] = state._nextId;
        i32[ptr++] = state._tic;
        i32[ptr++] = state._seed;
        {
            const list = state._actors[ActorType.Player];
            i32[ptr++] = list.length;
            for (const p of list) {
                ptr = writePlayerActor(p, i32, ptr);
            }
        }
        {
            const list = state._actors[ActorType.Barrel];
            i32[ptr++] = list.length;
            for (const p of list) {
                ptr = writeBarrelActor(p, i32, ptr);
            }
        }
        {
            const list = state._actors[ActorType.Bullet];
            i32[ptr++] = list.length;
            for (const p of list) {
                ptr = writeBulletActor(p, i32, ptr);
            }
        }
        {
            const list = state._actors[ActorType.Item];
            i32[ptr++] = list.length;
            for (const p of list) {
                ptr = writeItemActor(p, i32, ptr);
            }
        }
        //
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
        i32[ptr++] = (c << 21) | e._input;
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
