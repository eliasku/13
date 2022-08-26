import {ClientID, Message, MessageData, MessageType, PostMessagesResponse, Request} from "../../shared/types";
import {channels_processMessage} from "./channels";

export interface RemoteClient {
    id_: ClientID;
    pc_?: RTCPeerConnection;
    dc_?: RTCDataChannel;
    name_?: string;
    debugPacketByteLength_?: number;
}

let username: string = localStorage.getItem("name");

export function setUserName(name: string) {
    localStorage.setItem("name", name);
    username = name;
}

export function getUserName() {
    return username;
}

let clientId: undefined | ClientID = undefined;
let remoteClients: RemoteClient[] = [];

let messagesToPost: Message[] = [];
let callbacks: ((msg: Message) => void)[] = [];
let nextCallId = 1;
let eventSource: EventSource | null = null;

export function remoteCall(to: ClientID, type: MessageType, data: MessageData): Promise<MessageData> {
    console.log(`call to ${to} type ${type}`);
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
    console.log(`send to ${to} type ${type}`);
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
    const response = await fetch(/*EventSourceUrl*/"0", {
        method: "POST",
        body
    });
    if (response.ok) {
        return await response.json() as PostMessagesResponse;
    }
    disconnect();
}

let waitForConnectedEvent: () => void | null = null;

function initSSE(): Promise<void> {
    console.log("initialize SSE");
    return new Promise((resolve, _) => {
        waitForConnectedEvent = resolve;
        eventSource = new EventSource(/*EventSourceUrl*/ "0");
        eventSource.onerror = (e) => {
            console.warn("server-event error");
            termSSE();
        };
        eventSource.onmessage = (e) => onSSE[(e.data[0] as any) | 0](e.data.substring(1));
    });
}

function termSSE() {
    if (eventSource) {
        console.log("terminate SSE");
        eventSource.onerror = null;
        eventSource.onmessage = null;
        eventSource.close();
        eventSource = null;
        waitForConnectedEvent = null;
    }
}

const onSSE: ((data: string) => void)[] = [
    // CLOSE
    termSSE,
    // PING
    () => {
    },
    // INIT
    (data: string) => {
        console.info("[SSE] got init " + data);
        console.info("[SSE] got init " + data.split(";"));
        const ids = data.split(";").map(Number);
        clientId = ids.shift();
        for (const id of ids) {
            console.info(`remote client ${id} observed`);
            remoteClients[id] = {id_: id};
            remoteSend(id, MessageType.Name, username);
        }
        waitForConnectedEvent();
    },
    // UPDATE
    (data: string) => {
        const message = JSON.parse(data) as Message;
        const waiter = message.c ? callbacks[message.c] : undefined;
        if (waiter) {
            waiter(message);
        } else {
            requestHandler(message);
        }
    },
    // LIST CHANGE
    (data: string) => {
        const id = Number.parseInt(data);
        const rc: RemoteClient = id > 0 ? {id_: id} : remoteClients[-id];
        if (id > 0) {
            remoteClients[id] = rc;
            connectToRemote(rc);
            remoteSend(id, MessageType.Name, username);
            console.info(`remote client ${id} added`);
        } else if (rc) {
            closePeerConnection(rc);
            remoteClients[-id] = undefined;
            console.info(`remote client ${-id} removed`);
        }
    }
];

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
        console.warn("currently connecting");
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
        {urls: 'stun:stun.l.google.com:19302'},
    ],
};

async function sendOffer(remoteClient: RemoteClient, iceRestart?: boolean, negotiation?: boolean) {
    try {
        const pc = remoteClient.pc_;
        const offer = await pc.createOffer({iceRestart});
        await pc.setLocalDescription(offer);
        const result = await remoteCall(remoteClient.id_, MessageType.RtcOffer, offer);
        if (result) {
            await pc.setRemoteDescription(new RTCSessionDescription(result));
        }
    } catch (e) {
        console.warn("Couldn't create offer");
    }
}

function initPeerConnection(remoteClient: RemoteClient) {
    const id = remoteClient.id_;
    const pc = new RTCPeerConnection(rtcConfiguration);
    remoteClient.pc_ = pc;
    pc.onicecandidate = (e) => {
        const candidate = e.candidate;
        if (candidate) {
            remoteSend(id, MessageType.RtcCandidate, candidate.toJSON());
        }
    };

    pc.onnegotiationneeded = async () => {
        console.log("negotiation needed");
        await sendOffer(remoteClient, false);
    };

    pc.ondatachannel = (e) => {
        console.log("received data-channel on Slave");
        remoteClient.dc_ = e.channel;
        if (e.channel) {
            setupDataChannel(id, e.channel);
        }
    };

    pc.onicecandidateerror = (e: RTCPeerConnectionIceErrorEvent) => {
        console.warn("ice candidate error: " + e.errorText);
    };
}

function closePeerConnection(toRemoteClient: RemoteClient) {
    if (toRemoteClient.pc_) {
        if (toRemoteClient.dc_) {
            toRemoteClient.dc_.close();
            toRemoteClient.dc_ = undefined;
        }
        toRemoteClient.pc_.close();
        toRemoteClient.pc_ = undefined;
    }
}

export async function connectToRemote(rc: RemoteClient) {
    initPeerConnection(rc);
    rc.pc_.oniceconnectionstatechange = (e) => {
        if (rc.pc_) {
            if (rc.pc_.iceConnectionState === "failed") {
                sendOffer(rc, true);
            } else if (rc.pc_.iceConnectionState === "disconnected") {
                //disconnect();
            }
        }
    };
    await sendOffer(rc);

    rc.dc_ = rc.pc_.createDataChannel("net", {ordered: false, maxRetransmits: 0});
    setupDataChannel(rc.id_, rc.dc_);
}

function setupDataChannel(id: ClientID, channel: RTCDataChannel) {
    channel.binaryType = "arraybuffer";
    channel.onopen = () => console.log("data channel opened");
    channel.onerror = (e) => console.warn("data channel error", e);
    channel.onmessage = (msg) => channels_processMessage(id, msg);
}

function requireRemoteClient(id: ClientID): RemoteClient {
    let rc = remoteClients[id];
    if (!rc) {
        console.warn(`WARNING: required remote client ${id} not found and created`);
        remoteClients[id] = rc = {id_: id};
    }
    return rc;
}

handlers[MessageType.RtcOffer] = async (req) => {
    const remoteClient = requireRemoteClient(req.s);
    if (!remoteClient.pc_) {
        initPeerConnection(remoteClient);
    }
    try {
        await remoteClient.pc_.setRemoteDescription(req.a);
    } catch (err) {
        console.warn("setRemoteDescription error");
        return null;
    }
    const answer = await remoteClient.pc_.createAnswer();
    await remoteClient.pc_.setLocalDescription(answer);
    return answer;
};

handlers[MessageType.RtcCandidate] = async (req) => {
    if (req.a.candidate) {
        try {
            const rc = requireRemoteClient(req.s);
            if (!rc.pc_) {
                initPeerConnection(rc);
            }
            await rc.pc_.addIceCandidate(new RTCIceCandidate(req.a));
        } catch (error: any) {
            console.warn("ice candidate set failed: " + error.message);
        }
    }
};

handlers[MessageType.Name] = (req) => requireRemoteClient(req.s).name_ = req.a;