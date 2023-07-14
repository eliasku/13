import {ClientID} from "@iioi/shared/types.js";
import {clientId, clientName, remoteClients} from "../net/messaging.js";
import {ReplayFile} from "./replay/replayFile.js";
import {
    Actor,
    ActorType,
    BarrelActor,
    Client,
    ClientEvent,
    ItemActor,
    newStateData,
    PlayerActor,
    StateData,
} from "@iioi/client/game/types.js";
import {Const} from "@iioi/client/game/config.js";
import {roundActors} from "@iioi/client/game/phy.js";

export let lastFrameTs = 0.0;

export const resetLastFrameTs = () => {
    lastFrameTs = 0.0;
};

export const updateFrameTime = (ts: number) => {
    if (ts > lastFrameTs) {
        lastFrameTs = ts;
    }
};

export const getNameByClientId = (client: ClientID) =>
    client === clientId ? clientName : remoteClients.get(client)?._name;

export const GameMenuState = {
    InGame: 0,
    Paused: 1,
    Settings: 2,
    Respawn: 3,
} as const;
export type GameMenuState = (typeof GameMenuState)[keyof typeof GameMenuState];

export interface GameMode {
    _title: boolean;
    _runAI: boolean;
    _playersAI: boolean;
    _hasPlayer: boolean;
    _tiltCamera: number;
    _bloodRain: boolean;
    _npcLevel: number;
    _replay?: ReplayFile;
    _menu: GameMenuState;
    _respawnStartTic: number;
}

export const gameMode: GameMode = {
    _title: false,
    _runAI: false,
    _playersAI: false,
    _hasPlayer: false,
    _tiltCamera: 0.0,
    _bloodRain: false,
    _npcLevel: 0,
    _menu: GameMenuState.InGame,
    _respawnStartTic: 0,
};

export const JoinState = {
    Wait: 0,
    LoadingState: 1,
    Sync: 2,
    Joined: 3,
} as const;
export type JoinState = (typeof JoinState)[keyof typeof JoinState];

export interface Game {
    _clients: Map<ClientID, Client>;
    _localEvents: ClientEvent[];
    _receivedEvents: ClientEvent[];

    _joinState: JoinState;
    _gameTic: number;
    _prevTime: number;
    _waitToAutoSpawn: boolean;
    _waitToSpawn: boolean;
    _allowedToRespawn: boolean;
    _lastInputTic: number;
    _lastInputCmd: number;
    _lastAudioTic: number;
    _trees: Actor[];
    _playersGrid: PlayerActor[][];
    _barrelsGrid: BarrelActor[][];
    _treesGrid: Actor[][];
    _hotUsable?: ItemActor;
    _state: StateData;
    _lastState?: StateData;

    _blocks: number[];

    _processingPrediction: boolean;
}

export const game: Game = {
    _clients: new Map<ClientID, Client>(),
    _localEvents: [],
    _receivedEvents: [],
    _joinState: JoinState.Wait,
    _gameTic: 0,
    _prevTime: 0,
    _waitToAutoSpawn: false,
    _waitToSpawn: false,
    _allowedToRespawn: false,
    _lastInputTic: 0,
    _lastInputCmd: 0,
    _lastAudioTic: 0,
    _trees: [],
    _playersGrid: [],
    _barrelsGrid: [],
    _treesGrid: [],
    _state: newStateData(),
    _blocks: [],
    _processingPrediction: false,
};

export const getMyPlayer = (): PlayerActor | undefined => (clientId ? getPlayerByClient(clientId) : undefined);

export const getPlayerByClient = (c: ClientID): PlayerActor | undefined =>
    game._state._actors[ActorType.Player].find(p => p._client == c);

export const getMinTic = (_tic: number = 1 << 30) => {
    if (gameMode._replay) {
        return game._gameTic;
    }
    if (!clientId) {
        // || !game._joined) {
        _tic = game._gameTic + Const.InputDelay + (((lastFrameTs - game._prevTime) * Const.NetFq) | 0);
    }
    let clientsTotal = 0;
    for (const [, client] of game._clients) {
        // if (client._ready) {
        ++clientsTotal;
        if (_tic > client._tic) {
            _tic = client._tic;
        }
        // }
    }
    if (!clientsTotal) {
        _tic = game._gameTic + (((lastFrameTs - game._prevTime) * Const.NetFq) | 0);
    }
    return _tic;
};

export const normalizeStateData = (state: StateData) => {
    for (const list of state._actors) {
        // sort by id
        list.sort((a: Actor, b: Actor): number => a._id - b._id);
        // normalize properties
        roundActors(list);
    }
};
