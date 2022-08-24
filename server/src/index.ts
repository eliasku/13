import * as http from "http";
import {IncomingMessage, OutgoingHttpHeaders, RequestListener, ServerResponse} from "http";
import * as fs from "fs";
import * as url from 'url';
import {ClientID, EventSourceUrl, PostMessagesResponse, Request, ServerEventName} from "../../src/shared/types";

const defaultPort = 8080;
const port = +process.env.PORT || defaultPort;

export interface ClientState {
    id: ClientID;
    // last time client or server communicates with client
    ts: number;
    es: ServerResponse;
    ei: number;
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

function sendCloseServerEvent(client: ClientState) {
    client.es.write(`id: -1\ndata: \n\n`);
    client.es.end();
}

function sendServerEvent(client: ClientState, event: ServerEventName, data: string) {
    return client.es.write(`id: ${client.ei++}\nevent: ${event}\ndata: ${data}\n\n`);
}

function broadcastServerEvent(from: ClientID, event: ServerEventName, data: string) {
    for (const client of clients.values()) {
        if (client.id !== from) {
            sendServerEvent(client, event, data);
        }
    }
}

function removeClient(client: ClientState) {
    sendCloseServerEvent(client);
    clients.delete(client.id);
    broadcastServerEvent(client.id, ServerEventName.ClientRemove, "" + client.id);
    console.info("broadcast client " + client.id + " removed ");
}

function processServerEvents(req: IncomingMessage, res: ServerResponse) {
    res.writeHead(200, {
        "Connection": "keep-alive",
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
    });

    // create new client connection
    const id = nextClientId++;
    const client: ClientState = {
        id,
        ts: performance.now(),
        es: res,
        ei: 0
    };

    const otherClientIds = [...clients.keys()];
    clients.set(id, client);

    req.on("close", () => removeClient(client));
    sendServerEvent(client, ServerEventName.ClientConnected, id + ";" + otherClientIds.join(";"));
    broadcastServerEvent(id, ServerEventName.ClientAdd, "" + id);
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
        console.warn("error decode JSON from /1");
    }
}

async function processIncomeMessages(req: IncomingMessage, res: ServerResponse) {
    const reqData = await readJSON(req);
    if (!reqData) {
        res.write(500);
        res.end();
    }
    // process new clients
    const client = clients.get(reqData.s);
    if (client) {
        client.ts = performance.now();
    } else {
        // handle on client bad connection state (need to connect again and get new ID)
        console.warn("client is not active: ", reqData.s);
        res.writeHead(404);
        res.end();
        return;
    }

    let numProcessedMessages = 0;
    if (reqData.a) {
        for (const msg of reqData.a) {
            if (msg.d) {
                const toClient = clients.get(msg.d);
                if (toClient) {
                    sendServerEvent(toClient, ServerEventName.ClientUpdate, JSON.stringify(msg));
                }
            }
            ++numProcessedMessages;
        }
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
                let headers: OutgoingHttpHeaders = {"Cache-Control": "no-cache"};
                if (filePath.endsWith(".html")) {
                    headers["Content-Type"] = "text/html; charset=utf-8";
                } else if (filePath.endsWith(".js")) {
                    headers["Content-Type"] = "application/javascript";
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
server.listen(port, () => {
    const info = server.address();
    if (typeof info === "object") {
        console.log(`Server is running on http://localhost:${info.port}`);
    }
});