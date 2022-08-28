import {ClientID} from "../../shared/types";
import {DebugLag} from "../game/config";
import {onRTCPacket} from "../game/game";

function chance(prob: number): boolean {
    return Math.random() < prob;
}

function range(min: number, max: number): number {
    return min + (max - min) * Math.random();
}

function channels_processMessageDebug(from: ClientID, data: ArrayBuffer) {
    if (!chance(DebugLag.PacketLoss ** 2)) {
        if (document.hidden) {
            // can't simulate lag when tab in background because of setTimeout stall
            onRTCPacket(from, data);
        } else {
            const delay = range(DebugLag.LagMin / 4, DebugLag.LagMax / 4)
            setTimeout(() => onRTCPacket(from, data), delay);
        }
    }
}

export function channels_processMessage(from: ClientID, msg: MessageEvent<ArrayBuffer>) {
    if (process.env.NODE_ENV === "development") {
        channels_processMessageDebug(from, msg.data);
    } else {
        onRTCPacket(from, msg.data)
    }
}
