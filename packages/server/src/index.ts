import {createServer, IncomingMessage, OutgoingHttpHeaders, ServerResponse} from "http";
import {
    BuildServerVersion,
    ClientID,
    GameModeFlag,
    MessageField,
    NewGameParams,
    PokiGameId,
    Request,
    RoomsInfoResponse,
    ServerEventName, ServerInfoResponse,
} from "@iioi/shared/types.js";
import {serveFile} from "./static.js";
import {newSeedFromTime, rollSeed32, temper} from "@iioi/shared/seed.js";
import {parseRadix64String, toRadix64String} from "@iioi/shared/radix64.js";

interface ClientState {
    _id: ClientID;
    // last time client or server communicates with client
    _ts: number;
    _eventStream: ServerResponse;
    _nextEventId: number;
    _room: RoomState;
}

const HDR_EVENT_STREAM: OutgoingHttpHeaders = {
    connection: "keep-alive",
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
};

const HDR_JSON_NO_CACHE: OutgoingHttpHeaders = {
    "content-type": "application/json",
    "cache-control": "no-cache",
};

interface RoomState extends NewGameParams {
    _id: number;
    _code: string;
    _mapSeed: number;
    _nextClientIndex: ClientID;
    _clients: Map<ClientID, ClientState>;
}

interface Instance {
    _clientVersion: string;
    _nextRoomId: number;
    _rooms: Map<number, RoomState>;
}

const instances = new Map<string, Instance>();

setInterval(() => {
    for (const [, instance] of instances) {
        for (const [, room] of instance._rooms) {
            for (const [, client] of room._clients) {
                if (performance.now() - client._ts > 5000 || !sendServerEvent(instance, client, ServerEventName.Ping, "")) {
                    removeClient(instance, client);
                }
            }
        }
    }
}, 1000);

const constructMessage = (id: number, data: string) => `id:${id}\ndata:${data}\n\n`;

const sendServerEvent = (instance: Instance, client: ClientState, event: ServerEventName, data: string) =>
    client._eventStream.write(
        constructMessage(client._nextEventId++, event + data),
        // REMOVE CLIENT IN CASE OF ANY ERRORS!
        err => err && removeClient(instance, client),
    );

const broadcastServerEvent = (instance: Instance, room: RoomState, from: ClientID, event: ServerEventName, data: string) => {
    for (const [id, client] of room._clients) {
        if (id != from) {
            sendServerEvent(instance, client, event, data);
        }
    }
};

const removeClient = (instance: Instance, client: ClientState) => {
    try {
        //sendCloseServerEvent(client);
        client._eventStream.write(constructMessage(-1, ""));
        client._eventStream.end();
    } catch {
        // ignore
    }

    const room = client._room;
    room._clients.delete(client._id);
    broadcastServerEvent(instance, client._room, client._id, ServerEventName.ClientListChange, `-${client._id}`);
    console.info(`[room ${room._id}] broadcast client ${client._id} removed`);

    if (!room._clients.size) {
        console.info(`[room ${room._id}] is removed because last player leaved`);
        instance._rooms.delete(room._id);
    }
};

const getRoomsInfo = (params: URLSearchParams, req: IncomingMessage, res: ServerResponse) => {
    let list:Instance[]|undefined;
    if(params.get("v")) {
        const instance = getInstance(params, req, res);
        if (instance) {
            list = [instance];
        } else {
            return;
        }
    }
    else {
        list = [...instances.values()];
    }
    res.writeHead(200, cors(req, {...HDR_JSON_NO_CACHE}));
    const json: ServerInfoResponse = {
        i: [],
    };
    for(const instance of list) {
        const roomsInfo:RoomsInfoResponse = {
            v: instance._clientVersion,
            rooms: [],
            players: 0,
        }
        for (const [, room] of instance._rooms) {
            const players = room._clients.size;
            if ((room._flags & GameModeFlag.Public) === GameModeFlag.Public) {
                roomsInfo.rooms.push({
                    code: room._code,
                    players,
                    max: room._playersLimit,
                });
            }
            roomsInfo.players += players;
        }
        json.i.push(roomsInfo);
    }
    res.write(JSON.stringify(json));
    res.end();
};

