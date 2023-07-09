import {
    BuildHash,
    ClientID,
    GameModeFlag,
    Message,
    MessageData,
    MessageField,
    MessageType,
    NewGameParams,
    PostMessagesResponse,
    RoomsInfoResponse,
    ServerUrl,
} from "@iioi/shared/types.js";
import {channels_processMessage} from "./channels.js";
import {getOrCreate} from "../utils/utils.js";
import {getIceServers} from "./iceServers.js";
import {setSetting, Setting, settings} from "../game/settings.js";
import {newSeedFromTime} from "@iioi/shared/seed.js";
import {setPlayerName} from "../analytics.js";

export interface RemoteClient {
    _id: ClientID;
    _pc?: RTCPeerConnection;
    _dc?: RTCDataChannel;
    _name?: string;
    _debugPacketByteLength?: number;
    _remoteDescSet?: boolean;
    _iceCandidates?: RTCIceCandidate[];
}

const getUrl = (url: string) => ServerUrl + url;
const getPostUrl = () => getUrl(`_?v=${BuildHash}&r=${_room._code}`);
const getJoinUrl = (joinRoomCode?: string, newGameParams?: NewGameParams) => {
    const args = [`v=${BuildHash}`];
    if (joinRoomCode) {
        args.push(`r=${joinRoomCode}`);
    }
    if (newGameParams) {
        const params = [
            newGameParams._flags,
            newGameParams._playersLimit,
            newGameParams._npcLevel,
            newGameParams._theme,
        ];
        const data = encodeURIComponent(JSON.stringify(params));
        args.push(`c=${data}`);
    }
    return getUrl(`_?${args.join("&")}`);
};

interface RoomInstance {
    _code: string;
    _flags: number;
    _npcLevel: number;
    _mapSeed: number;
    _mapTheme: number;
}

let _onGetGameState: (from: ClientID) => string | undefined;
export const onGetGameState = (cb: (from: ClientID) => string | undefined) => (_onGetGameState = cb);

export let _room: RoomInstance | undefined;

export let _sseState = 0;
export const remoteClients = new Map<ClientID, RemoteClient>();
let eventSource: EventSource | null = null;
export let clientId: 0 | ClientID = 0;
export let clientName: string | null = settings[Setting.Name];
let messagesToPost: Message[] = [];
let messageUploading = false;
let nextCallId = 1;
let callbacks: ((msg: Message) => void)[] = [];

export const loadRoomsInfo = async (): Promise<RoomsInfoResponse> => {
    let result: RoomsInfoResponse = {rooms: [], players: 0};
    try {
        const response = await fetch(getUrl(`i`), {method: "POST"});
        result = (await response.json()) as RoomsInfoResponse;
    } catch (e) {
        console.warn("Can't load rooms info", e);
    }
    return result;
};

export const setUserName = (name?: string) => {
    name ||= "Guest " + ((Math.random() * 1000) | 0);
    clientName = setSetting(Setting.Name, name.trim().substring(0, 32).trim());
    setPlayerName(clientName);
};

const remoteSend = (to: ClientID, type: MessageType, data: MessageData, call = 0): number => {
    messagesToPost.push([clientId, to, type, call, data]);
    processMessages();
    return messagesToPost.length;
};

export const remoteCall = (
    to: ClientID,
    type: MessageType,
    data: MessageData,
    callback: (response: Message) => void,
): void => {
    callbacks[nextCallId] = callback;
    remoteSend(to, type, data, nextCallId++);
};

type Handler = ((req: Message) => Promise<MessageData>) | ((req: Message) => void);

export const disconnect = (reason?: string) => {
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
    _room = undefined;

    if (reason) {
        console.error(reason);
    }
};

const handleOffer = (rc: RemoteClient, offer: RTCSessionDescriptionInit) =>
    rc._pc
        .setRemoteDescription(offer)
        .then(async () => {
            rc._remoteDescSet = true;
            if (rc._iceCandidates) {
                await Promise.all(
                    rc._iceCandidates.map(ice =>
                        rc._pc
                            .addIceCandidate(ice)
                            .catch(error => console.warn("ice candidate set failed: " + error.message)),
                    ),
                );
                rc._iceCandidates = [];
            }
            return await rc._pc.createAnswer();
        })
        .then(answer => rc._pc.setLocalDescription(answer))
        .then(() => remoteSend(rc._id, MessageType.RtcAnswer, rc._pc.localDescription.toJSON()))
        .catch(() => console.warn("setRemoteDescription error"));

