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

export function getNameByClientId(client: ClientID) {
    return client === clientId ? clientName : remoteClients.get(client)?._name;
}

export const GameMenuState = {
    InGame: 0,
    Paused: 1,
    Settings: 2,
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
};

export interface Game {
    _clients: Map<ClientID, Client>;
    _localEvents: ClientEvent[];
    _receivedEvents: ClientEvent[];

    _startTic: number;
    _gameTic: number;
    _prevTime: number;
    _joined: boolean;
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
}

export const game: Game = {
    _clients: new Map<ClientID, Client>(),
    _localEvents: [],
    _receivedEvents: [],
    _startTic: -1,
    _gameTic: 0,
    _prevTime: 0,
    _joined: false,
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
    //hotUsable:
    _state: newStateData(),
    //lastState,
};

export const getMyPlayer = (): PlayerActor | undefined => (clientId ? getPlayerByClient(clientId) : undefined);

export const getPlayerByClient = (c: ClientID): PlayerActor | undefined =>
    game._state._actors[ActorType.Player].find(p => p._client == c);

export const getMinTic = (_tic: number = 1 << 30) => {
    if (gameMode._replay) {
        return game._gameTic;
    }
    if (!clientId || !game._joined) {
        _tic = game._gameTic + Const.InputDelay + (((lastFrameTs - game._prevTime) * Const.NetFq) | 0);
    }
    let clientsTotal = 0;
    for (const [, client] of game._clients) {
        if (client._isPlaying) {
            ++clientsTotal;
            if (_tic > client._tic) {
                _tic = client._tic;
            }
        }
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
