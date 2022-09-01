export type ClientID = number;
export type CallID = number;
export type MessageData = any;
export type MessageTypeID = number;

export const EventSourceUrl = "/_";
export const VersionsId = 1;

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
