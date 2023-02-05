import {ClientID} from "@iioi/shared/types.js";
import {atan2, PI, PI2} from "../utils/math.js";

export const ActorType = {
    Player: 0,
    Barrel: 1,
    Bullet: 2,
    Item: 3,
    // static game objects
    Tree: 4,
} as const;
export type ActorType = (typeof ActorType)[keyof typeof ActorType];

export const ItemType = {
    Hp: 0,
    Hp2: 1,
    Credit: 2,
    Credit2: 3,
    Shield: 4,
    Ammo: 5,
    // FLAG
    Weapon: 8,

    SubTypeMask: 7,
} as const;
export type ItemType = (typeof ItemType)[keyof typeof ItemType];

export interface Pos {
    /** uint16 **/
    _x: number;
    /** uint16 **/
    _y: number;
    /** uint16 */
    _z: number;
}

export interface Vel {
    /** int11 [-1024; +1024] **/
    _u: number;
    /** int11 [-1024; +1024] **/
    _v: number;
    /** int11 [-1024; +1024] **/
    _w: number;
}

export interface Actor extends Pos, Vel {
    /** uint:4 **/
    _type: ActorType;
    /** uint32 **/
    _id: number;

    // Item: ItemType subtype
    // Tree: GFX variation
    // Bullet: BulletType subtype
    // 4-bit
    /** uint:4 **/
    _subtype: number;

    // Player: reload time
    // Bullet: life-time
    // Item: life-time / 3
    /** uint8 **/
    _lifetime: number;

    /**
     * health points [0; 15]
     * @type uint4
     **/
    _hp: number;

    /**
     * shield points [0; 15]
     * @type uint4
     **/
    _sp: number;

    /**
     * generated static variation seed value for animation
     * @type uint8
     **/
    _anim0: number;

    /**
     * Hit effect. For Items could not be picked up until it reach 0
     * @type uint5
     **/
    _animHit: number;

    /**
     * local frame-scope state
     * @type uint32
     * @transient
     **/
    _localStateFlags: number;
}

export interface PlayerActor extends Actor {
    // Player: client ID or NPC ~entityID
    // 32-bit identifier
    _client: ClientID;

    // Magazines (0..15)
    // 4 bits
    _mags: number;

    // detune counter: 0...32 (max of weapon detune-speed parameter)
    _detune: number;

    // 0...63 (max_weapon_clip_reload)
    // 6 bits
    _clipReload: number;

    // holding Weapon ID
    // range: 0...15 currently
    // 4 bits
    _weapon: number;

    // 4 bits
    _weapon2: number;

    // 0...63 (max_weapon_clip_size)
    // 6 bits
    _clipAmmo: number;

    // 6 bits
    _clipAmmo2: number;

    // oh... check down trigger 4 bits
    _trig: number;

    // Input buttons
    // 32-bit
    _input: number;
}

export type BarrelActor = Actor;

export interface BulletActor extends Actor {
    // Bullet: owner ID
    // 32-bit identifier
    _ownerId: ClientID;

    // damage amount
    // range: 0...15 currently
    // 4 bits
    _damage: number;
}

export interface ItemActor extends Actor {
    // range: 0...15 currently
    // 4 bits
    _itemWeapon: number;
    // 0...63 (max_weapon_clip_size)
    // 6 bits
    _itemWeaponAmmo: number;
}

export interface Client {
    _id: ClientID;

    // how many MY inputs are acknowledged by remote [remote-ack + 1 .. local tic]
    _acknowledgedTic: number;

    // completed inputs received from remote
    _tic: number;
    _ts0: number;
    _ts1: number;
    _lag?: number;

    // client starts play my events
    _ready?: boolean;

    // I'm playing client's events
    _isPlaying?: boolean;

    _startState?: StateData;
}

export interface ClientEvent {
    _tic: number;
    // TODO: rename to `_input`
    _input?: number;
    // will be populated from packet info
    _client: ClientID;
}

export interface PlayerStat {
    _scores: number;
    _frags: number;
}

export interface StateData {
    _nextId: number;
    _tic: number;
    _seed: number;
    _actors: [PlayerActor[], BarrelActor[], BulletActor[], ItemActor[]];
    _stats: Map<ClientID, PlayerStat>;
}

export const newStateData = (): StateData => ({
    _nextId: 0,
    _tic: 0,
    _seed: 0,
    _actors: [[], [], [], []],
    _stats: new Map(),
});

// packet = remote_events[cl.ack + 1] ... remote_events[cl.tic]
export interface Packet {
    _sync: number;
    // confirm the last tic we received from Sender
    _receivedOnSender: number;
    // packet contains info tic and before, 22 bits, for 19 hr of game session
    _tic: number;

    // timestamps to measure lag between 2 peers
    _ts0: number;
    _ts1: number;

    // events are not confirmed
    _events: ClientEvent[];
    // init state
    _state?: StateData;

    // DEBUG: check current tic seed
    _debug?: PacketDebug;
}

export interface PacketDebug {
    _nextId: number;
    _tic: number;
    _seed: number;
    _state?: StateData;
}

export const unpackAngleByte = (angleByte: number, res: number) => (PI2 * (angleByte & (res - 1))) / res - PI;

export const packAngleByte = (a: number, res: number) => (res * a) & (res - 1);

export const packDirByte = (x: number, y: number, res: number) => packAngleByte((PI + atan2(y, x)) / PI2, res);

/*
    First 19 bits
    [ ..... LA-LA-LA-LA-LA-LA-LA MA-MA-MA-MA-MA-MA Sp Dr Sh Ju Ru Mo ]

    Next high 13 bits not used
 */
export const ControlsFlag = {
    Move: 0x1,
    Run: 0x2,
    Jump: 0x4,
    Fire: 0x8,
    Drop: 0x10,
    Reload: 0x20,
    Swap: 0x40,
    Spawn: 0x80,

    // 5-bits for Move angle (32 directions)
    MoveAngleMax: 0x20,
    MoveAngleBit: 8,
    // 8-bits for Look angle (256 directions)
    LookAngleMax: 0x100,
    LookAngleBit: 13,

    DownEvent_Fire: 1,
    DownEvent_Drop: 2,
    DownEvent_Reload: 4,
    DownEvent_Swap: 8,
} as const;

export type ControlsFlag = (typeof ControlsFlag)[keyof typeof ControlsFlag];
