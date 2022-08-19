import {ClientID} from "../../shared/types";

// round-trip
const debug = true;
const lagMin = 20 / 2;
const lagMax = 300 / 2;
const packetLoss = 0.05;
const sendLagMin = lagMin / 2;
const sendLagMax = lagMax / 2;
const sendPacketLoss = packetLoss * packetLoss;
const receiveLagMin = lagMin / 2;
const receiveLagMax = lagMax / 2;
const receivePacketLoss = packetLoss * packetLoss;

function chance(prob: number): boolean {
    return Math.random() < prob;
}

function range(min: number, max: number): number {
    return min + (max - min) * Math.random();
}

type RTMessageHandler = (from: ClientID, data: any) => void;
let onRTMessage: RTMessageHandler = () => {
};

export function setRTMessageHandler(handler: RTMessageHandler) {
    onRTMessage = handler;
}

export function channels_sendObjectData(dc: RTCDataChannel, data: any) {
    const txt = JSON.stringify(data);
    if (debug) {
        if (!chance(sendPacketLoss)) {
            if (document.hidden) {
                // can't simulate lag when tab in background because of setTimeout stall
                dc.send(txt);
            } else {
                setTimeout(() => {
                    if (dc.readyState === "open") {
                        dc.send(txt);
                    }
                }, range(sendLagMin, sendLagMax));
            }
        }
        return;
    }
    dc.send(txt);
}

export function channels_processMessage(from: ClientID, msg: MessageEvent<string>) {
    const data = JSON.parse(msg.data);
    if (debug) {
        if (!chance(receivePacketLoss)) {
            if (document.hidden) {
                // can't simulate lag when tab in background because of setTimeout stall
                onRTMessage(from, data);
            } else {
                setTimeout(() => onRTMessage(from, data), range(receiveLagMin, receiveLagMax));
            }
        }
        return;
    }
    onRTMessage(from, data)
}

