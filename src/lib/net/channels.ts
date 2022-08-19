import {ClientID} from "../../shared/types";

const debug = false;
const lagMin = 100;
const lagMax = 200;
const packetLoss = 0.05;
const sendLagMin = lagMin / 2;
const sendLagMax = lagMax / 2;
const sendPacketLoss = packetLoss * packetLoss;
const receiveLagMin = lagMin / 2;
const receiveLagMax = lagMax / 2;
const receivePacketLoss = packetLoss * packetLoss;

function chance(prob:number):boolean {
    return Math.random() < prob;
}

function randomRange(min: number, max: number):number {
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
            setTimeout(() => {
                if(dc.readyState === "open") {
                    dc.send(txt);
                }
            }, randomRange(sendLagMin, sendLagMax));
        }
        return;
    }
    dc.send(txt);
}

export function channels_processMessage(from: ClientID, msg:MessageEvent<string>) {
    const data = JSON.parse(msg.data);
    if (debug) {
        if (!chance(receivePacketLoss)) {
            setTimeout(() => onRTMessage(from, data), randomRange(receiveLagMin, receiveLagMax));
        }
        return;
    }
    onRTMessage(from, data)
}

