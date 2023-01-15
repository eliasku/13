import {ClientID} from "../../../shared/src/types";
import {Img} from "../assets/gfx";
import {atan2, PI, PI2} from "../utils/math";

export const enum ActorType {
    Player = 0,
    Barrel = 1,
    Bullet = 2,
    Item = 3,
    // static game objects
    Tree = 4,
}

export const enum ItemType {
    Hp = 0,
    Hp2 = 1,
    Credit = 2,
    Credit2 = 3,
    Shield = 4,
    Ammo = 5,
    // FLAG
    Weapon = 8,

    SubTypeMask = 7,
}

export interface Pos {
    _x: number;
    _y: number;
    _z: number;
}

export interface Vel {
    _u: number;
    _v: number;
    _w: number;
}

export interface Actor extends Pos, Vel {
    // 0..4
    _type: ActorType;
    // 32-bit identifier
    _id: number;

    // Item: ItemType subtype
    // Tree: GFX variation
    // Bullet: BulletType subtype
    // 4-bit
    _subtype: number;

    // Player: reload time
    // Bullet: life-time
    // Item: life-time / 3
    // 8-bit
    _lifetime: number;

    // all objects HP (0..15)
    // 4 bits
    _hp?: number;

    // all objects SP (0..15)
    // 4 bits
    _sp?: number;

    // 8-bit: just generated anim start point
    _anim0?: number;

    // Hit effect (5 bits: 0...31)
    // For Items could not be picked up until it reach 0
    _animHit?: number;

    // local frame-scope state
    _localStateFlags?: number;
}

export interface PlayerActor extends Actor {
    // Player: client ID or NPC ~entityID
    // 32-bit identifier
    _client: ClientID;

    // Magazines (0..15)
    // 4 bits
    _mags?: number;

    // detune counter: 0...32 (max of weapon detune-speed parameter)
    _detune: number;

    // 0...63 (max_weapon_clip_reload)
    // 6 bits
    _clipReload?: number;

    // holding Weapon ID
    // range: 0...15 currently
    // 4 bits
    _weapon?: number;

    // 4 bits
    _weapon2?: number;

    // 0...63 (max_weapon_clip_size)
    // 6 bits
    _clipAmmo?: number;

    // 6 bits
    _clipAmmo2?: number;

    // oh... check down trigger 4 bits
    _trig?: number;

    // Input buttons
    // 32-bit
    _input: number;
}

export interface BarrelActor extends Actor {

}

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
    _btn?: number;
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
    _sync: boolean;
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

export interface Particle extends Pos, Vel {
    // angle
    _a: number;
    // rotation speed
    _r: number;

    // gravity factor
    _gravity: number;

    _scale: number;
    _scaleDelta: number;
    _color: number;

    _lifeTime: number;
    _lifeMax: number;

    _img: Img;
    _splashSizeX: number;
    _splashSizeY: number;
    _splashEachJump: number;
    _splashScaleOnVelocity: number;
    _splashImg: number;
    _followVelocity: number;
    _followScale: number;

    _shadowScale: number;
}

export interface TextParticle extends Pos {
    _text: string;
    _lifetime: number;
    _time: number;
}

export const unpackAngleByte = (angleByte: number, res: number) =>
    PI2 * (angleByte & (res - 1)) / res - PI;

export const packAngleByte = (a: number, res: number) =>
    (res * a) & (res - 1);

export const packDirByte = (x: number, y: number, res: number) =>
    packAngleByte((PI + atan2(y, x)) / PI2, res);

