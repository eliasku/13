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

export const enum ItemCategory {
    Effect = 0x100,
    Weapon = 0x200,
}

export const enum EffectItemType {
    Med = 0,
    Health = 1,
}

export interface Pos {
    x: number;
    y: number;
    z: number;
}

export interface Vel {
    u: number;
    v: number;
    w: number;
}

export interface Actor extends Pos, Vel {
    id_: number;
    type_: ActorType;
    client_: ClientID;
    btn_?: number;
    // stpq
    s?: number;
    t?: number;
    // p?: number;
    // q?: number;

    weapon_?: number;
    hp_?: number;
    // 1 byte: just generated anim start point
    anim0_?: number;
    // hit effect (4 bits: 0...15)
    animHit_?: number;
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
    client_?: ClientID;
}

export interface StateData {
    mapSeed_: number;
    seed_: number;
    actors_: Actor[][];
    nextId_: number;
}

export function newStateData(): StateData {
    return {
        mapSeed_: 0,
        seed_: 0,
        actors_: [[], [], [], []],
        nextId_: 0,
    };
}

// packet = remote_events[cl.ack + 1] ... remote_events[cl.tic]
export interface Packet {
    sync_: boolean;

    // DEBUG: check current tic seed
    check_seed_: number;
    check_tic_: number;
    /////

    client_: ClientID;
    // confirm the last tic we received from Sender
    receivedOnSender_: number;
    // packet contains info tic and before
    tic_: number;
    // events are not confirmed
    events_: ClientEvent[];

    // init state
    state_?: StateData;
}


export interface Particle {
    x: number;
    y: number;
    z: number;
    u: number;
    v: number;
    w: number;
    // angle
    a: number;
    // rotation speed
    r: number;

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
