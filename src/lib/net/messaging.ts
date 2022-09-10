import {ClientID, Message, MessageData, MessageField, MessageType, PostMessagesResponse} from "../../shared/types";
import {channels_processMessage} from "./channels";
import {rehash} from "../utils/hasher";

export interface RemoteClient {
    id_: ClientID;
    pc_?: RTCPeerConnection;
    dc_?: RTCDataChannel;
    name_?: string;
    debugPacketByteLength?: number;
}

rehash(EventSource.prototype);
rehash(RTCPeerConnection.prototype);
rehash(RTCDataChannel.prototype);

export let _sseState = 0;
export const remoteClients = new Map<ClientID, RemoteClient>();
let eventSource: EventSource | null = null;
export let clientId: 0 | ClientID = 0;
export let clientName: string | null = localStorage.getItem("_");
let messagesToPost: Message[] = [];
let messageUploading = false;
let nextCallId = 1;
let callbacks: ((msg: Message) => void)[] = [];

export const setUserName = (name: string) => {
    localStorage.setItem("_", clientName = name);
}

const remoteSend = (to: ClientID, type: MessageType, data: MessageData, call = 0): number =>
    messagesToPost.push([clientId, to, type, call, data]);

const remoteCall = (to: ClientID, type: MessageType, data: MessageData): Promise<Message> =>
    new Promise((resolve) => {
        callbacks[nextCallId] = resolve;
        remoteSend(to, type, data, nextCallId++);
    });

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
    () => _post([]).catch(disconnect),
    // INIT
    (data: string, _ids?: number[]) => {
        _ids = data.split(",").map(Number);
        clientId = _ids.shift();
        _sseState = 2;
        Promise.all(_ids.map(id => {
            console.info(`remote client ${id} observed`);
            remoteSend(id, MessageType.Name, clientName);
            return connectToRemote(requireRemoteClient(id));
        })).then((_) => {
            _sseState = 3;
        });
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
        eventSource = new EventSource(/*EventSourceUrl*/ "_");
        eventSource.onerror = disconnect;
        // eventSource.onerror = (e) => {
        //     console.warn("server-event error");
        //     termSSE();
        // };
        eventSource.onmessage = e => onSSE[e.data[0]]?.(e.data.substring(1));
    }
}

// RTC

const sendOffer = async (remoteClient: RemoteClient, iceRestart?: boolean) => {
    try {
        console.log("send offer to " + remoteClient.id_);
        const pc = remoteClient.pc_;
        const offer = await pc.createOffer({iceRestart});
        await pc.setLocalDescription(offer);
        const result = (await remoteCall(remoteClient.id_, MessageType.RtcOffer, offer))
            [MessageField.Data];
        if (result) {
            await pc.setRemoteDescription(new RTCSessionDescription(result));
        }
    } catch (e) {
        console.warn("Couldn't create offer");
    }
}

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

const connectToRemote = async (rc: RemoteClient) => {
    rc.pc_.oniceconnectionstatechange = e => {
        if ("fd".indexOf(rc.pc_?.iceConnectionState[0]) >= 0) {
            sendOffer(rc, true);
        }
    };
    console.log("connecting to " + rc.id_);
    await sendOffer(rc);
    rc.dc_ = rc.pc_.createDataChannel(0 as any as string, {ordered: false, maxRetransmits: 0});
    setupDataChannel(rc);
}

const setupDataChannel = (rc: RemoteClient) => {
    if (rc.dc_) {
        rc.dc_.binaryType = "arraybuffer";
        rc.dc_.onmessage = (msg) => channels_processMessage(rc.id_, msg);
        // TODO: debug
        // channel.onopen = () => console.log("data channel opened");
        // channel.onerror = (e) => console.warn("data channel error", e);
    }
}

const requireRemoteClient = (id: ClientID): RemoteClient => {
    if (!remoteClients.has(id)) {
        remoteClients.set(id, newRemoteClient(id));
    }
    return remoteClients.get(id);
}

export const isPeerConnected = (rc?: RemoteClient): boolean =>
    rc?.dc_?.readyState[0] == "o" && rc?.pc_?.iceConnectionState[1] == "o";