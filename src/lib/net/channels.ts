import {ClientID} from "../../shared/types";
import {DEBUG_LAG_ENABLED, DebugLag} from "../game/config";
import {RemoteClient} from "./messaging";

// round-trip
const lagMin = DebugLag.LagMin / 2;
const lagMax = DebugLag.LagMax / 2;
const packetLoss = DebugLag.PacketLoss;
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

type RTMessageHandler = (from: ClientID, data: ArrayBuffer) => void;
let onRTMessage: RTMessageHandler = () => {
};

export function setRTMessageHandler(handler: RTMessageHandler) {
    onRTMessage = handler;
}

function send(dc: RTCDataChannel, data: ArrayBuffer) {
    try {
        dc.send(data);
    } catch (e) {
        // sometimes Firefox throw error on send
        // TODO: or maybe it was just unsafe minify and we tried use not opened data-channel
        console.warn("data channel send error:", e);
    }
}

export function channels_sendObjectData(client: RemoteClient, data: ArrayBuffer) {
    const dc = client.dc_;
    if (DEBUG_LAG_ENABLED) {
        client.debugPacketByteLength_ = data.byteLength;
        if (data.byteLength >= 1200 / 2) {
            console.warn("HUGE packet could not be delivered: " + data.byteLength);
            //throw new Error("HUGE packet could not be delivered: " + data.byteLength);
        }
        if (!chance(sendPacketLoss)) {
            if (document.hidden) {
                // can't simulate lag when tab in background because of setTimeout stall
                send(dc, data);
            } else {
                const delay = range(sendLagMin, sendLagMax);
                setTimeout(() => {
                    if (dc.readyState === "open") {
                        send(dc, data);
                    }
                }, delay);
            }
        }
        return;
    }
    send(dc, data);
}

export function channels_processMessage(from: ClientID, msg: MessageEvent<ArrayBuffer>) {
    const data = msg.data;
    if (DEBUG_LAG_ENABLED) {
        if (!chance(receivePacketLoss)) {
            if (document.hidden) {
                // can't simulate lag when tab in background because of setTimeout stall
                onRTMessage(from, data);
            } else {
                const delay = range(receiveLagMin, receiveLagMax)
                setTimeout(() => onRTMessage(from, data), delay);
            }
        }
        return;
    }
    onRTMessage(from, data)
}

export function getChannelPacketSize(client: RemoteClient) {
    return DEBUG_LAG_ENABLED ? client.dc_.bufferedAmount : (client.debugPacketByteLength_ | 0);
}

