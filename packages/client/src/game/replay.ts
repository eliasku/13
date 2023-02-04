import {ClientEvent, newStateData, StateData} from "./types.js";
import {readState, writeState} from "./packets.js";
import {_room} from "../net/messaging.js";
import {BuildCommit, BuildHash, BuildVersion, ClientID} from "@iioi/shared/types.js";
import {getNameByClientId} from "./gameState.js";

export interface ReplayMetaData {
    room?: {
        flags: number,
        npcLevel: number,
        mapSeed: number,
        mapTheme: number,
    };
    clients: Record<ClientID, string>;
    build?: {
        version?: string,
        commit?: string,
        hash?: string,
    };
    start: number;
    end: number;
}

export interface ReplayFile {
    _meta: ReplayMetaData;
    _state: StateData;
    _stream: ClientEvent[];

    // player state:
    _playbackSpeed?: number;
    _paused?: boolean;
    _rewind?: number;
}


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
    replayMetaData.start = 0x7FFFFFFF;
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
    if ((replayMetaData.end - replayMetaData.start) <= 0) {
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

export function readReplayFile(buffer: ArrayBuffer): ReplayFile {
    let ptr = 0;
    const i32 = new Int32Array(buffer);

    // parse metadata
    const metaDataByteLength = i32[ptr++];
    const metaString = new TextDecoder().decode(new Uint8Array(i32.buffer, ptr * 4, metaDataByteLength));
    const meta = JSON.parse(metaString);
    ptr += Math.ceil(metaDataByteLength / 4);

    // parse start state
    const startState = newStateData();
    ptr = readState(startState, i32, ptr);

    // parse input stream
    const stream: ClientEvent[] = [];
    let streamLength = i32[ptr++];
    while (streamLength-- > 0) {
        const tic = i32[ptr++];
        let cl = i32[ptr++];
        while (cl) {
            const input = i32[ptr++];
            stream.push({
                _tic: tic,
                _client: cl,
                _input: input,
            });
            cl = i32[ptr++];
        }
    }

    return {
        _meta: meta,
        _state: startState,
        _stream: stream,
    };
}

export function validateReplayFile(replay: ReplayFile): boolean {
    const meta = replay._meta;
    if (meta) {
        const build = meta.build;
        if (build) {
            if (build.hash !== BuildHash) {
                console.warn("Mismatch game build version to play the replay file");
                if (build.version !== BuildVersion)
                    console.info(build.version + " != " + BuildVersion);
                if (build.commit !== BuildCommit)
                    console.info(build.commit + " != " + BuildCommit);
                return false;
            }
        } else {
            console.error("Replay build info is missing!");
            return false;
        }
    } else {
        console.error("Replay metadata is missing!");
        return false;
    }

    return true;
}


export function openReplayFile(onSuccess: (replay: ReplayFile) => void) {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = _ => {
        if (input.files.length > 0) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const result = e.target.result;
                console.info(result);
                if (result instanceof ArrayBuffer) {
                    const replay = readReplayFile(result);
                    if (validateReplayFile(replay)) {
                        onSuccess(replay);
                    }
                }
            };
            reader.readAsArrayBuffer(input.files[0]);
        }
    }
    input.click();
}