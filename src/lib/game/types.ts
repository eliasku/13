import {ClientID} from "../../shared/types";

export interface Player {
    c: ClientID;
    s: number;
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    btn?: number;
}

export interface Client {
    c: ClientID;
    // how many MY inputs are acknowledged by remote [remote-ack + 1 .. local tic]
    acknowledgedTic: number;
    // completed inputs received from remote
    t: number;

    // client starts play my events
    ready?: boolean;

    // I'm playing client's events
    isPlaying?: boolean;
}

export interface ClientEvent {
    t: number;
    spawn?: { x: number, y: number, z: number };
    btn?: number;
    // will be populated from packet info
    c?: ClientID;
}

export interface InitData {
    mapSeed: number;
    startSeed: number;
    players: Player[];
}

// packet = remote_events[cl.ack + 1] ... remote_events[cl.tic]
export interface Packet {
    sync: boolean;

    c: ClientID;
    // seed for current tic
    //_: number;
    // confirm the last tic we received from Sender
    receivedOnSender: number;
    // packet contains info tic and before
    t: number;
    // events are not confirmed
    e: ClientEvent[];

    // init state
    s?: InitData;
}