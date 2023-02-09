import {ClientEvent, StateData} from "./types.js";
import {writeState} from "./packets.js";
import {_room} from "../net/messaging.js";
import {BuildCommit, BuildHash, BuildVersion} from "@iioi/shared/types.js";
import {getNameByClientId} from "./gameState.js";
import {ReplayMetaData} from "./replayFile.js";

// [tic1, client#, client#-input, ..., 0,
//  tic4, client#, client#-input, ..., 0,]
const replayStream: number[] = [];
let replayStartState: Int32Array;
const replayMetaData: ReplayMetaData = {
    clients: {},
    build: {
        version: BuildVersion,
        commit: BuildCommit,
        hash: BuildHash,
    },
    start: 0,
    end: 0,
};

export function beginRecording(state: StateData) {
    if (_room == null) {
        return;
    }
    replayStream.length = 1;
    const buffer = new Int32Array(1024 * 256);
    const len = writeState(state, buffer, 0);
    replayStartState = buffer.slice(0, len);
    replayMetaData.room = {
        flags: _room._flags,
        npcLevel: _room._npcLevel,
        mapSeed: _room._mapSeed,
        mapTheme: _room._mapTheme,
    };
    replayMetaData.clients = {};
    replayMetaData.start = 0x7fffffff;
    replayMetaData.end = 0;
}

export function addReplayTicEvents(tic: number, events: ClientEvent[]) {
    if (tic < replayMetaData.start) replayMetaData.start = tic;
    if (tic > replayMetaData.end) replayMetaData.end = tic;
    if (events.length > 0) {
        replayStream.push(tic);
        for (const event of events) {
            const owner = event._client;
            replayStream.push(owner, event._input);
            if (!(owner in replayMetaData.clients)) {
                const name = getNameByClientId(owner);
                if (name != null) {
                    replayMetaData.clients[owner] = name;
                }
            }
        }
        replayStream.push(0);
    }
}

export function saveReplay() {
    if (replayMetaData.end - replayMetaData.start <= 0) {
        console.error("Bad replay state data");
        return;
    }
    // encode metadata
    const metaBytes = new TextEncoder().encode(JSON.stringify(replayMetaData));
    const metaBytesAligned = new Uint8Array(4 * (1 + Math.ceil(metaBytes.length / 4)));
    metaBytesAligned.set(metaBytes, 4);
    const metaBytes32 = new Int32Array(metaBytesAligned.buffer);
    metaBytes32[0] = metaBytes.length;

    // save stream length
    replayStream[0] = replayStream.length - 1;

    const content = new Int32Array(metaBytes32.length + replayStartState.length + replayStream.length);
    content.set(metaBytes32);
    content.set(replayStartState, metaBytes32.length);
    content.set(new Int32Array(replayStream), metaBytes32.length + replayStartState.length);

    const a = document.createElement("a");
    const file = new Blob([content], {type: "application/octet-stream"});
    a.href = URL.createObjectURL(file);
    a.download = "iioi-replay.bin";
    a.click();
}
