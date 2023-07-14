import {ClientEvent, newStateData, StateData} from "../types.js";
import {readState} from "../packets.js";
import {BuildCommit, BuildHash, BuildClientVersion, ClientID} from "@iioi/shared/types.js";

export interface ReplayMetaData {
    room?: {
        flags: number;
        npcLevel: number;
        mapSeed: number;
        mapTheme: number;
    };
    clients: Record<ClientID, string>;
    build?: {
        version?: string;
        commit?: string;
        hash?: string;
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

export const readReplayFile = (buffer: ArrayBuffer): ReplayFile => {
    let ptr = 0;
    const i32 = new Int32Array(buffer);

    // parse metadata
    const metaDataByteLength = i32[ptr++];
    const metaString = new TextDecoder().decode(new Uint8Array(i32.buffer, ptr * 4, metaDataByteLength));
    console.info(metaString);
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
};

export const validateReplayFile = (replay: ReplayFile): boolean => {
    const meta = replay._meta;
    if (meta) {
        const build = meta.build;
        if (build) {
            if (build.hash !== BuildHash) {
                console.warn("Mismatch game build version to play the replay file");
                if (build.version !== BuildClientVersion) console.info(build.version + " != " + BuildClientVersion);
                if (build.commit !== BuildCommit) console.info(build.commit + " != " + BuildCommit);
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
};

export const openReplayFile = (onSuccess: (replay: ReplayFile) => void) => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = () => {
        if (input.files && input.files.length > 0) {
            const reader = new FileReader();
            reader.onload = e => {
                const result = e.target?.result;
                if (result instanceof ArrayBuffer) {
                    const replay = readReplayFile(result);
                    if (validateReplayFile(replay)) {
                        console.info("Replay loaded - OK");
                        onSuccess(replay);
                    }
                }
            };
            reader.readAsArrayBuffer(input.files[0]);
        }
    };
    input.click();
};
