import {createServer, IncomingMessage, OutgoingHttpHeaders, ServerResponse} from "http";

import {BuildVersion, ClientID, MessageField, Request, RoomInfo, ServerEventName} from "../../shared/src/types";
import {serveFile} from "./static";
import {rollSeed32, temper} from "@eliasku/13-shared/src/seed";
import {parseRadix64String, toRadix64String} from "@eliasku/13-shared/src/radix64";

interface ClientState {
    id_: ClientID;
    // last time client or server communicates with client
    ts_: number;
    eventStream_: ServerResponse;
    nextEventId_: number;
    room: RoomState;
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

interface RoomState {
    id: number;
    code: string;
    isPublic: boolean;
    playersLimit: number;
    nextClientIndex: ClientID;
    clients: Map<ClientID, ClientState>;
}

let nextRoomId = 1;
const rooms: Map<number, RoomState> = new Map();

setInterval(() => {
    for (const [, room] of rooms) {
        for (const [, client] of room.clients) {
            if ((performance.now() - client.ts_ > 5000) ||
                !sendServerEvent(client, ServerEventName.Ping, "")) {
                removeClient(client);
            }
            // sendServerEvent(client, ServerEventName.Ping, "");
        }
    }
}, 1000);

const constructMessage = (id: number, data: string) =>
    `id:${id}\ndata:${data}\n\n`;

const sendServerEvent = (client: ClientState, event: ServerEventName, data: string) =>
    client.eventStream_.write(
        constructMessage(client.nextEventId_++, event + data),
        // REMOVE CLIENT IN CASE OF ANY ERRORS!
        (err) => err && removeClient(client)
    );

const broadcastServerEvent = (room: RoomState, from: ClientID, event: ServerEventName, data: string) => {
    for (const [id, client] of room.clients) {
        if (id != from) {
            sendServerEvent(client, event, data);
        }
    }
}

const removeClient = (client: ClientState) => {
    try {
        //sendCloseServerEvent(client);
        client.eventStream_.write(
            constructMessage(-1, "")
        );
        client.eventStream_.end();
    } catch {
    }

    const room = client.room;
    room.clients.delete(client.id_);
    broadcastServerEvent(client.room, client.id_, ServerEventName.ClientListChange, `-${client.id_}`);
    console.info(`[room ${room.id}] broadcast client ${client.id_} removed`);

    if (!room.clients.size) {
        console.info(`[room ${room.id}] is removed because last player leaved`);
        rooms.delete(room.id);
    }
}

const readRoomCode = (query: URLSearchParams): number => {
    const roomCode = query.get("r");
    return roomCode ? parseRadix64String(roomCode) : 0;
};

const getRoomsInfo = (params: URLSearchParams, req: IncomingMessage, res: ServerResponse) => {
    res.writeHead(200, HDR_JSON_NO_CACHE);
    const json = {
        rooms: [] as RoomInfo[],
        players: 0
    };
    for (const [, room] of rooms) {
        const players = room.clients.size;
        if (room.isPublic) {
            json.rooms.push({
                code: room.code,
                players,
                max: 8,
            });
        }
        json.players += players;
    }
    res.write(JSON.stringify(json));
    res.end();
};

function validateRequestBuildVersion(query: URLSearchParams, req: IncomingMessage, res: ServerResponse) {
    if (query.get("v") !== BuildVersion) {
        error(req, res, "Build version mismatch");
        return false;
    }
    return true;
}

interface CreateRoomOptions {
    id?: number;
    isPublic?: boolean; // true
    playersLimit?: number; // 8
}

function createRoom(options?: CreateRoomOptions): RoomState {
    const id = options?.id ?? nextRoomId++;
    const isPublic = options?.isPublic ?? true;
    const playersLimit = options?.playersLimit ?? 8;
    const room: RoomState = {
        id,
        isPublic,
        playersLimit,
        code: toRadix64String(temper(rollSeed32(id))),
        nextClientIndex: 1,
        clients: new Map()
    };
    console.info(`[room ${room.id}] created`);
    rooms.set(room.id, room);
    return room;
}

function findRoomByCode(code: string): RoomState | undefined {
    for (const [, r] of rooms) {
        if (r.code === code) {
            return r;
        }
    }
    return undefined;
}

const processServerEvents = (params: URLSearchParams, req: IncomingMessage, res: ServerResponse) => {
    if (!validateRequestBuildVersion(params, req, res)) {
        return;
    }

    res.writeHead(200, HDR_EVENT_STREAM);
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
        if (room.clients.size >= room.playersLimit) {
            error(req, res, `room #${R} is full`, 429);
            return;
        }
    } else if (params.has("c")) {
        room = createRoom({isPublic: params.get("c") === "0"});
    } else {
        for (const [, r] of rooms) {
            if (r.isPublic && r.clients.size < r.playersLimit) {
                room = r;
                break;
            }
        }
        if (!room) {
            room = createRoom();
        }
    }
    // create new client connection
    const list:(string|number)[] = [...room.clients.keys()];

    const id = room.nextClientIndex++;
    const client: ClientState = {
        id_: id,
        ts_: performance.now(),
        eventStream_: res,
        nextEventId_: 0,
        room,
    };
    room.clients.set(id, client);
    list.unshift(id);
    list.unshift(room.code);

    req.on("close", () => removeClient(client));

    console.info(`[room ${room.id}] init client ${client.id_}`);
    sendServerEvent(client, ServerEventName.ClientInit, "" + list);

    console.info(`[room ${room.id}] broadcast add client ${client.id_}`);
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
        const client = room.clients.get(reqData[0]);
        if (!client) {
            // handle on client bad connection state (need to connect again and get new ID)
            console.warn("client is not active: ", reqData[0]);
            res.writeHead(404);
            res.end();
            return;
        }
        client.ts_ = performance.now();
        let numProcessedMessages = 0;
        for (const msg of reqData[1]) {
            const toClient = room.clients.get(msg[MessageField.Destination]);
            if (toClient) {
                sendServerEvent(toClient, ServerEventName.ClientUpdate, JSON.stringify(msg));
            }
            ++numProcessedMessages;
        }
        res.writeHead(200, HDR_JSON_NO_CACHE);
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

createServer((req: IncomingMessage, res: ServerResponse) => {
    try {
        const parts: string[] = req.url.split("?");
        const url = parts[0];
        const handler = HANDLERS[url];
        if (handler) {
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
