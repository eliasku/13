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
}

export interface Pos {
    x_: number;
    y_: number;
    z_: number;
}

export interface Vel {
    u_: number;
    v_: number;
    w_: number;
}

/* {
    type: 3,
    detune: 5,
    anim-hit: 5
    weapon: 4,
    hp: 5,
 */
export interface Actor extends Pos, Vel {
    // 32-bit identifier
    id_: number;
    // 32-bit identifier
    client_: ClientID;

    // 0..4
    type_: ActorType;

    btn_: number;

    // reload time
    // bullet life-time
    // 8-bit
    s_: number;

    // detune counter: 0...32 (max of weapon detune-speed parameter)
    detune_: number;

    // Item, Player, Barrel : holding or contains Weapon ID
    // Bullet : Damage value
    // range: 0...15 currently
    // 4 bits
    weapon_?: number;

    // all objects HP (0..15)
    // 4 bits
    hp_?: number;

    // all objects SP (0..15)
    // 4 bits
    sp_?: number;

    // Magazines (0..15)
    // 4 bits
    mags_?: number;

    // 8-bit: just generated anim start point
    anim0_?: number;

    // Hit effect (5 bits: 0...31)
    // For Items could not be picked up until it reach 0
    animHit_?: number;

    // local frame-scope state
    fstate_?: number;

    // 0...63 (max_weapon_clip_size)
    // 6 bits
    clipAmmo_?: number;

    // 0...63 (max_weapon_clip_reload)
    // 6 bits
    clipReload_?: number;

    // 4 bits
    weapon2_?: number;

    // 6 bits
    clipAmmo2_?: number;

    // oh... check down trigger 4 bits
    trig_?: number;
}

export interface Client {
    id_: ClientID;

    // how many MY inputs are acknowledged by remote [remote-ack + 1 .. local tic]
    acknowledgedTic_: number;

    // completed inputs received from remote
    tic_: number;
    _ts0: number;
    _ts1: number;

    // client starts play my events
    ready_?: boolean;

    // I'm playing client's events
    isPlaying_?: boolean;

    startState?: StateData;
}

export interface ClientEvent {
    tic_: number;
    btn_?: number;
    // will be populated from packet info
    client_: ClientID;
}

export interface PlayerStat {
    scores_: number;
    frags_: number;
}

export interface StateData {
    nextId_: number;
    tic_: number;
    seed_: number;
    mapSeed_: number;
    actors_: Actor[][];
    stats_: Map<ClientID, PlayerStat>;
}

export const newStateData = (): StateData => ({
    nextId_: 0,
    tic_: 0,
    seed_: 0,
    mapSeed_: 0,
    actors_: [[], [], [], []],
    stats_: new Map(),
});

// packet = remote_events[cl.ack + 1] ... remote_events[cl.tic]
export interface Packet {
    sync_: boolean;
    // confirm the last tic we received from Sender
    receivedOnSender_: number;
    // packet contains info tic and before, 22 bits, for 19 hr of game session
    tic_: number;

    // timestamps to measure lag between 2 peers
    _ts0: number;
    _ts1: number;

    // events are not confirmed
    events_: ClientEvent[];
    // init state
    state_?: StateData;

    // DEBUG: check current tic seed
    debug?: PacketDebug;
}

export interface PacketDebug {
    nextId: number;
    tic: number;
    seed: number;
    state?: StateData;
}

export interface Particle extends Pos, Vel {
    // angle
    a_: number;
    // rotation speed
    r_: number;

    // gravity factor
    gravity_: number;

    scale_: number;
    scaleDelta_: number;
    color_: number;

    lifeTime_: number;
    lifeMax_: number;

    img_: Img;
    splashSizeX_: number;
    splashSizeY_: number;
    splashEachJump_: number;
    splashScaleOnVelocity_: number;
    splashImg_: number;
    followVelocity_: number;
    followScale_: number;

    shadowScale: number;
}

export interface TextParticle extends Pos {
    text_: string;
    lifetime_: number;
    time_: number;
}

export const unpackAngleByte = (angleByte: number, res: number) =>
    PI2 * (angleByte & (res - 1)) / res - PI;

export const packAngleByte = (a: number, res: number) =>
    (res * a) & (res - 1);

export const packDirByte = (x: number, y: number, res: number) =>
    packAngleByte((PI + atan2(y, x)) / PI2, res);

