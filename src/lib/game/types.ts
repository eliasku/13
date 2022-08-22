import {ClientID} from "../../shared/types";

export const enum ActorType {
    Player = 1,
}

export interface Actor {
    type_: ActorType;
    c: ClientID;
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    btn_?: number;
}

export interface Client {
    c: ClientID;
    // how many MY inputs are acknowledged by remote [remote-ack + 1 .. local tic]
    acknowledgedTic_: number;
    // completed inputs received from remote
    t: number;

    // client starts play my events
    ready_?: boolean;

    // I'm playing client's events
    isPlaying_?: boolean;
}

export interface ClientEvent {
    t: number;
    spawn_?: { x: number, y: number, z: number };
    btn_?: number;
    // will be populated from packet info
    c?: ClientID;
}

export interface InitData {
    mapSeed_: number;
    startSeed_: number;
    actors_: Actor[];
}

// packet = remote_events[cl.ack + 1] ... remote_events[cl.tic]
export interface Packet {
    sync_: boolean;

    c: ClientID;
    // seed for current tic
    //_: number;
    // confirm the last tic we received from Sender
    receivedOnSender_: number;
    // packet contains info tic and before
    t: number;
    // events are not confirmed
    e: ClientEvent[];

    // init state
    s?: InitData;
}