import {log, logWarn} from "../debug/log";
import {NodeID} from "../../shared/types";
import {call, getLocalNode, getRemoteNodes, sendWithoutResponse, setHandler, setOnNodeRemoved} from "./messaging";

setOnNodeRemoved(closeConnection);

const configuration: RTCConfiguration = {
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

interface Connection {
    remoteId: NodeID | null;
    pc: RTCPeerConnection;
    channel: RTCDataChannel | null;
}

let onRTMessage: (fromId: NodeID, data: any) => void = () => {
};

export function setRTMessageHandler(handler: (fromId: NodeID, data: any) => void) {
    onRTMessage = handler;
}

const connections: Connection[] = [];
export const peerConnections: Connection[] = connections;

async function sendOffer(remoteId: NodeID) {
    try {
        const connection = connections[remoteId];
        if (connection) {
            const pc = connection.pc;
            const offer = await pc.createOffer({
                offerToReceiveAudio: false,
                offerToReceiveVideo: false
            });
            await pc.setLocalDescription(offer);
            const result = await call(remoteId, {type: "rtc_offer", offer});
            await pc.setRemoteDescription(new RTCSessionDescription(result.answer));
        } else {
            logWarn(`send-offer: connection ${remoteId} not found`);
        }
    } catch (e) {
        console.warn("Couldn't create offer", e);
    }
}

function createConnection(remoteId: NodeID) {
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
        log("negotiation needed");
        await sendOffer(remoteId);
    });

    pc.addEventListener("datachannel", (e) => {
        log("received data-channel on Slave");

        const channel = e.channel;
        connections[remoteId].channel = channel;
        if (channel) {
            log("dc: " + channel.readyState);
            channel.onmessage = (e) => {
                log("receiver message from Slave: " + e.data);
                onRTMessage(remoteId, JSON.parse(e.data));
            };
        }
    });

    pc.addEventListener("icecandidateerror", (e: RTCPeerConnectionIceErrorEvent) => {
        log("ice candidate error: " + e.errorText);
    });

    return connection;
}

function closeConnection(remoteId: NodeID) {
    const con = connections[remoteId];
    if (con) {
        connections[remoteId] = undefined;
        if (con.channel) {
            con.channel.close();
            con.channel = null;
        }
        con.pc.close();
    }
}

export async function connectToRemote(remoteId: NodeID) {
    const connection = createConnection(remoteId);
    await sendOffer(remoteId);

    connection.channel = connection.pc.createDataChannel("Source");
    log("dc: " + connection.channel.readyState);
    connection.channel.addEventListener("open", (e) => {
        log("data channel opened");
        //connection.channel.send(`Hello from ${getLocalNode()} with ${Math.random()}!`);
    });
    connection.channel.addEventListener("message", (e) => {
        log("received message on Master: " + e.data);
        onRTMessage(connection.remoteId, JSON.parse(e.data));
    });
}

export async function connectToRemotes() {
    const remotes = getRemoteNodes();
    const tasks = [];
    for (let i = 0; i < remotes.length; ++i) {
        tasks.push(connectToRemote(remotes[i]));
    }
    await Promise.all(tasks);
}

setHandler("rtc_offer", async (req) => {
    if (!connections[req.from]) {
        createConnection(req.from);
    }
    const connection = connections[req.from];
    await connection.pc.setRemoteDescription(req.data.offer);
    const answer = await connection.pc.createAnswer();
    await connection.pc.setLocalDescription(answer);
    return {answer};
});

setHandler("rtc_candidate", async (req) => {
    if (!connections[req.from]) {
        createConnection(req.from);
    }
    const connection = connections[req.from];
    if (req.data.candidate) {
        try {
            await connection.pc.addIceCandidate(new RTCIceCandidate(req.data.candidate));
        } catch (e: any) {
            log("ice candidate set failed: " + e.message);
        }
    }
    return undefined;
});
