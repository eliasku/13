import {log, logAssert, logWarn} from "../debug/log";
import {
    ClientID,
    EventSourceUrl,
    Message,
    MessageData,
    MessageType,
    PostMessagesResponse,
    Request,
    ServerEventName
} from "../../shared/types";
import {channels_processMessage} from "./channels";

export interface RemoteClient {
    id: ClientID;
    pc?: RTCPeerConnection;
    dc?: RTCDataChannel;
    B?: number;
}

let clientId: undefined | ClientID = undefined;
let remoteClients: RemoteClient[] = [];

let messagesToPost: Message[] = [];
let callbacks: ((msg: Message) => void)[] = [];
let nextCallId = 1;
let eventSource: EventSource | null = null;

export function remoteCall(to: ClientID, type: MessageType, data: MessageData): Promise<MessageData> {
    log(`call to ${to} type ${type}`);
    return new Promise((resolve, reject) => {
        const call = nextCallId++;
        callbacks[call] = (res) => {
            callbacks[call] = undefined;
            resolve(res.a);
        };
        messagesToPost.push({
            c: call,
            s: clientId,
            d: to,
            a: data,
            t: type,
        });
    });
}

export function remoteSend(to: ClientID, type: MessageType, data: MessageData): void {
    log(`send to ${to} type ${type}`);
    messagesToPost.push({
        s: clientId,
        d: to,
        a: data,
        t: type,
    });
}

type Handler = (req: Message) => Promise<MessageData | undefined> | MessageData | undefined;

const handlers: Record<number, Handler> = [];

function respond(req: Message, data: MessageData) {
    messagesToPost.push({
        s: clientId,
        d: req.s,
        t: req.t,
        c: req.c!,
        a: data
    });
}

