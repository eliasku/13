import {createServer, IncomingMessage, OutgoingHttpHeaders, ServerResponse} from "http";
import {readFile} from "fs";

import {ClientID, MessageField, Request, ServerEventName} from "../../src/shared/types";

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
        if (!sendServerEvent(client, ServerEventName.Ping, "")) {
            removeClient(client);
        }
    }
}, 5000);

function constructMessage(id: number, data: string) {
    return `id:${id}\ndata:${data}\n\n`;
    // return "id:"+id+"\ndata:"+data+"\n\n";
}


function sendServerEvent(client: ClientState, event: ServerEventName, data: string) {
    return client.eventStream_.write(
        constructMessage(client.nextEventId_++, event + data)
    );
}

function broadcastServerEvent(from: ClientID, event: ServerEventName, data: string) {
    for (const [id, client] of clients) {
        if (id != from) {
            sendServerEvent(client, event, data);
        }
    }
}

function removeClient(client: ClientState) {
    //sendCloseServerEvent(client);
    client.eventStream_.write(
        constructMessage(-1, "")
    );
    client.eventStream_.end();

    clients.delete(client.id_);
    broadcastServerEvent(client.id_, ServerEventName.ClientListChange, "-" + client.id_);
    console.info("broadcast client " + client.id_ + " removed ");
}

function processServerEvents(req: IncomingMessage, res: ServerResponse) {
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
    sendServerEvent(client, ServerEventName.ClientInit, clientIds.join(";"));

    console.info("broadcast add client " + client.id_);
    broadcastServerEvent(id, ServerEventName.ClientListChange, "" + id);
}

async function readJSON(req: IncomingMessage): Promise<Request | undefined> {
    try {
        const buffers = [];
        for await (const chunk of req) {
            buffers.push(chunk);
        }
        const data = Buffer.concat(buffers).toString();
        return JSON.parse(data) as Request;
    } catch {
        console.warn("error decode JSON from /_");
    }
}

async function processIncomeMessages(req: IncomingMessage, res: ServerResponse) {
    const reqData = await readJSON(req);
    if (!reqData) {
        res.writeHead(500);
        res.end();
    }
    // process new clients
    const client = clients.get(reqData[0]);
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
        const toClient = clients.get(msg[MessageField.Destination]);
        if (toClient) {
            sendServerEvent(toClient, ServerEventName.ClientUpdate, JSON.stringify(msg));
        }
        ++numProcessedMessages;
    }
    res.writeHead(200, HDR.n);
    res.end(""+numProcessedMessages);
}

function serveStatic(file: string, res: ServerResponse, mime: OutgoingHttpHeaders) {
    readFile(
        "." + file,
        (err, data) => {
            res.writeHead(err ? 404 : 200, mime);
            res.end(data);
        }
    );
}

function error(req: IncomingMessage, res: ServerResponse) {
    res.writeHead(500);
    res.end();
}

const HANDLERS: any = {
    G: {
        "/": (req: IncomingMessage, res: ServerResponse) => serveStatic("/index.html", res, HDR.l),
        _: processServerEvents,
        l: (req: IncomingMessage, res: ServerResponse) => serveStatic(req.url, res, HDR.l),
        f: (req: IncomingMessage, res: ServerResponse) => serveStatic(req.url, res, HDR.f),
        s: (req: IncomingMessage, res: ServerResponse) => serveStatic(req.url, res, HDR.s),
    },
    P: {
        _: processIncomeMessages,
    }
};

createServer((req: IncomingMessage, res: ServerResponse) => {
    (HANDLERS[req.method[0]][req.url.at(-1)] ?? error)(req, res);
}).listen(+process.env.PORT || 8080);

// console will be dropped for prod build
console.log(`Local server http://localhost:8080`);