const getInstance = (query: URLSearchParams, req: IncomingMessage, res: ServerResponse): Instance | undefined => {
    const v = query.get("v");
    if (v) {
        let instance: Instance | undefined = instances.get(v);
        if (!instance) {
            instance = {
                _clientVersion: v,
                _rooms: new Map(),
                _nextRoomId: 1,
            };
            instances.set(v, instance);
        }
        return instance;
    } else {
        error(req, res, "Invalid client version");
    }
};

interface CreateRoomOptions extends NewGameParams {
    _id?: number;
}

const createRoom = (instance: Instance, options?: CreateRoomOptions): RoomState => {
    const id = options?._id ?? instance._nextRoomId++;
    const flags = options?._flags ?? GameModeFlag.Public;
    const npcLevel = options?._npcLevel ?? 2;
    const playersLimit = options?._playersLimit ?? 8;
    let theme = options?._theme ?? 0;
    theme = theme ? theme - 1 : Math.floor(Math.random() * 3);
    const room: RoomState = {
        _id: id,
        _flags: flags,
        _npcLevel: npcLevel,
        _playersLimit: playersLimit,
        _theme: theme,
        _mapSeed: newSeedFromTime(),
        _code: toRadix64String(temper(rollSeed32(id))),
        _nextClientIndex: 1,
        _clients: new Map(),
    };
    console.info(`[room ${room._id}] created`);
    instance._rooms.set(room._id, room);
    return room;
};

const findRoomByCode = (instance: Instance, code: string): RoomState | undefined => {
    for (const [, r] of instance._rooms) {
        if (r._code === code) {
            return r;
        }
    }
    return undefined;
};

const processServerEvents = (params: URLSearchParams, req: IncomingMessage, res: ServerResponse) => {
    const instance = getInstance(params, req, res);
    if (!instance) {
        return;
    }

    res.writeHead(200, cors(req, HDR_EVENT_STREAM));
    let room: RoomState | undefined;
    const R = params.get("r");
    const C = params.get("c");
    if (R) {
        const v = parseRadix64String(R);
        if (!v) {
            error(req, res, `error parse room #${R}`);
            return;
        }
        room = findRoomByCode(instance, R);
        if (!room) {
            error(req, res, `room #${R} not found`, 404);
            return;
        }
        if (room._clients.size >= room._playersLimit) {
            error(req, res, `room #${R} is full`, 429);
            return;
        }
    } else if (C) {
        const c = decodeURIComponent(C);
        try {
            const data: [number?, number?, number?, number?] = JSON.parse(c);
            const flags: number = data[0] ?? GameModeFlag.Public;
            const playersLimit = data[1] ?? 8;
            const npcLevel = data[2] ?? 2;
            const theme = data[3] ?? 0;
            room = createRoom(instance, {
                _flags: flags,
                _playersLimit: playersLimit,
                _npcLevel: npcLevel,
                _theme: theme,
            });
        } catch {
            error(req, res, `bad room create params: "${c}"`);
            return;
        }
    } else {
        for (const [, r] of instance._rooms) {
            if (r._flags & GameModeFlag.Public && r._clients.size < r._playersLimit) {
                room = r;
                break;
            }
        }
        if (!room) {
            room = createRoom(instance);
        }
    }
    // create new client connection
    const ids: number[] = [...room._clients.keys()];

    const id = room._nextClientIndex++;
    const client: ClientState = {
        _id: id,
        _ts: performance.now(),
        _eventStream: res,
        _nextEventId: 0,
        _room: room,
    };
    room._clients.set(id, client);
    ids.unshift(id);

    req.on("close", () => removeClient(instance, client));

    console.info(`[room ${room._id}] init client ${client._id}`);
    sendServerEvent(
        instance,
        client,
        ServerEventName.ClientInit,
        JSON.stringify([room._code, [room._flags, room._npcLevel, room._theme, room._mapSeed], ids]),
    );

    console.info(`[room ${room._id}] broadcast add client ${client._id}`);
    broadcastServerEvent(instance, room, id, ServerEventName.ClientListChange, "" + id);
};

