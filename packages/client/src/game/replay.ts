import {ClientEvent} from "./types";
import {ClientID} from "@eliasku/13-shared/src/types";

interface ReplayEvent {
    client: ClientID;
    input: number;
}

const replayEvents = new Map<number, ReplayEvent[]>();

export function beginRecording() {
    replayEvents.clear();
}

export function recordEvents(tic: number, events: ClientEvent[]) {
    // if (events.length) {
    //     const copy = events.map(e => ({client: e._client, input: e._input}));
    //     replayEvents.set(tic, copy);
    // }
}

export function endRecording() {
    // const content = JSON.stringify(Object.fromEntries(replayEvents.entries()));
    // const a = document.createElement("a");
    // const file = new Blob([content], {type: "application/json"});
    // a.href = URL.createObjectURL(file);
    // a.download = "replay.json";
    // a.click();
}