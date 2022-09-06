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
export let clientId: 0 | ClientID = 0;
let username: string = localStorage.getItem("name");
let messagesToPost: Message[] = [];
let messageUploading = false;
let nextCallId = 1;
const callbacks: ((msg: Message) => void)[] = [];

export const setUserName = (name: string) => {
    localStorage.setItem("name", name);
    username = name;
}

export const getUserName = () => username;

export const remoteCall = (to: ClientID, type: MessageType, data: MessageData): Promise<MessageData> =>
    new Promise((resolve, reject) => {
        const call = nextCallId++;
        callbacks[call] = (res) => {
            callbacks[call] = undefined;
            resolve(res[MessageField.Data]);
        };
        messagesToPost.push([clientId, to, type, call, data]);
    });

export const remoteSend = (to: ClientID, type: MessageType, data: MessageData): number =>
    messagesToPost.push([clientId, to, type, 0, data]);

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

const requestHandler = (req: Message) =>
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

const _post = async (req: Request): Promise<PostMessagesResponse> => {
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

const initSSE = (): Promise<void> =>
    new Promise((resolve, _) => {
        waitForConnectedEvent = resolve;
        eventSource = new EventSource(/*EventSourceUrl*/ "_");
        eventSource.onerror = (e) => {
            console.warn("server-event error");
            termSSE();
        };
        eventSource.onmessage = (e) => onSSE[(e.data[0] as any) | 0](e.data.substring(1));
    });

const termSSE = () => {
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

export const connect = async () => {
    if (!_sseState) {
        _sseState = 1;
        await initSSE();
        _sseState = 2;
    }
}

export const disconnect = () => {
    if (_sseState > 1) {
        termSSE();
        messagesToPost.length = 0;
        callbacks.length = 0;
        for (const [id] of remoteClients) {
            closePeerConnection(id);
        }
        clientId = 0;
    } else if (_sseState == 1) {
        console.warn("currently connecting");
    }
    _sseState = 0;
}

// RTC

const sendOffer = async (remoteClient: RemoteClient, iceRestart?: boolean, negotiation?: boolean) => {
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

const initPeerConnection = (remoteClient: RemoteClient) => {
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

export const closePeerConnection = (id: ClientID) => {
    const rc = remoteClients.get(id);
    rc?.dc_?.close();
    rc?.pc_?.close();
    remoteClients.delete(id);
}

export const connectToRemote = async (id: ClientID) => {
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

const setupDataChannel = (id: ClientID, channel: RTCDataChannel) => {
    channel.binaryType = "arraybuffer";
    // TODO: debug
    // channel.onopen = () => console.log("data channel opened");
    // channel.onerror = (e) => console.warn("data channel error", e);
    channel.onmessage = (msg) => channels_processMessage(id, msg);
}

const requireRemoteClient = (id_: ClientID): RemoteClient => {
    let rc = remoteClients.get(id_);
    if (!rc) {
        //console.warn(`WARNING: required remote client ${id_} not found and created`);
        rc = {id_};
        remoteClients.set(id_, rc);
    }
    return rc;
}

export const isPeerConnected = (rc?: RemoteClient): boolean =>
    rc?.dc_?.readyState[0] == "o" && rc?.pc_.iceConnectionState[1] == "o";