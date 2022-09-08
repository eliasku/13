import {ClientID, Message, MessageData, MessageField, MessageType, PostMessagesResponse} from "../../shared/types";
import {channels_processMessage} from "./channels";

export interface RemoteClient {
    id_: ClientID;
    pc_?: RTCPeerConnection;
    dc_?: RTCDataChannel;
    name_?: string;
    debugPacketByteLength?: number;
}

export let _sseState = 0;
export const remoteClients = new Map<ClientID, RemoteClient>();
let eventSource: EventSource | null = null;
export let clientId: 0 | ClientID = 0;
let username: string = localStorage.getItem("name");
let messagesToPost: Message[] = [];
let messageUploading = false;
let nextCallId = 1;
let callbacks: ((msg: Message) => void)[] = [];

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

export const disconnect = () => {
    if (eventSource) {
        console.log("terminate SSE");
        // eventSource.onerror = null;
        // eventSource.onmessage = null;
        eventSource.close();
        eventSource = null;
    }
    remoteClients.forEach(closePeerConnection);
    clientId = 0;
    _sseState = 0;
}

const handlers: Handler[] = [
    // 0
    ,
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
    (req, _rc?: RemoteClient): void => {
        if (req[MessageField.Data].candidate) {
            _rc = requireRemoteClient(req[MessageField.Source]);
            if (!_rc.pc_) {
                initPeerConnection(_rc);
            }
            _rc.pc_.addIceCandidate(new RTCIceCandidate(req[MessageField.Data]))
                .catch(error => console.warn("ice candidate set failed: " + error.message));
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

setInterval(() => {
    if (_sseState > 1 && !messageUploading && messagesToPost.length) {
        messageUploading = true;
        _post(messagesToPost).then(response => {
            messagesToPost = messagesToPost.slice(response);
            messageUploading = false;
        }).catch(disconnect);
    }
}, 100);

const _post = (messages: Message[]): Promise<PostMessagesResponse> =>
    fetch(/*EventSourceUrl*/"_", {
        method: "POST",
        body: JSON.stringify([clientId, messages])
    }).then(response => response.json() as Promise<PostMessagesResponse>);

const onSSE: ((data: string) => void)[] = [
    // CLOSE
    disconnect as ((data: string) => void),
    // PING
    () => _post([]).catch(disconnect),
    // INIT
    (data: string, _ids?: number[]) => {
        // console.info("[SSE] got init " + data);
        // console.info("[SSE] got init " + data.split(";"));
        _ids = data.split(";").map(Number);
        clientId = _ids.shift();
        _ids.map(id => {
            console.info(`remote client ${id} observed`);
            requireRemoteClient(id);
            remoteSend(id, MessageType.Name, username);
        });
        _sseState = 2;
    },
    // UPDATE
    (data: string, _message?: Message) => {
        _message = JSON.parse(data);
        (callbacks[_message[MessageField.Call]] || requestHandler)(_message);
    },
    // LIST CHANGE
    (data: string, _id?: number) => {
        _id = +data;
        if (_id > 0) {
            connectToRemote(_id);
            remoteSend(_id, MessageType.Name, username);
            console.info(`remote client ${_id} added`);
        } else {
            closePeerConnection(remoteClients.get(-_id));
            console.info(`remote client ${-_id} removed`);
        }
    }
];

export const connect = () => {
    if (!_sseState) {
        _sseState = 1;
        messageUploading = false;
        messagesToPost = [];
        callbacks = [];
        eventSource = new EventSource(/*EventSourceUrl*/ "_");
        eventSource.onerror = disconnect;
        // eventSource.onerror = (e) => {
        //     console.warn("server-event error");
        //     termSSE();
        // };
        eventSource.onmessage = e => onSSE[(e.data[0] as any) | 0]?.(e.data.substring(1));
    }
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

const initPeerConnection = (remoteClient: RemoteClient, _pc?: RTCPeerConnection) => {
    remoteClient.pc_ = _pc =
        new RTCPeerConnection({iceServers: [{urls: 'stun:stun.l.google.com:19302'}]});
    _pc.onicecandidate = (e) => {
        if (e.candidate) {
            remoteSend(remoteClient.id_, MessageType.RtcCandidate, e.candidate.toJSON());
        }
    };

    _pc.onnegotiationneeded = () => {
        console.log("negotiation needed");
        sendOffer(remoteClient, false);
    };

    _pc.ondatachannel = (e) => {
        console.log("received data-channel on Slave");
        remoteClient.dc_ = e.channel;
        if (e.channel) {
            setupDataChannel(remoteClient.id_, e.channel);
        }
    };

    // TODO: debug
    // pc.onicecandidateerror = (e: RTCPeerConnectionIceErrorEvent) => {
    //     console.warn("ice candidate error: " + e.errorText);
    // };
}

export const closePeerConnection = (rc?: RemoteClient) => {
    if (remoteClients.delete(rc?.id_)) {
        rc.dc_?.close();
        rc.pc_?.close();
    }
}

export const connectToRemote = async (id: ClientID) => {
    const rc = requireRemoteClient(id);
    initPeerConnection(rc);
    rc.pc_.oniceconnectionstatechange = e => {
        if ("fd".indexOf(rc.pc_?.iceConnectionState[0]) >= 0) {
            sendOffer(rc, true);
        }
    };
    await sendOffer(rc);

    rc.dc_ = rc.pc_.createDataChannel("", {ordered: false, maxRetransmits: 0});
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
    if (!remoteClients.has(id_)) {
        remoteClients.set(id_, {id_});
    }
    return remoteClients.get(id_);
}

export const isPeerConnected = (rc?: RemoteClient): boolean =>
    rc?.dc_?.readyState[0] == "o" && rc?.pc_.iceConnectionState[1] == "o";