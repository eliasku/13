import {DEBUG_LAG_ENABLED, DebugLag} from "../game/config";
import {RemoteClient} from "./messaging";

// round-trip
const lagMin = DebugLag.LagMin / 2;
const lagMax = DebugLag.LagMax / 2;
const packetLoss = DebugLag.PacketLoss;
const sendLagMin = lagMin / 2;
const sendLagMax = lagMax / 2;
const sendPacketLoss = packetLoss * packetLoss;

function chance(prob: number): boolean {
    return Math.random() < prob;
}

function range(min: number, max: number): number {
    return min + (max - min) * Math.random();
}

function sendWithDebugLag(client: RemoteClient, data: ArrayBuffer) {
    client.debugPacketByteLength_ = data.byteLength;
    if (data.byteLength >= 1200 / 2) {
        console.warn("HUGE packet could not be delivered: " + data.byteLength);
        //throw new Error("HUGE packet could not be delivered: " + data.byteLength);
    }
    if (!chance(sendPacketLoss)) {
        if (document.hidden) {
            // can't simulate lag when tab in background because of setTimeout stall
            try {
                client.dc_.send(data);
            } catch (e) {
                console.warn("DataChannel send error:", e)
            }
        } else {
            const delay = range(sendLagMin, sendLagMax);
            setTimeout(() => {
                if (client.dc_.readyState === "open") {
                    try {
                        client.dc_.send(data);
                    } catch (e) {
                        console.warn("DataChannel send error:", e)
                    }
                }
            }, delay);
        }
    }
}

export function channels_sendObjectData(client: RemoteClient, data: ArrayBuffer) {
    if (DEBUG_LAG_ENABLED) {
        sendWithDebugLag(client, data);
    } else {
        try {
            client.dc_.send(data);
        } catch {
            // FOR RELEASE MODE IGNORE
        }
    }
}

export function getChannelPacketSize(client: RemoteClient) {
    return DEBUG_LAG_ENABLED ? client.dc_.bufferedAmount : (client.debugPacketByteLength_ | 0);
}

