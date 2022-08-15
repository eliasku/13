import {log, logAssert, logWarn} from "../debug/log";
import {Message, MessageBody, NodeID, PostMessagesResponse, Request} from "../../shared/types";

const serverUrl = "/_";
let nodeId: undefined | NodeID = undefined;
let nodes: number[] = [];

let outcomeQueue: Message[] = [];
let waiters: ((msg: Message) => void)[] = [];
let nextCallId = 1;
let eventSource: EventSource | null = null;

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

type Handler = (req: Message) => Promise<MessageBody | undefined> | MessageBody | undefined;

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
    if (req.data.type !== undefined) {
        const handler = handlers[req.data.type];
        if (handler) {
            const result = handler(req);
            if (req.call) {
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
}

let connecting = false;
let running = false;

let messageUploading = false;

const processLoop = () => {
    if (running && outcomeQueue.length > 0 && !messageUploading) {
        process();
    }
};

setInterval(processLoop, 133);

async function process(): Promise<void> {
    if (!running || !outcomeQueue.length) {
        return;
    }

    messageUploading = true;
    try {
        const data: PostMessagesResponse = await _post({
            from: nodeId!,
            messages: outcomeQueue.length > 0 ? outcomeQueue : undefined
        });
        outcomeQueue = outcomeQueue.slice(data.in);
    } catch (e) {
        console.warn("http-messaging error", e);
    }
    messageUploading = false;
}

async function _post(req: Request): Promise<PostMessagesResponse> {
    const body = JSON.stringify(req);
    const response = await fetch(serverUrl, {
        method: "POST",
        body
    });
    return await response.json() as PostMessagesResponse;
}

// function _sendBeacon(req: Request): boolean {
//     return navigator.sendBeacon(serverUrl, JSON.stringify(req));
// }

let waitForConnectedEvent: () => void | null = null;

function onSSEClientAdd(e: MessageEvent<string>) {
    const id = Number.parseInt(e.data);
    logAssert(!Number.isNaN(id));
    logAssert(!nodes[id]);
    nodes[id] = id;
    log(`node ${id} added`);
}

function onSSEClientRemove(e: MessageEvent<string>) {
    const id = Number.parseInt(e.data);
    logAssert(!Number.isNaN(id));
    logAssert(!!nodes[id]);
    onNodeRemoved(id);
    nodes[id] = undefined;
    log(`node ${id} removed`);
}

function onSSEUpdate(e: MessageEvent<string>) {
    const message = JSON.parse(e.data) as Message;
    const waiter = message.call ? waiters[message.call] : undefined;
    if (waiter) {
        waiter(message);
    } else {
        requestHandler(message);
    }
}

function initSSE(): Promise<void> {
    log("initialize SSE");
    return new Promise((resolve, reject) => {
        waitForConnectedEvent = resolve;
        eventSource = new EventSource(serverUrl);
        eventSource.addEventListener("error", onSSEError);
        eventSource.addEventListener("connected", (e: MessageEvent<string>) => {
            const ids = e.data.split(";").map(x => Number.parseInt(x));
            nodeId = ids[0];
            for (let i = 1; i < ids.length; ++i) {
                nodes[ids[i]] = ids[i];
            }
            waitForConnectedEvent();
            eventSource.addEventListener("update", onSSEUpdate);
            eventSource.addEventListener("message", onSSEMessage);
            eventSource.addEventListener("client_add", onSSEClientAdd);
            eventSource.addEventListener("client_remove", onSSEClientRemove);
        }, {once: true});
    });
}

function termSSE() {
    if (eventSource) {
        log("terminate SSE");
        eventSource.removeEventListener("error", onSSEError);
        eventSource.removeEventListener("update", onSSEUpdate);
        eventSource.removeEventListener("message", onSSEMessage);
        eventSource.removeEventListener("client_add", onSSEClientAdd);
        eventSource.removeEventListener("client_remove", onSSEClientRemove);
        eventSource.close();
        eventSource = null;
        waitForConnectedEvent = null;
    }
}

function onSSEMessage(e: MessageEvent<string>) {
    console.info("message: " + e.type);
    if (e.lastEventId === "-1") {
        termSSE();
    }
}

function onSSEError(e: Event) {
    log("server-event error: " + e.toString());
    termSSE();
}

export async function connect() {
    if (!running && !connecting) {
        connecting = true;
        await initSSE();
        connecting = false;
        running = true;
    }
}

export function disconnect() {
    if (running) {
        running = false;
        // if (!_sendBeacon({
        //     from: nodeId,
        //     control: ControlCode.Close,
        // })) {
        //     logWarn("close error");
        // }
        termSSE();
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
