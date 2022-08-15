export type NodeID = number;
export type CallID = number;
export type MessageBody = any;

export const enum ServerEventName {
    ClientConnected = "connected",
    ClientAdd = "client_add",
    ClientRemove = "client_remove",
}

export interface Message {
    // call id
    call?: CallID;
    from: NodeID;
    to: NodeID;
    data: MessageBody;
}

export interface Request {
    from?: NodeID;
    messages?: Message[];
}

export interface PostMessagesResponse {
    in: number;
}
