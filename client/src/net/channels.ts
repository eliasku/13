import {ClientID} from "../../shared/types";
import {_debugLagK} from "../game/config";
import {onRTCPacket} from "../game/game";
import {lerp} from "../utils/math";
import {fxRandom} from "../utils/rnd";

const channels_processMessageDebug = (from: ClientID, data: ArrayBuffer) => {
    if(!_debugLagK) {
        onRTCPacket(from, data);
        return;
    }

    const loss = 0.05 * (10 ** (_debugLagK - 1));
    const lagMin = 20 * (10 ** (_debugLagK - 1));
    const lagMax = 200 * (10 ** (_debugLagK - 1));
    if (fxRandom() > loss ** 2) {
        if (document.hidden) {
            // can't simulate lag when tab in background because of setTimeout stall
            onRTCPacket(from, data);
        } else {
            const delay = lerp(lagMin, lagMax, fxRandom()) / 4;
            setTimeout(() => onRTCPacket(from, data), delay);
        }
    }
}

export const channels_processMessage = (from: ClientID, msg: MessageEvent<ArrayBuffer>) => {
    if (process.env.NODE_ENV === "development") {
        channels_processMessageDebug(from, msg.data);
    } else {
        onRTCPacket(from, msg.data)
    }
}
