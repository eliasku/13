import * as http from "http";
import {IncomingMessage, OutgoingHttpHeaders, RequestListener, ServerResponse} from "http";
import * as fs from "fs";
import * as url from 'url';
import {ClientID, PostMessagesResponse, Request, ServerEventName,} from "../../src/shared/types";

const defaultPort = 8080;
const port = +process.env.PORT || defaultPort;

export interface ClientState {
    id: ClientID;
    // last time client or server communicates with node
    ts: number;
    es: ServerResponse;
    ei: number;
}

let nextNodeId = 1;

const nodes = new Map<ClientID, ClientState>();

setInterval(()=>{
    broadcastServerEvent(0, "ping", "");
}, 10000);

function sendCloseServerEvent(id: ClientID) {
    const node = nodes.get(id);
    const res = node.es;
    res.write(`id: -1\ndata: \n\n`);
    res.end();
}

function sendServerEvent(id: ClientID, event: string, data: string) {
    const node = nodes.get(id);
    const res = node.es;
    res.write(`id: ${node.ei++}\nevent: ${event}\ndata: ${data}\n\n`);
}

function broadcastServerEvent(from: ClientID, event: string, data: string) {
    for (const node of nodes.values()) {
        if (node.id !== from) {
            sendServerEvent(node.id, event, data);
        }
    }
}

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type,accept-type",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,HEAD,PUT,PATCH,POST,DELETE",
};

const _404 = (req: IncomingMessage, res: ServerResponse, err?: any) => {
    res.writeHead(404);
    res.end("not found" + (err ? "\n" + JSON.stringify(err) : ""));
};

const _500: RequestListener = (req, res) => {
    res.writeHead(500);
    res.end("internal error");
};

function processServerEvents(req: IncomingMessage, res: ServerResponse) {
    res.writeHead(200, {
        "Connection": "keep-alive",
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
    });

    // create new client connection
    const id = nextNodeId++;
    const client: ClientState = {
        id,
        ts: performance.now(),
        es: res,
        ei: 0
    };

    req.on("close", () => {
        const node = nodes.get(id);
        if (node) {
            sendCloseServerEvent(id);
            nodes.delete(id);
        }
        broadcastServerEvent(id, ServerEventName.ClientRemove, "" + id);
        console.info("broadcast node " + id + " removed ");
    });

    const otherClientIds = [...nodes.keys()];
    nodes.set(id, client);
    sendServerEvent(id, ServerEventName.ClientConnected, id + ";" + otherClientIds.join(";"));
    broadcastServerEvent(id, ServerEventName.ClientAdd, "" + id);
}

async function processIncomeMessages(req: IncomingMessage, res: ServerResponse) {
    const buffers = [];
    for await (const chunk of req) {
        buffers.push(chunk);
    }
    const data = Buffer.concat(buffers).toString();
    const reqData: Request = JSON.parse(data);

    // process new nodes
    const nodeState = nodes.get(reqData.from);
    if (nodeState) {
        nodeState.ts = performance.now();
    } else {
        console.warn("node is not active: ", reqData.from);
    }

    let numProcessedMessages = 0;
    if (reqData.messages) {
        for (const msg of reqData.messages) {
            if (msg.to) {
                const toClient = nodes.get(msg.to);
                if (toClient) {
                    sendServerEvent(msg.to, "update", JSON.stringify(msg));
                }
            }
            ++numProcessedMessages;
        }
    }
    res.writeHead(200, Object.assign({"Content-Type": "application/json"}, corsHeaders));
    const responseData: PostMessagesResponse = {in: numProcessedMessages};
    res.end(JSON.stringify(responseData));
}

const requestListener: RequestListener = async (req, res) => {
    if (req.method === "OPTIONS") {
        res.writeHead(204, corsHeaders);
        res.end();
        return;
    }
    if (req.url === "/_") {
        if (req.method === "GET") {
            processServerEvents(req, res);
        } else if (req.method === "POST") {
            await processIncomeMessages(req, res);
        } else {
            _500(req, res);
        }
        return;
    }

    if (req.method === "GET") {
        const publicDir = url.fileURLToPath(new URL('.', import.meta.url));
        const filePath = publicDir + (req.url === '/' ? '/index.html' : req.url);
        let headers: OutgoingHttpHeaders | undefined = undefined;
        if (filePath.endsWith(".html")) {
            headers = {"content-type": "text/html; charset=utf-8"};
        } else if (filePath.endsWith(".js")) {
            headers = {"content-type": "application/javascript"};
        }
        fs.readFile(filePath, (err, data) => {
            if (err) {
                _404(req, res, err);
                return;
            }
            res.writeHead(200, headers);
            res.end(data);
        });
        return;
    }
    _500(req, res);
};

const server = http.createServer(requestListener);
server.listen(port, () => {
    const info = server.address();
    if (typeof info === "object") {
        console.log(`Server is running on http://localhost:${info.port}`);
    }
});