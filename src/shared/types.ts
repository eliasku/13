export type NodeID = number;
export type CallID = number;
export type MessageBody = any;

export const enum NetEvent {
    NodeRemoved = 0,
    NodeAdded = 1,
}

export const enum ControlCode {
    Connect = 0,
    Close = 1,
}

export interface Message {
    // call id
    call?: CallID;
    from: NodeID;
    to: NodeID;
    data: MessageBody;
}

export interface Request {
    from: NodeID;
    messages?: Message[];
    control?: ControlCode;
}

export interface Response {
    to: NodeID;
    // number of processed request messages
    in: number;
    responses?: Message[];
}

export interface NodeState {
    id: NodeID;
    // last time client or server communicates with node
    ts: number;
}