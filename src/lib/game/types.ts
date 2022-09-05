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
    x_: number;
    y_: number;
    z_: number;
}

export interface Vel {
    u_: number;
    v_: number;
    w_: number;
}

export interface Actor extends Pos, Vel {
    id_: number;
    type_: ActorType;
    client_: ClientID;
    btn_: number;
    // stpq
    s_?: number;
    t_?: number;
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
    client_: ClientID;
}

export interface StateData {
    mapSeed_: number;
    seed_: number;
    actors_: Actor[][];
    nextId_: number;
    scores_: Record<number, number>;
}

export const newStateData = (): StateData => ({
    mapSeed_: 0,
    seed_: 0,
    actors_: [[], [], [], []],
    nextId_: 0,
    scores_: {},
});

// packet = remote_events[cl.ack + 1] ... remote_events[cl.tic]
export interface Packet {
    sync_: boolean;

    // DEBUG: check current tic seed
    checkSeed_: number;
    checkTic_: number;
    checkNextId_: number;
    checkState_?: StateData;
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
