import {log, logWarn} from "../debug/log";

type NodeID = string | "_";
type Receiver = NodeID | "*" | undefined;
type Body = any;

const enum NetEvent {
    NodeRemoved = 0,
    NodeAdded = 1,
}

const enum ControlCode {
    Connect = 0,
    Close = 1,
}

interface Message {
    // call id
    call?: string;
    from: NodeID;
    to: Receiver;
    data: any;
}

interface Request {
    from: NodeID;
    messages?: Message[];
    control?: ControlCode;
}

interface Response {
    to: string;
    // number of processed request messages
    in: number;
    responses?: Message[];
}

interface NodeState {
    id: string;
    // last time client or server communicates with node
    ts: number;
}

const serverUrl = "/";
const updateInterval = 1000;
let nodeId: undefined | NodeID = undefined;
let nodes: Record<string, string> = {};

let outcomeQueue: Message[] = [];
let waiters: Record<string, (msg: Message) => void> = {};

function call(to: Receiver, data: Body): Promise<Body> {
    log(`call to ${to} type ${data.type}`);
    return new Promise((resolve, reject) => {
        const call = crypto.randomUUID();
        waiters[call] = (res) => {
            delete waiters[call];
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

function sendWithoutResponse(to: Receiver, data: Body): void {
    log(`send to ${to} type ${data.type}`);
    outcomeQueue.push({
        from: nodeId,
        to,
        data
    });
}

type Handler = (req: Message) => Promise<Body> | Body | void;

const handlers: Record<string, Handler> = {};

function respond(req: Message, data: Body) {
    const response: Message = {
        call: req.call!,
        from: nodeId,
        to: req.from,
        data
    };
    outcomeQueue.push(response);
}

function requestHandler(req: Message) {
    if (req.data.event !== undefined) {
        log(req.data.event, req.from);
        if (req.data.event === NetEvent.NodeAdded) {
            nodes[req.from] = req.from;
        } else if (req.data.event === NetEvent.NodeRemoved) {
            closeConnection(req.from);
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
            from: nodeId,
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

                // rt
                connectToRemote(resp.from);
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
        waiters = {};
        nodes = {};
        nodeId = undefined;
    } else if (connecting) {
        logWarn("currently connecting");
    }
}

export function getLocalNode(): NodeID {
    return nodeId;
}

export function getRemoteNodes(): NodeID[] {
    return Object.keys(nodes);
}


/// WebRTC

const configuration: RTCConfiguration = {
    iceServers: [
        // {urls: 'stun:23.21.150.121'},
        {
            urls: [
                "stun:stun.l.google.com:19302",
                "stun:stun1.l.google.com:19302",
                "stun:stun2.l.google.com:19302",
                "stun:stun3.l.google.com:19302",
                "stun:stun4.l.google.com:19302",
            ]
        },
    ],
};

interface Connection {
    remoteId: NodeID | null;
    pc: RTCPeerConnection;
    channel: RTCDataChannel | null;
}

const connections: Record<string, Connection> = {};
export const peerConnections: Record<string, Connection> = connections;

function createConnection(remoteId: string) {
    const pc = new RTCPeerConnection(configuration);
    const connection: Connection = {
        remoteId,
        pc,
        channel: null,
    };
    connections[remoteId] = connection;
    pc.addEventListener("icecandidate", (e) => {
        const candidate = e.candidate;
        if (candidate) {
            sendWithoutResponse(remoteId, {type: "rtc_candidate", candidate: candidate.toJSON()});
        }
    });

    pc.addEventListener("negotiationneeded", async (e) => {
        log(e);
        try {
            const offer = await pc.createOffer({
                offerToReceiveAudio: false,
                offerToReceiveVideo: false
            });
            await pc.setLocalDescription(offer);
            const result = await call(remoteId, {type: "rtc_offer", offer});
            await pc.setRemoteDescription(result.answer);
        } catch (e) {
            console.warn("Couldn't create offer", e);
        }
    });

    pc.addEventListener("datachannel", (e) => {
        log("received data-channel on Slave");

        const channel = e.channel;
        connections[remoteId].channel = channel;
        if (channel) {
            log("dc: " + channel.readyState);
            channel.send("Slave -> Master");
            channel.onmessage = (e) => {
                log("receiver message from Master: " + e.data);
            };
        }
    });

    pc.addEventListener("icecandidateerror", (e) => {
        log(e);
    });

    return connection;
}

function closeConnection(remoteId: string) {
    const con = connections[remoteId];
    if (con) {
        delete connections[remoteId];
        if (con.channel) {
            con.channel.close();
            con.channel = null;
        }
        con.pc.close();
    }
}

export function connectToRemote(remoteId: string) {
    const connection = createConnection(remoteId);
    connection.channel = connection.pc.createDataChannel("Source");
    log("dc: " + connection.channel.readyState);
    connection.channel.addEventListener("open", (e) => {
        log("data channel opened");
        connection.channel.send(`Hello from ${nodeId} with ${Math.random()}!`);
    });
    connection.channel.addEventListener("message", (e) => {
        log("received message on Master: " + e.data);
    });
}

handlers["rtc_offer"] = async (req) => {
    if (!connections[req.from]) {
        createConnection(req.from);
    }
    const connection = connections[req.from];
    await connection.pc.setRemoteDescription(req.data.offer);
    const answer = await connection.pc.createAnswer();
    await connection.pc.setLocalDescription(answer);
    return {answer};
};

handlers["rtc_candidate"] = async (req) => {
    if (!connections[req.from]) {
        createConnection(req.from);
    }
    const connection = connections[req.from];
    try {
        await connection.pc.addIceCandidate(new RTCIceCandidate(req.data.candidate));
    } catch (e) {
        log("ice candidate set failed");
    }
    return {};
};
