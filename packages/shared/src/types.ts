// client ID is positive for all real users.
// NPC are using entity identifier, negative (-entity.id)
export type ClientID = number;
export type CallID = number;
export type MessageData = any;
export type MessageTypeID = number;

declare var __VERSION__: string;
declare var __SERVER_URL__: string;

export const BuildVersion = __VERSION__;
export const ServerUrl = __SERVER_URL__;

export const enum ServerEventName {
    Close = 0,
    Ping = 1,
    ClientInit = 2,
    ClientUpdate = 3,
    ClientListChange = 4,
}

export const enum MessageType {
    Nop = 0,
    RtcOffer = 1,
    RtcCandidate = 2,
    Name = 3,
}

export const enum MessageField {
    Source = 0,
    Destination = 1,
    Type = 2,
    Call = 3,
    Data = 4,
}

export type Message = [
    // source - from
    ClientID,
    // destination - to
    ClientID,
    // type
    MessageTypeID,
    // call id
    CallID,
    // payload
    MessageData,
    // call identifier
];

export type Request = [
    // source - from
    ClientID,
    // messages array
    Message[]
];

// number of processed messages
export type PostMessagesResponse = number;

/* DTO */
export interface RoomInfo {
    code: string;
    players: number;
    max: number;
}

/* DTO */
export interface RoomsInfoResponse {
    rooms: RoomInfo[],
    players: number,
}

export const enum GameModeFlag {
    Public = 1,
    Coop = 2,
    Timer = 4,
    Offline = 1 << 16,
}

export interface NewGameParams {
    _flags: number;
    _playersLimit: number;
    _npcLevel: number;
    _theme: number;
}