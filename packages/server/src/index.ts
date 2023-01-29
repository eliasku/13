import {createServer, IncomingMessage, OutgoingHttpHeaders, ServerResponse} from "http";
import {
    BuildHash,
    BuildVersion,
    ClientID,
    GameModeFlag,
    MessageField,
    NewGameParams,
    PokiGameId,
    Request,
    RoomsInfoResponse,
    ServerEventName
} from "../../shared/src/types";
import {serveFile} from "./static";
import {newSeedFromTime, rollSeed32, temper} from "@eliasku/13-shared/src/seed";
import {parseRadix64String, toRadix64String} from "@eliasku/13-shared/src/radix64";

interface ClientState {
    _id: ClientID;
    // last time client or server communicates with client
    _ts: number;
    _eventStream: ServerResponse;
    _nextEventId: number;
    _room: RoomState;
}

const HDR_EVENT_STREAM: OutgoingHttpHeaders = {
    "connection": "keep-alive",
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

let nextRoomId = 1;
const rooms: Map<number, RoomState> = new Map();

setInterval(() => {
    for (const [, room] of rooms) {
        for (const [, client] of room._clients) {
            if ((performance.now() - client._ts > 5000) ||
                !sendServerEvent(client, ServerEventName.Ping, "")) {
                removeClient(client);
            }
        }
    }
}, 1000);

const constructMessage = (id: number, data: string) =>
    `id:${id}\ndata:${data}\n\n`;

const sendServerEvent = (client: ClientState, event: ServerEventName, data: string) =>
    client._eventStream.write(
        constructMessage(client._nextEventId++, event + data),
        // REMOVE CLIENT IN CASE OF ANY ERRORS!
        (err) => err && removeClient(client)
    );

const broadcastServerEvent = (room: RoomState, from: ClientID, event: ServerEventName, data: string) => {
    for (const [id, client] of room._clients) {
        if (id != from) {
            sendServerEvent(client, event, data);
        }
    }
}

const removeClient = (client: ClientState) => {
    try {
        //sendCloseServerEvent(client);
        client._eventStream.write(
            constructMessage(-1, "")
        );
        client._eventStream.end();
    } catch {
    }

    const room = client._room;
    room._clients.delete(client._id);
    broadcastServerEvent(client._room, client._id, ServerEventName.ClientListChange, `-${client._id}`);
    console.info(`[room ${room._id}] broadcast client ${client._id} removed`);

    if (!room._clients.size) {
        console.info(`[room ${room._id}] is removed because last player leaved`);
        rooms.delete(room._id);
    }
}

const getRoomsInfo = (params: URLSearchParams, req: IncomingMessage, res: ServerResponse) => {
    res.writeHead(200, cors(req, {...HDR_JSON_NO_CACHE}));
    const json: RoomsInfoResponse = {
        rooms: [],
        players: 0
    };
    for (const [, room] of rooms) {
        const players = room._clients.size;
        if (room._flags & GameModeFlag.Public) {
            json.rooms.push({
                code: room._code,
                players,
                max: room._playersLimit,
            });
        }
        json.players += players;
    }
    res.write(JSON.stringify(json));
    res.end();
};

function validateRequestBuildVersion(query: URLSearchParams, req: IncomingMessage, res: ServerResponse) {
    if (query.get("v") !== BuildHash) {
        error(req, res, "Build version mismatch");
        return false;
    }
    return true;
}

interface CreateRoomOptions extends NewGameParams {
    _id?: number;
}

function createRoom(options?: CreateRoomOptions): RoomState {
    const id = options?._id ?? nextRoomId++;
    const flags = options?._flags ?? GameModeFlag.Public;
    const npcLevel = options?._npcLevel ?? 2;
    const playersLimit = options?._playersLimit ?? 8;
    let theme = options?._theme ?? 0;
    theme = theme ? (theme - 1) : Math.floor(Math.random() * 3);
    const room: RoomState = {
        _id: id,
        _flags: flags,
        _npcLevel: npcLevel,
        _playersLimit: playersLimit,
        _theme: theme,
        _mapSeed: newSeedFromTime(),
        _code: toRadix64String(temper(rollSeed32(id))),
        _nextClientIndex: 1,
        _clients: new Map()
    };
    console.info(`[room ${room._id}] created`);
    rooms.set(room._id, room);
    return room;
}

function findRoomByCode(code: string): RoomState | undefined {
    for (const [, r] of rooms) {
        if (r._code === code) {
            return r;
        }
    }
    return undefined;
}

const processServerEvents = (params: URLSearchParams, req: IncomingMessage, res: ServerResponse) => {
    if (!validateRequestBuildVersion(params, req, res)) {
        return;
    }

    res.writeHead(200, cors(req, HDR_EVENT_STREAM));
    let room: RoomState | undefined;
    if (params.has("r")) {
        const R = params.get("r");
        const v = parseRadix64String(R);
        if (!v) {
            error(req, res, `error parse room #${R}`);
            return;
        }
        room = findRoomByCode(R);
        if (!room) {
            error(req, res, `room #${R} not found`, 404);
            return;
        }
        if (room._clients.size >= room._playersLimit) {
            error(req, res, `room #${R} is full`, 429);
            return;
        }
    } else if (params.has("c")) {
        const c = decodeURIComponent(params.get("c"));
        try {
            const data: any[] = JSON.parse(c);
            const flags: number = data[0] ?? GameModeFlag.Public;
            const playersLimit = data[1] ?? 8;
            const npcLevel = data[2] ?? 2;
            const theme = data[3] ?? 0;
            room = createRoom({
                _flags: flags,
                _playersLimit: playersLimit,
                _npcLevel: npcLevel,
                _theme: theme
            });
        } catch {
            error(req, res, `bad room create params: "${c}"`);
            return;
        }
    } else {
        for (const [, r] of rooms) {
            if ((r._flags & GameModeFlag.Public) && r._clients.size < r._playersLimit) {
                room = r;
                break;
            }
        }
        if (!room) {
            room = createRoom();
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

    req.on("close", () => removeClient(client));

    console.info(`[room ${room._id}] init client ${client._id}`);
    sendServerEvent(client, ServerEventName.ClientInit, JSON.stringify([
        room._code,
        [room._flags, room._npcLevel, room._theme, room._mapSeed],
        ids
    ]));

    console.info(`[room ${room._id}] broadcast add client ${client._id}`);
    broadcastServerEvent(room, id, ServerEventName.ClientListChange, "" + id);
}

const readJSON = async (req: IncomingMessage): Promise<Request | undefined> => {
    const buffers = [];
    for await (const chunk of req) {
        buffers.push(chunk);
    }
    const content = Buffer.concat(buffers).toString();
    return JSON.parse(content) as Request;
}

const processIncomeMessages = async (params: URLSearchParams, req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (!validateRequestBuildVersion(params, req, res)) {
        return;
    }
    const roomCode = params.get("r");
    if (!roomCode || !parseRadix64String(roomCode)) {
        error(req, res, `error parse room code #${params.get("r")}`);
        return;
    }
    const room = findRoomByCode(roomCode);
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
                    sendServerEvent(toClient, ServerEventName.ClientUpdate, JSON.stringify(msg));
                }
                ++numProcessedMessages;
            }
        }
        res.writeHead(200, cors(req, HDR_JSON_NO_CACHE));
        res.end("" + numProcessedMessages);
    } catch (e) {
        error(req, res, "Handle income message exception " + e);
    }
}