const handleAnswer = async (rc: RemoteClient, answer: RTCSessionDescriptionInit) => {
    rc._pc
        .setRemoteDescription(new RTCSessionDescription(answer))
        .then(() => {
            rc._remoteDescSet = true;
        })
        .catch(() => console.warn("setRemoteDescription error"));
};

const handlers: Handler[] = [
    undefined,
    // 0
    // MessageType.RtcOffer
    (req): void => {
        handleOffer(requireRemoteClient(req[MessageField.Source]), req[MessageField.Data] as RTCSessionDescriptionInit);
    },
    (req): void => {
        handleAnswer(
            requireRemoteClient(req[MessageField.Source]),
            req[MessageField.Data] as RTCSessionDescriptionInit,
        );
    },
    // MessageType.RtcCandidate
    (req): void => {
        const init = req[MessageField.Data] as RTCIceCandidateInit;
        if (init.candidate) {
            const rc = requireRemoteClient(req[MessageField.Source]);
            if (rc._remoteDescSet) {
                rc._pc
                    .addIceCandidate(new RTCIceCandidate(init))
                    .catch(error => console.warn("ice candidate set failed: " + error.message));
            } else {
                if (!rc._iceCandidates) rc._iceCandidates = [];
                rc._iceCandidates.push(new RTCIceCandidate(init));
            }
        }
    },
    // MessageType.Name
    (req): void => {
        requireRemoteClient(req[MessageField.Source] as ClientID)._name = req[MessageField.Data] as string;
    },
    // MessageType.State
    (req): Promise<string> => Promise.resolve(_onGetGameState?.(req[MessageField.Source]) ?? ""),
];

const requestHandler = (req: Message) =>
    (handlers[req[MessageField.Type]](req) as undefined | Promise<MessageData>)?.then(
        // respond to remote client if we have result in call handler
        data => {
            messagesToPost.push([
                clientId,
                req[MessageField.Source],
                req[MessageField.Type],
                req[MessageField.Call],
                data,
            ]);
            processMessages();
        },
    );

export const processMessages = () => {
    if (_sseState > 1 && !messageUploading && messagesToPost.length) {
        messageUploading = true;
        _post(messagesToPost)
            .then(response => {
                messagesToPost = messagesToPost.slice(response);
                messageUploading = false;
                processMessages();
            })
            .catch(disconnect);
    }
};

const _post = (messages: Message[]): Promise<PostMessagesResponse> =>
    fetch(getPostUrl(), {
        method: "POST",
        body: JSON.stringify([clientId, messages]),
    }).then(response => response.json() as Promise<PostMessagesResponse>);

const onSSE: ((data: string) => void)[] = [
    // CLOSE
    disconnect as (data: string) => void,
    // PING
    () => {
        // remoteSend(0, MessageType.Nop, 0);
        // processMessages();
        fetch(getPostUrl(), {method: "POST", body: `[${clientId}]`}).catch(disconnect);
    },
    // INIT
    (data: string) => {
        const json: [string, number[], number[]] = JSON.parse(data);
        const roomData = json[1];
        _room = {
            _code: json[0],
            _flags: roomData[0],
            _npcLevel: roomData[1],
            _mapTheme: roomData[2],
            _mapSeed: roomData[3],
        };
        const ids: number[] = json[2];
        clientId = ids.shift();
        _sseState = 2;
        Promise.all(
            ids.map(id => {
                remoteSend(id, MessageType.Name, clientName);
                return connectToRemote(requireRemoteClient(id));
            }),
        )
            .then(() => (_sseState = 3))
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
    },
];

export const connect = (newGameParams?: NewGameParams, gameCode?: string) => {
    if (_sseState) {
        console.warn("connect: sse state already", _sseState);
        return;
    }
    if (newGameParams && newGameParams._flags & GameModeFlag.Offline) {
        // bypass all connection routine
        _sseState = 3;
        clientId = 1;
        _room = {
            _code: "",
            _npcLevel: newGameParams._npcLevel,
            _flags: newGameParams._flags,
            _mapTheme: newGameParams._theme ? newGameParams._theme - 1 : Math.floor(Math.random() * 3),
            _mapSeed: newSeedFromTime(),
        };
    } else {
        _sseState = 1;
        messageUploading = false;
        messagesToPost = [];
        callbacks = [];
        eventSource = new EventSource(getJoinUrl(gameCode, newGameParams));
        eventSource.onerror = e => {
            console.warn("server-event error", e);
            disconnect();
        };
        eventSource.onmessage = e => onSSE[e.data[0]]?.(e.data.substring(1));
    }
};

