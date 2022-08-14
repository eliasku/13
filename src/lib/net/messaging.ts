import {log, logWarn} from "../debug/log";
import {ControlCode, Message, MessageBody, NetEvent, NodeID, Request, Response} from "../../shared/types";

const serverUrl = "/";
const updateInterval = 1000;
// const updateInterval = 250;
let nodeId: undefined | NodeID = undefined;
let nodes: number[] = [];

let outcomeQueue: Message[] = [];
let waiters: ((msg: Message) => void)[] = [];
let nextCallId = 1;

export function call(to: NodeID, data: MessageBody): Promise<MessageBody> {
    log(`call to ${to} type ${data.type}`);
    return new Promise((resolve, reject) => {
        const call = nextCallId++;
        waiters[call] = (res) => {
            waiters[call] = undefined;
            log(`received result from ${to} : ${JSON.stringify(res.data)}`);
            resolve(res.data);
        };
        outcomeQueue.push({
            call,
            from: nodeId,
            to,
            data
        });
    });
}

export function sendWithoutResponse(to: NodeID, data: MessageBody): void {
    log(`send to ${to} type ${data.type}`);
    outcomeQueue.push({
        from: nodeId,
        to,
        data
    });
}

type Handler = (req: Message) => Promise<MessageBody> | MessageBody | void;

const handlers: Record<string, Handler> = {};

export function setHandler(type: string, handler: Handler) {
    handlers[type] = handler;
}

function respond(req: Message, data: MessageBody) {
    const response: Message = {
        call: req.call!,
        from: nodeId,
        to: req.from,
        data
    };
    outcomeQueue.push(response);
}

let onNodeRemoved: (id: NodeID) => void = () => {
};

export function setOnNodeRemoved(callback: (id: NodeID) => void) {
    onNodeRemoved = callback;
}

function requestHandler(req: Message) {
    if (req.data.event !== undefined) {
        log(`${req.data.event} ${req.from}`);
        if (req.data.event === NetEvent.NodeAdded) {
            nodes[req.from] = req.from;
        } else if (req.data.event === NetEvent.NodeRemoved) {
            onNodeRemoved(req.from);
            delete nodes[req.from];
        }
        return;
    }
    if (req.data.type !== undefined) {
        const handler = handlers[req.data.type];
        if (handler) {
            const result = handler(req);
            if (typeof result !== undefined) {
                if (result instanceof Promise) {
                    result.then((resultMessage) => respond(req, resultMessage));
                } else if (typeof result === "object") {
                    respond(req, result);
                }
            }
        }
    }
}

let connecting = false;
let running = false;

async function process(): Promise<number> {
    if (!running) {
        return 0;
    }

    try {
        const data: Response = await _post({
            from: nodeId!,
            messages: outcomeQueue.length > 0 ? outcomeQueue : undefined
        });
        outcomeQueue = outcomeQueue.slice(data.in);
        if (data.responses) {
            for (const response of data.responses) {
                const waiter = response.call ? waiters[response.call] : undefined;
                if (waiter) {
                    waiter(response);
                } else {
                    requestHandler(response);
                }
            }
        }
    } catch (e) {
        console.warn("http-messaging error", e);
        return -1;
    }
    setTimeout(process, updateInterval);
    return 1;
}

async function _post(req: Request): Promise<Response> {
    const body = JSON.stringify(req);
    const response = await fetch(serverUrl, {
        method: "POST",
        body
    });
    return await response.json() as Response;
}

function _sendBeacon(req: Request): boolean {
    return navigator.sendBeacon(serverUrl, JSON.stringify(req));
}

export async function connect() {
    if (!running && !connecting) {
        connecting = true;
        const res = await _post({from: nodeId, control: ControlCode.Connect});
        if (res.responses) {
            nodeId = res.to;
            for (const resp of res.responses) {
                nodes[resp.from] = resp.from;
            }
        }
        connecting = false;
        running = true;
        await process();
    }
}

export function disconnect() {
    if (running) {
        running = false;
        if (!_sendBeacon({
            from: nodeId,
            control: ControlCode.Close,
        })) {
            logWarn("close error");
        }
        outcomeQueue = [];
        waiters = [];
        nodes = [];
        nodeId = undefined;
    } else if (connecting) {
        logWarn("currently connecting");
    }
}

export function getLocalNode(): NodeID {
    return nodeId;
}

export function getRemoteNodes(): NodeID[] {
    return nodes.filter(x => x !== undefined);
}
