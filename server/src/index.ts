import * as http from "http";
import {IncomingMessage, OutgoingHttpHeaders, RequestListener, ServerResponse} from "http";
import * as fs from "fs";
import * as url from 'url';
import {
    ClientID,
    EventSourceUrl,
    MessageField,
    PostMessagesResponse,
    Request,
    ServerEventName
} from "../../src/shared/types";

interface ClientState {
    id_: ClientID;
    // last time client or server communicates with client
    ts_: number;
    eventStream_: ServerResponse;
    nextEventId_: number;
}

let nextClientId = 1;

const clients = new Map<ClientID, ClientState>();

setInterval(() => {
    for (const client of clients.values()) {
        if (!sendServerEvent(client, ServerEventName.Ping, "")) {
            removeClient(client);
        }
    }
}, 5000);

function constructMessage(id: number, data: string) {
    return `id:${id}\ndata:${data}\n\n`;
}

function sendCloseServerEvent(client: ClientState) {
    client.eventStream_.write(
        constructMessage(-1, "")
    );
    client.eventStream_.end();
}

function sendServerEvent(client: ClientState, event: ServerEventName, data: string) {
    return client.eventStream_.write(
        constructMessage(client.nextEventId_++, event + data)
    );
}

function broadcastServerEvent(from: ClientID, event: ServerEventName, data: string) {
    for (const client of clients.values()) {
        if (client.id_ !== from) {
            sendServerEvent(client, event, data);
        }
    }
}

function removeClient(client: ClientState) {
    sendCloseServerEvent(client);
    clients.delete(client.id_);
    broadcastServerEvent(client.id_, ServerEventName.ClientListChange, "-" + client.id_);
    console.info("broadcast client " + client.id_ + " removed ");
}

function processServerEvents(req: IncomingMessage, res: ServerResponse) {
    res.writeHead(200, {
        "connection": "keep-alive",
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
    });

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
        console.warn("error decode JSON from /0");
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
    res.writeHead(200, {"Content-Type": "application/json"});
    const responseData: PostMessagesResponse = {a: numProcessedMessages};
    res.end(JSON.stringify(responseData));
}

const requestListener: RequestListener = async (req, res) => {
    if (req.url === EventSourceUrl) {
        if (req.method === "GET") {
            processServerEvents(req, res);
        } else if (req.method === "POST") {
            await processIncomeMessages(req, res);
        } else {
            res.writeHead(500);
            res.end();
        }
    } else if (req.method === "GET") {
        const publicDir = url.fileURLToPath(new URL('.', import.meta.url));
        const filePath = publicDir + (req.url === '/' ? '/index.html' : req.url);
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end();
            } else {
                let headers: OutgoingHttpHeaders = {};
                if (filePath.endsWith(".html")) {
                    headers["content-type"] = "text/html;charset=utf-8";
                    headers["cache-control"] = "no-cache";
                } else if (filePath.endsWith(".js")) {
                    // headers["content-type"] = "application/javascript";
                    headers["cache-control"] = "no-cache";
                } else if (filePath.endsWith(".ttf")) {
                    // headers["content-type"] = "font/ttf";
                    headers["cache-control"] = "max-age=86400";
                }
                res.writeHead(200, headers);
                res.end(data);
            }
        });
    } else {
        res.writeHead(500);
        res.end();
    }
};

const server = http.createServer(requestListener);
server.listen(+process.env.PORT || 8080);

// console will be dropped for prod build
console.log(`Local server http://localhost:8080`);