const error = (req: IncomingMessage, res: ServerResponse, error: Error | string, status: number = 500) => {
    console.warn(`Generic error on ${req.url} : ${error}`);
    res.writeHead(status);
    res.end();
}

type HandlerFunction = (params: URLSearchParams, req: IncomingMessage, res: ServerResponse) => any;

const HANDLERS: Record<string, Record<string, HandlerFunction>> = {
    "/_": {
        GET: processServerEvents,
        POST: processIncomeMessages,
    },
    "/i": {
        POST: getRoomsInfo,
    },
};

const hostWhitelist: string[] = [];
if (PokiGameId) {
    hostWhitelist.push(`https://${PokiGameId}.poki-gdn.com`)
}
if (process.env.NODE_ENV === "development") {
    hostWhitelist.push("http://localhost:8080");
}

const getAllowedOrigin = (req: IncomingMessage): string | undefined => {
    if (req.headers.origin) {
        return hostWhitelist.find(x => req.headers.origin.startsWith(x));
    }
}

const cors = (req: IncomingMessage, headers: OutgoingHttpHeaders): OutgoingHttpHeaders => {
    const allowedOrigin = getAllowedOrigin(req);
    if (allowedOrigin) {
        return {
            ...headers,
            "Access-Control-Allow-Origin": allowedOrigin,
        };
    }
    return headers;
}

createServer({keepAlive: true}, (req: IncomingMessage, res: ServerResponse) => {
    try {
        const parts = req.url.split("?");
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
            const method = handler[req.method];
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
}).listen(+process.env.PORT || 8080);

// console will be dropped for prod build
console.log(`Server ${BuildVersion} http://localhost:8080`);
