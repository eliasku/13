import {ClientID} from "../../shared/types";
import {Img} from "../assets/gfx";

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
    Weapon = 1,
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
    weapon_?: number;

    // all objects HP are < 32
    hp_?: number;

    // 8-bit: just generated anim start point
    anim0_?: number;

    // Hit effect (5 bits: 0...31)
    // For Items could not be picked up until it reach 0
    animHit_?: number;

    // local frame-scope state
    fstate_?: number;
}

export interface Client {
    id_: ClientID;

    // how many MY inputs are acknowledged by remote [remote-ack + 1 .. local tic]
    acknowledgedTic_: number;

    // completed inputs received from remote
    tic_: number;

    // client starts play my events
    ready_?: boolean;

    // I'm playing client's events
    isPlaying_?: boolean;
}

export interface ClientEvent {
    tic_: number;
    btn_?: number;
    // will be populated from packet info
    client_: ClientID;
}

export interface StateData {
    nextId_: number;
    tic_: number;
    seed_: number;
    mapSeed_: number;
    actors_: Actor[][];
    scores_: Record<number, number>;
}

export const newStateData = (): StateData => ({
    nextId_: 0,
    tic_: 0,
    seed_: 0,
    mapSeed_: 0,
    actors_: [[], [], [], []],
    scores_: {},
});

// packet = remote_events[cl.ack + 1] ... remote_events[cl.tic]
export interface Packet {
    sync_: boolean;
    // confirm the last tic we received from Sender
    receivedOnSender_: number;
    // packet contains info tic and before, 22 bits, for 19 hr of game session
    tic_: number;
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

    scale_: number;
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
}
