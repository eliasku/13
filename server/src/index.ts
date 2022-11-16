import {createServer, IncomingMessage, OutgoingHttpHeaders, ServerResponse} from "http";
import {readFile} from "fs";

import {BuildVersion, ClientID, MessageField, Request, ServerEventName} from "../../shared/types";

interface ClientState {
    id_: ClientID;
    // last time client or server communicates with client
    ts_: number;
    eventStream_: ServerResponse;
    nextEventId_: number;
}

const HDR: Record<string, OutgoingHttpHeaders> = {
    _: {
        "connection": "keep-alive",
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
    },
    n: {
        "content-type": "application/json"
    },
    l: {
        "content-type": "text/html;charset=utf-8",
        "cache-control": "no-cache",
    },
    s: {
        "cache-control": "no-cache"
    },
    f: {
        "content-type": "font/ttf",
        "cache-control": "max-age=86400"
    },
};

let nextClientId = 1;

const clients = new Map<ClientID, ClientState>();

setInterval(() => {
    for (const [, client] of clients) {
        if ((performance.now() - client.ts_ > 5000) ||
            !sendServerEvent(client, ServerEventName.Ping, "")) {
            removeClient(client);
        }
        // sendServerEvent(client, ServerEventName.Ping, "");
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

const broadcastServerEvent = (from: ClientID, event: ServerEventName, data: string) => {
    for (const [id, client] of clients) {
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

    clients.delete(client.id_);
    broadcastServerEvent(client.id_, ServerEventName.ClientListChange, "-" + client.id_);
    console.info("broadcast client " + client.id_ + " removed ");
}

const processGameInfo = (req: IncomingMessage, res: ServerResponse) => {
    res.writeHead(200, {
        "content-type": "application/json",
        "cache-control": "no-cache",
    });
    res.write(`{"on":${clients.size}}`);
    res.end();
};

const processServerEvents = (req: IncomingMessage, res: ServerResponse) => {
    const query = new URLSearchParams(req.url.split("?")[1] ?? "");
    if (query.get("v") !== BuildVersion) {
        res.writeHead(500);
        return;
    }

    res.writeHead(200, HDR._);

    // create new client connection
    const clientIds = [...clients.keys()];

    const id = nextClientId++;
    const client: ClientState = {
        id_: id,
        ts_: performance.now(),
        eventStream_: res,
        nextEventId_: 0
    };
    clients.set(id, client);
    clientIds.unshift(id);

    req.on("close", () => removeClient(client));

    console.info("init client " + client.id_);
    sendServerEvent(client, ServerEventName.ClientInit, "" + clientIds);

    console.info("broadcast add client " + client.id_);
    broadcastServerEvent(id, ServerEventName.ClientListChange, "" + id);
}

const readJSON = async (req: IncomingMessage): Promise<Request | undefined> => {
    const buffers = [];
    for await (const chunk of req) {
        buffers.push(chunk);
    }
    return JSON.parse(Buffer.concat(buffers).toString()) as Request;
}

const processIncomeMessages = (req: IncomingMessage, res: ServerResponse) =>
    readJSON(req).then((reqData) => {
        if (!reqData) {
            res.writeHead(500);
            res.end();
        }
        // process new clients
        const client = clients.get(reqData[0]);
        if (client) {
            client.ts_ = performance.now();
            let numProcessedMessages = 0;
            for (const msg of reqData[1]) {
                const toClient = clients.get(msg[MessageField.Destination]);
                if (toClient) {
                    sendServerEvent(toClient, ServerEventName.ClientUpdate, JSON.stringify(msg));
                }
                ++numProcessedMessages;
            }
            res.writeHead(200, HDR.n);
            res.end("" + numProcessedMessages);
        } else {
            // handle on client bad connection state (need to connect again and get new ID)
            console.warn("client is not active: ", reqData[0]);
            res.writeHead(404);
            res.end();
        }
    }).catch(() => {
        console.warn("error handle income message /_");
    });

const serveStatic = (file: string, res: ServerResponse, mime: OutgoingHttpHeaders) =>
    readFile(
        "./public" + file,
        (err, data) => {
            res.writeHead(err ? 404 : 200, mime);
            res.end(data);
        }
    );

const error = (req: IncomingMessage, res: ServerResponse) => {
    res.writeHead(500);
    res.end();
}

const HANDLERS: any = {
    GET: {
        "/": (req: IncomingMessage, res: ServerResponse) => serveStatic("/index.html", res, HDR.l),
        _: processServerEvents,
        l: (req: IncomingMessage, res: ServerResponse) => serveStatic(req.url, res, HDR.l),
        f: (req: IncomingMessage, res: ServerResponse) => serveStatic(req.url, res, HDR.f),
        s: (req: IncomingMessage, res: ServerResponse) => serveStatic(req.url, res, HDR.s),
    },
    POST: {
        "/": (req: IncomingMessage, res: ServerResponse) => serveStatic("/index.html", res, HDR.l),
        _: processIncomeMessages,
        i: processGameInfo,
    }
};

createServer((req: IncomingMessage, res: ServerResponse) => {
    try {
        const handler = HANDLERS[req.method];
        if (handler) {
            const url = req.url.split("?")[0];
            const pathnameId = url.at(-1);
            handler[pathnameId](req, res);
        } else {
            error(req, res);
        }
    }
    catch(e) {
        console.warn("Request error");
        console.trace(e);
        error(req, res);
    }
}).listen(+process.env.PORT || 8080);

// console will be dropped for prod build
console.log(`Server ${BuildVersion} http://localhost:8080`);
