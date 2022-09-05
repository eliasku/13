import {
    ClientID,
    Message,
    MessageData,
    MessageField,
    MessageType,
    PostMessagesResponse,
    Request
} from "../../shared/types";
import {channels_processMessage} from "./channels";

export interface RemoteClient {
    id_: ClientID;
    pc_?: RTCPeerConnection;
    dc_?: RTCDataChannel;
    name_?: string;
    debugPacketByteLength_?: number;
}

export let _sseState = 0;
export const remoteClients = new Map<ClientID, RemoteClient>();
let eventSource: EventSource | null = null;
let clientId: undefined | ClientID = undefined;
let username: string = localStorage.getItem("name");
let messagesToPost: Message[] = [];
let messageUploading = false;
let nextCallId = 1;
const callbacks: ((msg: Message) => void)[] = [];

export function setUserName(name: string) {
    localStorage.setItem("name", name);
    username = name;
}

export function getUserName() {
    return username;
}

export function remoteCall(to: ClientID, type: MessageType, data: MessageData): Promise<MessageData> {
    console.log(`call to ${to} type ${type}`);
    return new Promise((resolve, reject) => {
        const call = nextCallId++;
        callbacks[call] = (res) => {
            callbacks[call] = undefined;
            resolve(res[MessageField.Data]);
        };
        messagesToPost.push([clientId, to, type, call, data]);
    });
}

export function remoteSend(to: ClientID, type: MessageType, data: MessageData): void {
    console.log(`send to ${to} type ${type}`);
    messagesToPost.push([clientId, to, type, 0, data]);
}

type Handler = ((req: Message) => Promise<MessageData>) |
    ((req: Message) => void);

const handlers: Handler[] = [
    // 0
    (req: Message): void => {
    },
    // MessageType.RtcOffer
    async (req): Promise<RTCSessionDescriptionInit> => {
        const remoteClient = requireRemoteClient(req[MessageField.Source]);
        if (!remoteClient.pc_) {
            initPeerConnection(remoteClient);
        }
        try {
            await remoteClient.pc_.setRemoteDescription(req[MessageField.Data]);
        } catch (err) {
            console.warn("setRemoteDescription error");
            return;
        }
        const answer = await remoteClient.pc_.createAnswer();
        await remoteClient.pc_.setLocalDescription(answer);
        return answer;
    },
    // MessageType.RtcCandidate
    (req): void => {
        if (req[MessageField.Data].candidate) {
            try {
                const rc = requireRemoteClient(req[MessageField.Source]);
                if (!rc.pc_) {
                    initPeerConnection(rc);
                }
                rc.pc_.addIceCandidate(new RTCIceCandidate(req[MessageField.Data]));
            } catch (error: any) {
                console.warn("ice candidate set failed: " + error.message);
            }
        }
    },
    // MessageType.Name
    (req): void => {
        requireRemoteClient(req[MessageField.Source]).name_ = req[MessageField.Data];
    }
];

function requestHandler(req: Message) {
    (handlers[req[MessageField.Type]](req) as undefined | Promise<MessageData>)?.then(
        // respond to remote client if we have result in call handler
        (data) => messagesToPost.push([
            clientId,
            req[MessageField.Source],
            req[MessageField.Type],
            req[MessageField.Call],
            data
        ])
    );
}

setInterval(async () => {
    if (_sseState > 1 && !messageUploading && messagesToPost.length) {
        messageUploading = true;
        try {
            const data: PostMessagesResponse = await _post([
                clientId!,
                messagesToPost
            ]);
            messagesToPost = messagesToPost.slice(data);
        } catch (e) {
            console.warn("http-messaging error", e);
        }
        messageUploading = false;
    }
}, 100);

async function _post(req: Request): Promise<PostMessagesResponse> {
    const response = await fetch(/*EventSourceUrl*/"_", {
        method: "POST",
        body: JSON.stringify(req)
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
        eventSource = new EventSource(/*EventSourceUrl*/ "_");
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
    () => _post([clientId!, []]),
    // INIT
    (data: string) => {
        console.info("[SSE] got init " + data);
        console.info("[SSE] got init " + data.split(";"));
        const ids = data.split(";").map(Number);
        clientId = ids.shift();
        for (const id of ids) {
            console.info(`remote client ${id} observed`);
            requireRemoteClient(id);
            remoteSend(id, MessageType.Name, username);
        }
        waitForConnectedEvent();
    },
    // UPDATE
    (data: string) => {
        const message = JSON.parse(data) as Message;
        const waiter = callbacks[message[MessageField.Call]];
        if (waiter) {
            waiter(message);
        } else {
            requestHandler(message);
        }
    },
    // LIST CHANGE
    (data: string) => {
        const id = +data;
        if (id > 0) {
            connectToRemote(id);
            remoteSend(id, MessageType.Name, username);
            console.info(`remote client ${id} added`);
        } else {
            closePeerConnection(-id);
            console.info(`remote client ${-id} removed`);
        }
    }
];

export async function connect() {
    if (!_sseState) {
        _sseState = 1;
        await initSSE();
        _sseState = 2;
    }
}

export function disconnect() {
    if (_sseState > 1) {
        termSSE();
        messagesToPost.length = 0;
        callbacks.length = 0;
        for (const [id] of remoteClients) {
            closePeerConnection(id);
        }
        clientId = undefined;
    } else if (_sseState == 1) {
        console.warn("currently connecting");
    }
    _sseState = 0;
}

export function getClientId(): ClientID {
    return clientId;
}

// RTC

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
    const pc = new RTCPeerConnection({iceServers: [{urls: 'stun:stun.l.google.com:19302'}]});
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

    // TODO: debug
    // pc.onicecandidateerror = (e: RTCPeerConnectionIceErrorEvent) => {
    //     console.warn("ice candidate error: " + e.errorText);
    // };
}

export function closePeerConnection(id: ClientID) {
    const rc = remoteClients.get(id);
    rc?.dc_?.close();
    rc?.pc_?.close();
    remoteClients.delete(id);
}

export async function connectToRemote(id: ClientID) {
    const rc = requireRemoteClient(id);
    initPeerConnection(rc);
    rc.pc_.oniceconnectionstatechange = (e) => {
        if (rc.pc_?.iceConnectionState[0] == "f") {
            sendOffer(rc, true);
            // TODO: debug
        } else if (rc.pc_.iceConnectionState[0] === "d") {
            sendOffer(rc, true);
            // disconnect();
        }
    };
    await sendOffer(rc);

    rc.dc_ = rc.pc_.createDataChannel("net", {ordered: false, maxRetransmits: 0});
    setupDataChannel(rc.id_, rc.dc_);
}

function setupDataChannel(id: ClientID, channel: RTCDataChannel) {
    channel.binaryType = "arraybuffer";
    // TODO: debug
    // channel.onopen = () => console.log("data channel opened");
    // channel.onerror = (e) => console.warn("data channel error", e);
    channel.onmessage = (msg) => channels_processMessage(id, msg);
}

function requireRemoteClient(id_: ClientID): RemoteClient {
    let rc = remoteClients.get(id_);
    if (!rc) {
        //console.warn(`WARNING: required remote client ${id_} not found and created`);
        rc = {id_};
        remoteClients.set(id_, rc);
    }
    return rc;
}

export function isChannelOpen(rc?: RemoteClient): boolean {
    return rc?.dc_?.readyState[0] == "o";
}