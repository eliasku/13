import {DebugLag} from "../game/config";
import {RemoteClient} from "./messaging";

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
    if (!chance(DebugLag.PacketLoss ** 2)) {
        if (document.hidden) {
            // can't simulate lag when tab in background because of setTimeout stall
            try {
                client.dc_.send(data);
            } catch (e) {
                console.warn("DataChannel send error:", e)
            }
        } else {
            const delay = range(DebugLag.LagMin / 4, DebugLag.LagMax / 4);
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
    if (process.env.NODE_ENV === "development") {
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
    return process.env.NODE_ENV === "development" ?
        (client.debugPacketByteLength_ | 0) :
        (client.dc_.bufferedAmount);
}

