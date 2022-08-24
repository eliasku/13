export type ClientID = number;
export type CallID = number;
export type MessageData = any;
export type MessageTypeID = number;

export const EventSourceUrl = "/0";
export const VersionsId = 1;

export const enum ServerEventName {
    Ping = 0,
    ClientConnected = 1,
    ClientAdd = 2,
    ClientRemove = 3,
    ClientUpdate = 4,
}

export const enum MessageType {
    RtcOffer = 1,
    RtcCandidate = 2,
}

export interface Message {
    // source - from
    s: ClientID;
    // destination - to
    d: ClientID;
    // type
    t: MessageTypeID;
    // payload
    a: MessageData;
    // call identifier
    c?: CallID;
}

export interface Request {
    // source - from
    s?: ClientID;
    // messages array
    a?: Message[];
}

export interface PostMessagesResponse {
    // number of processed messages
    a: number;
}
