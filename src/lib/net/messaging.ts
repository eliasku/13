import {log, logAssert, logWarn} from "../debug/log";
import {Message, MessageBody, ClientID, PostMessagesResponse, Request, ServerEventName} from "../../shared/types";

const serverUrl = "/_";

interface RemoteClient {
    id: ClientID;
    pc?: RTCPeerConnection;
    dc?: RTCDataChannel;
}

let clientId: undefined | ClientID = undefined;
let remoteClients: RemoteClient[] = [];

let messagesToPost: Message[] = [];
let callbacks: ((msg: Message) => void)[] = [];
let nextCallId = 1;
let eventSource: EventSource | null = null;

export function remoteCall(to: ClientID, data: MessageBody): Promise<MessageBody> {
    log(`call to ${to} type ${data.type}`);
    return new Promise((resolve, reject) => {
        const call = nextCallId++;
        callbacks[call] = (res) => {
            callbacks[call] = undefined;
            log(`received result from ${to} : ${JSON.stringify(res.data)}`);
            resolve(res.data);
        };
        messagesToPost.push({
            call,
            from: clientId,
            to,
            data
        });
    });
}

export function remoteSend(to: ClientID, data: MessageBody): void {
    log(`send to ${to} type ${data.type}`);
    messagesToPost.push({
        from: clientId,
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
        from: clientId,
        to: req.from,
        data
    };
    messagesToPost.push(response);
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
let lastPostTime = 0;

const processLoop = () => {
    if (running && !messageUploading) {
        if (messagesToPost.length > 0) {
            process();
        } else if (performance.now() - lastPostTime >= 10000) {
            // ping
            lastPostTime = performance.now();
            _post({from: clientId!});
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
            from: clientId!,
            messages: messagesToPost.length > 0 ? messagesToPost : undefined
        });
        messagesToPost = messagesToPost.slice(data.in);
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

let waitForConnectedEvent: () => void | null = null;

function onSSEClientAdd(e: MessageEvent<string>) {
    const id = Number.parseInt(e.data);
    logAssert(!Number.isNaN(id));
    logAssert(!remoteClients[id]);
    remoteClients[id] = {id};
    log(`remote client ${id} added`);
}

function onSSEClientRemove(e: MessageEvent<string>) {
    const id = Number.parseInt(e.data);
    logAssert(!Number.isNaN(id));
    const remoteClient = remoteClients[id];
    if(remoteClient) {
        closePeerConnection(remoteClient);
    }
    remoteClients[id] = undefined;
    log(`remote client ${id} removed`);
}

function onSSEUpdate(e: MessageEvent<string>) {
    const message = JSON.parse(e.data) as Message;
    const waiter = message.call ? callbacks[message.call] : undefined;
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
        eventSource = new EventSource(serverUrl);
        eventSource.addEventListener("error", onSSEError);
        eventSource.addEventListener(ServerEventName.ClientConnected, (e: MessageEvent<string>) => {
            const ids = e.data.split(";").map(x => Number.parseInt(x));
            clientId = ids[0];
            for (let i = 1; i < ids.length; ++i) {
                remoteClients[ids[i]] = {id: ids[i]};
            }
            waitForConnectedEvent();
            eventSource.addEventListener(ServerEventName.ClientUpdate, onSSEUpdate);
            eventSource.addEventListener("message", onSSEMessage);
            eventSource.addEventListener(ServerEventName.ClientAdd, onSSEClientAdd);
            eventSource.addEventListener(ServerEventName.ClientRemove, onSSEClientRemove);
        }, {once: true});
    });
}

function termSSE() {
    if (eventSource) {
        log("terminate SSE");
        eventSource.removeEventListener("error", onSSEError);
        eventSource.removeEventListener(ServerEventName.ClientUpdate, onSSEUpdate);
        eventSource.removeEventListener("message", onSSEMessage);
        eventSource.removeEventListener(ServerEventName.ClientAdd, onSSEClientAdd);
        eventSource.removeEventListener(ServerEventName.ClientRemove, onSSEClientRemove);
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
        await connectToRemotes();
    }
}

export function disconnect() {
    if (running) {
        running = false;
        const rcs = getRemoteClients();
        for(let i = 0; i < rcs.length; ++i) {
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

type RTMessageHandler = (from: ClientID, data: any) => void;
let onRTMessage: RTMessageHandler = () => {
};

export function setRTMessageHandler(handler: RTMessageHandler) {
    onRTMessage = handler;
}

async function sendOffer(remoteClient: RemoteClient) {
    try {
        const pc = remoteClient.pc;
        const offer = await pc.createOffer({
            offerToReceiveAudio: false,
            offerToReceiveVideo: false
        });
        await pc.setLocalDescription(offer);
        const result = await remoteCall(remoteClient.id, {type: "rtc_offer", offer});
        await pc.setRemoteDescription(new RTCSessionDescription(result.answer));
    } catch (e) {
        console.warn("Couldn't create offer", e);
    }
}

function initPeerConnection(remoteClient: RemoteClient) {
    const id = remoteClient.id;
    const pc = new RTCPeerConnection(rtcConfiguration);
    remoteClient.pc = pc;
    pc.addEventListener("icecandidate", (e) => {
        const candidate = e.candidate;
        if (candidate) {
            remoteSend(id, {type: "rtc_candidate", candidate: candidate.toJSON()});
        }
    });

    pc.addEventListener("negotiationneeded", async () => {
        log("negotiation needed");
        await sendOffer(remoteClient);
    });

    pc.addEventListener("datachannel", (e) => {
        log("received data-channel on Slave");

        const channel = e.channel;
        remoteClient.dc = channel;
        if (channel) {
            log("dc: " + channel.readyState);
            channel.onmessage = (e) => {
                log("receiver message from Slave: " + e.data);
                onRTMessage(id, JSON.parse(e.data));
            };
        }
    });

    pc.addEventListener("icecandidateerror", (e: RTCPeerConnectionIceErrorEvent) => {
        log("ice candidate error: " + e.errorText);
    });
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
    await sendOffer(rc);

    rc.dc = rc.pc.createDataChannel("Source");
    log("dc: " + rc.dc.readyState);
    rc.dc.addEventListener("open", () => {
        log("data channel opened");
    });
    rc.dc.addEventListener("message", (e) => {
        log("received message on Master: " + e.data);
        onRTMessage(rc.id, JSON.parse(e.data));
    });
}

export function connectToRemotes():Promise<any> {
    return Promise.all(remoteClients.map(connectToRemote));
}

function requireRemoteClient(id:ClientID):RemoteClient {
    let rc = remoteClients[id];
    if (!rc) {
        logWarn(`WARNING: required remote client ${id} not found and created`);
        remoteClients[id] = rc = {id};
    }
    return rc;
}

handlers["rtc_offer"] = async (req) => {
    const remoteClient = requireRemoteClient(req.from);
    if (!remoteClient.pc) {
        initPeerConnection(remoteClient);
    }
    await remoteClient.pc.setRemoteDescription(req.data.offer);
    const answer = await remoteClient.pc.createAnswer();
    await remoteClient.pc.setLocalDescription(answer);
    return {answer};
};

handlers["rtc_candidate"] = async (req) => {
    if (req.data.candidate) {
        try {
            const rc = requireRemoteClient(req.from);
            if (!rc.pc) {
                initPeerConnection(rc);
            }
            await rc.pc.addIceCandidate(new RTCIceCandidate(req.data.candidate));
        } catch (e: any) {
            log("ice candidate set failed: " + e.message);
        }
    }
    return undefined;
};
