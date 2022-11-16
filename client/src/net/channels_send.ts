import {_debugLagK} from "../game/config";
import {isPeerConnected, RemoteClient} from "./messaging";
import {lerp} from "../utils/math";
import {fxRandom} from "../utils/rnd";

const sendWithDebugLag = (client: RemoteClient, data: ArrayBuffer) => {
    client.debugPacketByteLength = data.byteLength;
    if (data.byteLength >= 1200 / 2) {
        //console.warn("HUGE packet could not be delivered: " + data.byteLength);
        //throw new Error("HUGE packet could not be delivered: " + data.byteLength);
    }
    if (!_debugLagK) {
        client.dc_.send(data);
    }
    const loss = 0.05 * (10 ** (_debugLagK - 1));
    const lagMin = 20 * (10 ** (_debugLagK - 1));
    const lagMax = 200 * (10 ** (_debugLagK - 1));
    if (fxRandom() > loss * loss) {
        if (document.hidden) {
            // can't simulate lag when tab in background because of setTimeout stall
            try {
                client.dc_.send(data);
            } catch (e) {
                console.warn("DataChannel send error:", e)
            }
        } else {
            const delay = lerp(lagMin, lagMax, fxRandom()) / 4;
            setTimeout(() => {
                if (isPeerConnected(client)) {
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

export const channels_sendObjectData = (client: RemoteClient, data: ArrayBuffer) => {
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

export const getChannelPacketSize = (client: RemoteClient): number =>
    process.env.NODE_ENV === "development" ?
        (client.debugPacketByteLength | 0) :
        (client.dc_.bufferedAmount);

