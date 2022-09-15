import {ClientID, Message, MessageData, MessageField, MessageType, PostMessagesResponse} from "../../shared/types";
import {channels_processMessage} from "./channels";
import {rehash} from "../utils/hasher";
import {getOrCreate} from "../utils/utils";

export interface RemoteClient {
    id_: ClientID;
    pc_?: RTCPeerConnection;
    dc_?: RTCDataChannel;
    name_?: string;
    debugPacketByteLength?: number;
}

rehash(RTCPeerConnection.prototype);
rehash(RTCDataChannel.prototype);

export let _sseState = 0;
export const remoteClients = new Map<ClientID, RemoteClient>();
let eventSource: EventSource | null = null;
export let clientId: 0 | ClientID = 0;
export let clientName: string | null = localStorage.getItem("l3name");
let messagesToPost: Message[] = [];
let messageUploading = false;
let nextCallId = 1;
let callbacks: ((msg: Message) => void)[] = [];

export const setUserName = (name: string) =>
    localStorage.setItem("l3name", clientName = name);

const remoteSend = (to: ClientID, type: MessageType, data: MessageData, call = 0): number =>
    messagesToPost.push([clientId, to, type, call, data]);

const remoteCall = (to: ClientID, type: MessageType, data: MessageData, callback: (response: Message) => void): void => {
    callbacks[nextCallId] = callback;
    remoteSend(to, type, data, nextCallId++);
}

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

const handleOffer = (rc: RemoteClient, offer: RTCSessionDescriptionInit) =>
    rc.pc_.setRemoteDescription(offer)
        .then(() => rc.pc_.createAnswer())
        .then(answer => rc.pc_.setLocalDescription(answer))
        .then(() => rc.pc_.localDescription.toJSON())
        .catch(() => console.warn("setRemoteDescription error"));

const handlers: Handler[] = [
    // 0
    ,
    // MessageType.RtcOffer
    (req): Promise<RTCSessionDescriptionInit> =>
        handleOffer(requireRemoteClient(req[MessageField.Source]), req[MessageField.Data]),
    // MessageType.RtcCandidate
    (req, _rc?: RemoteClient): void => {
        if (req[MessageField.Data].candidate) {
            requireRemoteClient(req[MessageField.Source])
                .pc_.addIceCandidate(new RTCIceCandidate(req[MessageField.Data]))
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

export const processMessages = () => {
    if (_sseState > 1 && !messageUploading && messagesToPost.length) {
        messageUploading = true;
        _post(messagesToPost).then(response => {
            messagesToPost = messagesToPost.slice(response);
            messageUploading = false;
        }).catch(disconnect);
    }
};

const _post = (messages: Message[]): Promise<PostMessagesResponse> =>
    fetch(/*EventSourceUrl*/"_", {
        method: "POST",
        body: JSON.stringify([clientId, messages])
    }).then(response => response.json() as Promise<PostMessagesResponse>);

const onSSE: ((data: string) => void)[] = [
    // CLOSE
    disconnect as ((data: string) => void),
    // PING
    () => {
        remoteSend(0, MessageType.Nop, 0);
        processMessages();
    },
    // INIT
    (data: string, _ids?: number[]) => {
        _ids = data.split(",").map(Number);
        clientId = _ids.shift();
        _sseState = 2;
        Promise.all(_ids.map(id => {
            remoteSend(id, MessageType.Name, clientName)
            return connectToRemote(requireRemoteClient(id))
        }))
            .then((_) => _sseState = 3)
            .catch(disconnect);
    },
    // UPDATE
    (data: string, _message?: Message, _call?: number, _cb?: (req: Message) => void) => {
        _message = JSON.parse(data);
        _call = _message[MessageField.Call];
        _cb = callbacks[_call];
        callbacks[_call] = 0 as null;
        (_cb || requestHandler)(_message);
    },
    // LIST CHANGE
    (data: string, _id?: number) => {
        _id = +data;
        if (_id > 0) {
            remoteSend(_id, MessageType.Name, clientName);
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
        eventSource = rehash(new EventSource(/*EventSourceUrl*/ "_"));
        eventSource.onerror = disconnect;
        // eventSource.onerror = (e) => {
        //     console.warn("server-event error");
        //     termSSE();
        // };
        eventSource.onmessage = e => onSSE[e.data[0]]?.(e.data.substring(1));
    }
}

// RTC

const sendOffer = (rc: RemoteClient, iceRestart?: boolean) =>
    rc.pc_.createOffer({iceRestart})
        .then(offer => rc.pc_.setLocalDescription(offer))
        .then(() => remoteCall(
            rc.id_, MessageType.RtcOffer, rc.pc_.localDescription.toJSON(),
            (message) => rc.pc_.setRemoteDescription(new RTCSessionDescription(message[MessageField.Data]))
        ));

const newRemoteClient = (id: ClientID, _pc?: RTCPeerConnection): RemoteClient => {
    const rc: RemoteClient = {
        id_: id,
        pc_: _pc = new RTCPeerConnection({iceServers: [{urls: 'stun:stun.l.google.com:19302'}]}),
    };

    _pc.onicecandidate = (e) => {
        if (e.candidate) {
            remoteSend(id, MessageType.RtcCandidate, e.candidate.toJSON());
        }
    };

    _pc.onnegotiationneeded = () => {
        console.log("negotiation needed");
        sendOffer(rc, false);
    };

    _pc.ondatachannel = (e) => {
        console.log("received data-channel on Slave");
        rc.dc_ = e.channel;
        setupDataChannel(rc);
    };

    // TODO: debug
    // pc.onicecandidateerror = (e: RTCPeerConnectionIceErrorEvent) => {
    //     console.warn("ice candidate error: " + e.errorText);
    // };
    return rc;
}

const closePeerConnection = (rc?: RemoteClient) => {
    if (remoteClients.delete(rc?.id_)) {
        rc.dc_?.close();
        rc.pc_?.close();
    }
}

const connectToRemote = (rc: RemoteClient): Promise<void> => {
    rc.pc_.oniceconnectionstatechange = e => {
        if ("fd".indexOf(rc.pc_?.iceConnectionState[0]) >= 0) {
            sendOffer(rc, true).catch();
        }
    };
    console.log("connecting to " + rc.id_);
    return sendOffer(rc).then(_ => {
        rc.dc_ = rc.pc_.createDataChannel(0 as any as string, {ordered: false, maxRetransmits: 0});
        setupDataChannel(rc);
        return new Promise((resolve, reject) => {
            let num = 20;
            const timer = setInterval(() => {
                if (isPeerConnected(rc)) {
                    clearInterval(timer);
                    resolve();
                } else if (!--num) {
                    reject();
                }
            }, 200);
        });
    });
}

const setupDataChannel = (rc: RemoteClient) => {
    if (rc.dc_) {
        // TODO: rc.dc_?.
        rc.dc_.binaryType = "arraybuffer";
        rc.dc_.onmessage = (msg) => channels_processMessage(rc.id_, msg);
        // TODO: debug
        // channel.onopen = () => console.log("data channel opened");
        // channel.onerror = (e) => console.warn("data channel error", e);
    }
}

const requireRemoteClient = (id: ClientID): RemoteClient =>
    getOrCreate(remoteClients, id, newRemoteClient);

export const isPeerConnected = (rc?: RemoteClient): boolean =>
    rc?.dc_?.readyState[0] == "o" && rc?.pc_?.iceConnectionState[1] == "o";