import {_debugLagK} from "../game/config";
import {isPeerConnected, RemoteClient} from "./messaging";
import {lerp} from "../utils/math";
import {fxRandom} from "../utils/rnd";

const sendSafeInner = (channel: RTCDataChannel, data: ArrayBuffer) => {
    try {
        channel.send(data);
    } catch (e) {
        console.warn(`DataChannel send message [${data.byteLength}] error:`, e);
    }
}

const sendSafe = (client: RemoteClient, data: ArrayBuffer) => {
    const dc = client._dc;
    if (dc.bufferedAmount > dc.bufferedAmountLowThreshold) {
        // dc.onbufferedamountlow = () => {
        //     dc.onbufferedamountlow = null;
        //     sendSafeInner(dc, data);
        // };
        return;
    }
    sendSafeInner(dc, data);
}

const sendWithDebugLag = (client: RemoteClient, data: ArrayBuffer) => {
    client._debugPacketByteLength = data.byteLength;
    if (data.byteLength >= 1200 / 2) {
        //console.warn("HUGE packet could not be delivered: " + data.byteLength);
        //throw new Error("HUGE packet could not be delivered: " + data.byteLength);
    }
    if (!_debugLagK) {
        sendSafe(client, data);
        return;
    }
    const loss = 0.05 * (10 ** (_debugLagK - 1));
    const lagMin = 20 * (10 ** (_debugLagK - 1));
    const lagMax = 200 * (10 ** (_debugLagK - 1));
    if (fxRandom() > loss * loss) {
        if (document.hidden) {
            // can't simulate lag when tab in background because of setTimeout stall
            sendSafe(client, data);
        } else {
            const delay = lerp(lagMin, lagMax, fxRandom()) / 4;
            setTimeout(() => {
                if (isPeerConnected(client)) {
                    sendSafe(client, data);
                }
            }, delay);
        }
    }
}

export const channels_sendObjectData = (client: RemoteClient, data: ArrayBuffer) => {
    if (process.env.NODE_ENV === "development") {
        sendWithDebugLag(client, data);
    } else {
        sendSafe(client, data);
    }
}

export const getChannelPacketSize = (client: RemoteClient): number =>
    process.env.NODE_ENV === "development" ?
        (client._debugPacketByteLength | 0) :
        (client._dc.bufferedAmount);