// RTC
const sendOffer = (rc: RemoteClient, iceRestart?: boolean) =>
    rc._pc
        .createOffer({iceRestart})
        .then(offer => rc._pc.setLocalDescription(offer))
        // .then(() => waitForAllICECandidates(rc))
        // .then(() => {
        //     rc._pc.onicecandidate = e => {
        //         if (e.candidate) {
        //             remoteSend(rc._id, MessageType.RtcCandidate, e.candidate.toJSON());
        //         }
        //     };
        // })
        .then(() => {
            remoteSend(rc._id, MessageType.RtcOffer, rc._pc.localDescription.toJSON());
        });

const newRemoteClient = (id: ClientID, _pc?: RTCPeerConnection): RemoteClient => {
    const rc: RemoteClient = {
        _id: id,
        _pc: (_pc = new RTCPeerConnection({iceServers: getIceServers()})),
        _iceCandidates: [],
    };

    _pc.onicecandidate = e => {
        console.info(e.candidate);
        if (e.candidate) {
            const data = {
                candidate: e.candidate.candidate,
                sdpMid: e.candidate.sdpMid,
                sdpMLineIndex: e.candidate.sdpMLineIndex,
            };
            // remoteSend(id, MessageType.RtcCandidate, e.candidate.toJSON());
            remoteSend(id, MessageType.RtcCandidate, data);
        }
    };

    // _pc.addEventListener("icecandidate", e => {
    //     console.info(e);
    //     if (e.candidate) {
    //         remoteSend(id, MessageType.RtcCandidate, e.candidate.toJSON());
    //     }
    // });

    _pc.onnegotiationneeded = () => {
        console.info("negotiation needed");
        sendOffer(rc, false);
    };

    _pc.ondatachannel = e => {
        console.log("received data-channel on Slave");
        //await new Promise<void>((resolve) => setTimeout(resolve, (1000 + 3000 * Math.random()) | 0));
        rc._dc = e.channel;
        setupDataChannel(rc);
    };

    // TODO: debug
    // pc.onicecandidateerror = (e: RTCPeerConnectionIceErrorEvent) => {
    //     console.warn("ice candidate error: " + e.errorText);
    // };
    return rc;
};

const closePeerConnection = (rc?: RemoteClient) => {
    if (remoteClients.delete(rc?._id)) {
        rc._dc?.close();
        rc._pc?.close();
    }
};

const connectToRemote = async (rc: RemoteClient): Promise<void> => {
    rc._pc.oniceconnectionstatechange = () => {
        if ("fd".indexOf(rc._pc?.iceConnectionState[0]) >= 0) {
            sendOffer(rc, true).catch();
        }
    };
    console.log("connecting to " + rc._id);
    rc._dc = rc._pc.createDataChannel(0 as unknown as string, {ordered: false, maxRetransmits: 0});
    setupDataChannel(rc);
    //await sendOffer(rc);
    await new Promise<void>((resolve, reject) => {
        let num = 50;
        const timer = setInterval(() => {
            if (isPeerConnected(rc)) {
                clearInterval(timer);
                resolve();
            } else if (!--num) {
                reject();
            }
        }, 100);
    });
};

const setupDataChannel = (rc: RemoteClient) => {
    if (rc._dc) {
        // TODO: rc.dc_?.
        rc._dc.binaryType = "arraybuffer";
        rc._dc.onmessage = msg => channels_processMessage(rc._id, msg);
        // TODO: debug
        // channel.onopen = () => console.log("data channel opened");
        // channel.onerror = (e) => console.warn("data channel error", e);
    }
};

const requireRemoteClient = (id: ClientID): RemoteClient => getOrCreate(remoteClients, id, newRemoteClient);

export const isPeerConnected = (rc?: RemoteClient): boolean => {
    const dataChannelState = rc?._dc?.readyState;
    const iceConnectionState = rc?._pc?.iceConnectionState;
    return dataChannelState === "open" && (iceConnectionState == "connected" || iceConnectionState == "completed");
};