function requestHandler(req: Message) {
    if (req.t) {
        const handler = handlers[req.t];
        if (handler) {
            const result = handler(req);
            if (req.c) {
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
let lastPostTime = 0;

const processLoop = () => {
    if (running && !messageUploading) {
        if (messagesToPost.length) {
            process();
        } else if (performance.now() - lastPostTime >= 10000) {
            // ping
            lastPostTime = performance.now();
            _post({s: clientId!});
        }
    }
};

setInterval(processLoop, 133);

async function process(): Promise<void> {
    if (!running || !messagesToPost.length) {
        return;
    }

    messageUploading = true;
    try {
        const data: PostMessagesResponse = await _post({
            s: clientId!,
            a: messagesToPost.length > 0 ? messagesToPost : undefined
        });
        messagesToPost = messagesToPost.slice(data.a);
    } catch (e) {
        console.warn("http-messaging error", e);
    }
    messageUploading = false;
}

async function _post(req: Request): Promise<PostMessagesResponse> {
    const body = JSON.stringify(req);
    const response = await fetch(EventSourceUrl, {
        method: "POST",
        body
    });
    if (!response.ok) {
        disconnect();
    }
    return await response.json() as PostMessagesResponse;
}

let waitForConnectedEvent: () => void | null = null;

function onSSEClientAdd(e: MessageEvent<string>) {
    const id = Number.parseInt(e.data);
    logAssert(!Number.isNaN(id));
    logAssert(!remoteClients[id]);
    const rc: RemoteClient = {id};
    remoteClients[id] = rc;
    connectToRemote(rc);
    log(`remote client ${id} added`);
}

function onSSEClientRemove(e: MessageEvent<string>) {
    const id = Number.parseInt(e.data);
    logAssert(!Number.isNaN(id));
    const remoteClient = remoteClients[id];
    if (remoteClient) {
        closePeerConnection(remoteClient);
    }
    remoteClients[id] = undefined;
    log(`remote client ${id} removed`);
}

function onSSEUpdate(e: MessageEvent<string>) {
    const message = JSON.parse(e.data) as Message;
    const waiter = message.c ? callbacks[message.c] : undefined;
    if (waiter) {
        waiter(message);
    } else {
        requestHandler(message);
    }
}

function initSSE(): Promise<void> {
    log("initialize SSE");
    return new Promise((resolve, _) => {
        waitForConnectedEvent = resolve;
        eventSource = new EventSource(EventSourceUrl);
        eventSource.onerror = onSSEError;
        eventSource.addEventListener(ServerEventName.ClientConnected, (e: MessageEvent<string>) => {
            const ids = e.data.split(";").map(x => Number.parseInt(x));
            clientId = ids.shift();
            for (const id of ids) {
                remoteClients[id] = {id};
            }
            waitForConnectedEvent();
            eventSource.onmessage = onSSEMessage;
            eventSource.addEventListener(ServerEventName.ClientUpdate, onSSEUpdate);
            eventSource.addEventListener(ServerEventName.ClientAdd, onSSEClientAdd);
            eventSource.addEventListener(ServerEventName.ClientRemove, onSSEClientRemove);
        }, {once: true});
    });
}

function termSSE() {
    if (eventSource) {
        log("terminate SSE");
        eventSource.onerror = null;
        eventSource.onmessage = null;
        eventSource.removeEventListener(ServerEventName.ClientUpdate, onSSEUpdate);
        eventSource.removeEventListener(ServerEventName.ClientAdd, onSSEClientAdd);
        eventSource.removeEventListener(ServerEventName.ClientRemove, onSSEClientRemove);
        eventSource.close();
        eventSource = null;
        waitForConnectedEvent = null;
    }
}

function onSSEMessage(e: MessageEvent<string>) {
    if (e.lastEventId === "-1") {
        termSSE();
    }
}

function onSSEError(e: Event) {
    log("server-event error");
    termSSE();
}

export async function connect() {
    if (running || connecting) return;
    connecting = true;
    //await debugSleep(100);
    await initSSE();
    //await debugSleep(100);
    connecting = false;
    running = true;
}

export function disconnect() {
    if (running) {
        running = false;
        const rcs = getRemoteClients();
        for (let i = 0; i < rcs.length; ++i) {
            closePeerConnection(rcs[i]);
        }
        termSSE();
        messagesToPost = [];
        callbacks = [];
        remoteClients = [];
        clientId = undefined;
    } else if (connecting) {
        logWarn("currently connecting");
    }
}

export function getClientId(): ClientID {
    return clientId;
}

export function getRemoteClients(): RemoteClient[] {
    return remoteClients.filter(x => x !== undefined);
}

export function getRemoteClient(id: ClientID): RemoteClient | undefined {
    return remoteClients[id];
}

// RTC

const rtcConfiguration: RTCConfiguration = {
    iceServers: [
        // {urls: 'stun:23.21.150.121'},
        // {urls: 'stun:stun.l.google.com:19302?transport=udp'},
        {urls: 'stun:stun.l.google.com:19302'},
        // {
        //     urls: [
        //         "stun:stun.l.google.com:19302",
        //         "stun:stun1.l.google.com:19302",
        //         "stun:stun2.l.google.com:19302",
        //         "stun:stun3.l.google.com:19302",
        // "stun:stun4.l.google.com:19302",
        // ]
        // },
    ],
};

async function sendOffer(remoteClient: RemoteClient, iceRestart?: boolean, negotiation?: boolean) {
    try {
        const pc = remoteClient.pc;
        const offer = await pc.createOffer({iceRestart});
        await pc.setLocalDescription(offer);
        const result = await remoteCall(remoteClient.id, MessageType.RtcOffer, offer);
        if (result) {
            await pc.setRemoteDescription(new RTCSessionDescription(result));
        }
    } catch (e) {
        logWarn("Couldn't create offer");
    }
}

function initPeerConnection(remoteClient: RemoteClient) {
    const id = remoteClient.id;
    const pc = new RTCPeerConnection(rtcConfiguration);
    remoteClient.pc = pc;
    pc.onicecandidate = (e) => {
        const candidate = e.candidate;
        if (candidate) {
            remoteSend(id, MessageType.RtcCandidate, candidate.toJSON());
        }
    };

    pc.onnegotiationneeded = async () => {
        log("negotiation needed");
        await sendOffer(remoteClient, false);
    };

    pc.ondatachannel = (e) => {
        log("received data-channel on Slave");

        const channel = e.channel;
        remoteClient.dc = channel;
        if (channel) {
            channel.binaryType = "arraybuffer";
            channel.onmessage = (msg) => channels_processMessage(id, msg);
            channel.onerror = () => logWarn("data channel error");
        }
    };

    pc.onicecandidateerror = (e: RTCPeerConnectionIceErrorEvent) => {
        log("ice candidate error: " + e.errorText);
    };
}

function closePeerConnection(toRemoteClient: RemoteClient) {
    if (toRemoteClient.pc) {
        if (toRemoteClient.dc) {
            toRemoteClient.dc.close();
            toRemoteClient.dc = undefined;
        }
        toRemoteClient.pc.close();
        toRemoteClient.pc = undefined;
    }
}

export async function connectToRemote(rc: RemoteClient) {
    initPeerConnection(rc);
    rc.pc.oniceconnectionstatechange = (e) => {
        if (rc.pc) {
            if (rc.pc.iceConnectionState === "failed") {
                sendOffer(rc, true);
            } else if (rc.pc.iceConnectionState === "disconnected") {
                //disconnect();
            }
        }
    };
    await sendOffer(rc);

    rc.dc = rc.pc.createDataChannel("net", {ordered: false, maxRetransmits: 0});
    rc.dc.binaryType = "arraybuffer";
    rc.dc.onopen = () => log("data channel opened");
    rc.dc.onerror = (e) => console.error("data channel error", e);
    rc.dc.onmessage = (msg) => channels_processMessage(rc.id, msg);
}

// export function connectToRemotes(): Promise<any> {
//     return Promise.all(remoteClients.filter(x => !!x).map(connectToRemote));
// }

function requireRemoteClient(id: ClientID): RemoteClient {
    let rc = remoteClients[id];
    if (!rc) {
        logWarn(`WARNING: required remote client ${id} not found and created`);
        remoteClients[id] = rc = {id};
    }
    return rc;
}

handlers[MessageType.RtcOffer] = async (req) => {
    const remoteClient = requireRemoteClient(req.s);
    if (!remoteClient.pc) {
        initPeerConnection(remoteClient);
    }
    try {
        await remoteClient.pc.setRemoteDescription(req.a);
    } catch (err) {
        logWarn("setRemoteDescription error");
        //console.error(err);
        return null;
    }
    const answer = await remoteClient.pc.createAnswer();
    await remoteClient.pc.setLocalDescription(answer);
    return answer;
};

handlers[MessageType.RtcCandidate] = async (req) => {
    if (req.a.candidate) {
        try {
            const rc = requireRemoteClient(req.s);
            if (!rc.pc) {
                initPeerConnection(rc);
            }
            await rc.pc.addIceCandidate(new RTCIceCandidate(req.a));
        } catch (error: any) {
            log("ice candidate set failed: " + error.message);
        }
    }
    return undefined;
};
