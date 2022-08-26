import {ClientID} from "../../shared/types";
import {DEBUG_LAG_ENABLED, DebugLag} from "../game/config";
import {onRTCPacket} from "../game/game";

// round-trip
const lagMin = DebugLag.LagMin / 2;
const lagMax = DebugLag.LagMax / 2;
const packetLoss = DebugLag.PacketLoss;
const receiveLagMin = lagMin / 2;
const receiveLagMax = lagMax / 2;
const receivePacketLoss = packetLoss * packetLoss;

function chance(prob: number): boolean {
    return Math.random() < prob;
}

function range(min: number, max: number): number {
    return min + (max - min) * Math.random();
}

export function channels_processMessage(from: ClientID, msg: MessageEvent<ArrayBuffer>) {
    if (DEBUG_LAG_ENABLED) {
        if (!chance(receivePacketLoss)) {
            if (document.hidden) {
                // can't simulate lag when tab in background because of setTimeout stall
                onRTCPacket(from, msg.data);
            } else {
                const delay = range(receiveLagMin, receiveLagMax)
                setTimeout(() => onRTCPacket(from, msg.data), delay);
            }
        }
    } else {
        onRTCPacket(from, msg.data)
    }
}
