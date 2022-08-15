export type ClientID = number;
export type CallID = number;
export type MessageBody = any;

export const enum ServerEventName {
    ClientConnected = "connected",
    ClientAdd = "client_add",
    ClientRemove = "client_remove",
    ClientUpdate = "update",
}

export interface Message {
    call?: CallID;
    from: ClientID;
    to: ClientID;
    data: MessageBody;
}

export interface Request {
    from?: ClientID;
    messages?: Message[];
}

export interface PostMessagesResponse {
    in: number;
}
