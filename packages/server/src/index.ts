import {createServer, IncomingMessage, OutgoingHttpHeaders, ServerResponse} from "http";

import {BuildVersion, ClientID, MessageField, Request, ServerEventName} from "../../shared/src/types";
import {serveFile} from "./static";

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
    nextClientIndex: ClientID;
    clients: Map<ClientID, ClientState>;
}

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

const readRoomId = (query: URLSearchParams) => {
    const roomIdS = query.get("r");
    if (roomIdS) {
        const id = parseInt(roomIdS);
        if (!isNaN(id)) {
            return id;
        }
    }
    return 0;
};

const getRoomsInfo = (params: URLSearchParams, req: IncomingMessage, res: ServerResponse) => {
    res.writeHead(200, HDR_JSON_NO_CACHE);
    const json: any[] = [];
    for (const [id, room] of rooms) {
        json.push({
            id,
            players: room.clients.size,
        });
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

const processServerEvents = (params: URLSearchParams, req: IncomingMessage, res: ServerResponse) => {
    if (!validateRequestBuildVersion(params, req, res)) {
        return;
    }

    res.writeHead(200, HDR_EVENT_STREAM);
    const roomId = readRoomId(params);
    if (!roomId) {
        error(req, res, `error parse room number ${params.get("r")}`);
        return;
    }
    let room = rooms.get(roomId);
    if (!room) {
        room = {
            id: roomId,
            nextClientIndex: 1,
            clients: new Map()
        };
        console.info(`[room ${roomId}] created`);
        rooms.set(roomId, room);
    }
    // create new client connection
    const clientIds = [...room.clients.keys()];

    const id = room.nextClientIndex++;
    const client: ClientState = {
        id_: id,
        ts_: performance.now(),
        eventStream_: res,
        nextEventId_: 0,
        room,
    };
    room.clients.set(id, client);
    clientIds.unshift(id);

    req.on("close", () => removeClient(client));

    console.info(`[room ${roomId}] init client ${client.id_}`);
    sendServerEvent(client, ServerEventName.ClientInit, "" + clientIds);

    console.info(`[room ${roomId}] broadcast add client ${client.id_}`);
    broadcastServerEvent(room, id, ServerEventName.ClientListChange, "" + id);
}

const readJSON = async (req: IncomingMessage): Promise<Request | undefined> => {
    const buffers = [];
    for await (const chunk of req) {
        buffers.push(chunk);
    }
    return JSON.parse(Buffer.concat(buffers).toString()) as Request;
}

const processIncomeMessages = async (params: URLSearchParams, req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (!validateRequestBuildVersion(params, req, res)) {
        return;
    }
    const roomId = readRoomId(params);
    if (!roomId) {
        error(req, res, `error parse room number ${params.get("r")}`);
        return;
    }
    let room = rooms.get(roomId);
    if (!room) {
        error(req, res, `room ${roomId} not found`);
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

const error = (req: IncomingMessage, res: ServerResponse, error: Error | string) => {
    console.warn(`Generic error on ${req.url} : ${error}`);
    res.writeHead(500);
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