const readJSON = async (req: IncomingMessage): Promise<Request | undefined> => {
    const buffers = [];
    for await (const chunk of req) {
        buffers.push(chunk);
    }
    const content = Buffer.concat(buffers).toString();
    return JSON.parse(content) as Request;
};

const processIncomeMessages = async (
    params: URLSearchParams,
    req: IncomingMessage,
    res: ServerResponse,
): Promise<void> => {
    const instance = getInstance(params, req, res);
    if (!instance) {
        return;
    }
    const roomCode = params.get("r");
    if (!roomCode || !parseRadix64String(roomCode)) {
        error(req, res, `error parse room code #${params.get("r")}`);
        return;
    }
    const room = findRoomByCode(instance, roomCode);
    if (!room) {
        error(req, res, `room ${roomCode} not found`);
        return;
    }
    try {
        const reqData = await readJSON(req);
        if (!reqData) {
            error(req, res, "No request data for income messages");
            return;
        }
        // process new clients
        const client = room._clients.get(reqData[0]);
        if (!client) {
            // handle on client bad connection state (need to connect again and get new ID)
            console.warn("client is not active: ", reqData[0]);
            res.writeHead(404);
            res.end();
            return;
        }
        client._ts = performance.now();
        let numProcessedMessages = 0;
        if (reqData[1]) {
            for (const msg of reqData[1]) {
                const toClient = room._clients.get(msg[MessageField.Destination]);
                if (toClient) {
                    sendServerEvent(instance, toClient, ServerEventName.ClientUpdate, JSON.stringify(msg));
                }
                ++numProcessedMessages;
            }
        }
        res.writeHead(200, cors(req, HDR_JSON_NO_CACHE));
        res.end("" + numProcessedMessages);
    } catch (e) {
        error(req, res, "Handle income message exception " + e);
    }
};

const error = (req: IncomingMessage, res: ServerResponse, error: Error | string, status = 500) => {
    console.warn(`Generic error on ${req.url} : ${error}`);
    res.writeHead(status);
    res.end();
};

type HandlerFunction = (params: URLSearchParams, req: IncomingMessage, res: ServerResponse) => void | Promise<void>;

const HANDLERS: Record<string, Record<string, HandlerFunction>> = {
    "/_": {
        GET: processServerEvents,
        POST: processIncomeMessages,
    },
    "/i": {
        POST: getRoomsInfo,
    },
};

const hostWhitelist = ["https://eliasku-games.web.app"];
if (PokiGameId) {
    hostWhitelist.push(`https://${PokiGameId}.poki-gdn.com`);
}
if (process.env.NODE_ENV === "development") {
    hostWhitelist.push("http://localhost:8080");
}

const getAllowedOrigin = (req: IncomingMessage): string | undefined => {
    const origin = req.headers.origin;
    if (origin) {
        return hostWhitelist.find(x => origin.startsWith(x));
    }
};

const cors = (req: IncomingMessage, headers: OutgoingHttpHeaders): OutgoingHttpHeaders => {
    const allowedOrigin = getAllowedOrigin(req);
    if (allowedOrigin) {
        return {
            ...headers,
            "Access-Control-Allow-Origin": allowedOrigin,
        };
    }
    return headers;
};

createServer({keepAlive: true}, (req: IncomingMessage, res: ServerResponse) => {
    try {
        const parts = req.url?.split("?") ?? [];
        const url = parts[0];
        const handler = HANDLERS[url];
        if (handler) {
            if (req.method === "OPTIONS") {
                const allowedOrigin = getAllowedOrigin(req);
                if (allowedOrigin) {
                    res.writeHead(200, cors(req, {}));
                } else {
                    res.writeHead(500);
                }
                return;
            }
            const method = handler[req.method ?? "GET"];
            if (method) {
                const params = new URLSearchParams(parts[1] ?? "");
                method(params, req, res);
            } else {
                error(req, res, "Invalid method " + req.method);
            }
        } else {
            serveFile(url, res);
        }
    } catch (e) {
        error(req, res, "Request completed with unhandled exception: " + e);
    }
}).listen(+(process.env.PORT ?? 8080));

// console will be dropped for prod build
console.log(`Server ${BuildServerVersion} http://localhost:8080`);
