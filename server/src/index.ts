import * as http from "http";
import {IncomingMessage, RequestListener, ServerResponse} from "http";
import * as fs from "fs";
import * as url from 'url';
import {MessageBody, Response, Request, Message, NodeID, NetEvent, ControlCode, NodeState} from "../../src/shared/types";

const defaultPort = 8080;
const port = +process.env.PORT || defaultPort;

let queue: Message[] = [];

let nextNodeId = 1;

const nodes = new Map<NodeID, NodeState>();

function broadcast(from: NodeID, data: MessageBody) {
    for (const nodeId of nodes.keys()) {
        if (nodeId !== from) {
            queue.push({
                from,
                to: nodeId,
                data
            });
        }
    }
}

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type,accept-type",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,HEAD,PUT,PATCH,POST,DELETE",
};

const _404 = (req:IncomingMessage, res:ServerResponse, err?:any) =>{
        res.writeHead(404);
        res.end("not found" + (err ? "\n"+JSON.stringify(err) : ""));
};

const _500: RequestListener = (req, res) =>{
    res.writeHead(500);
    res.end("internal error");
};

const requestListener: RequestListener = async (req, res) => {
    if (req.method === "OPTIONS") {
        res.writeHead(204, corsHeaders);
        res.end();
        return;
    }
    if (req.method === "POST") {
        const buffers = [];
        for await (const chunk of req) {
            buffers.push(chunk);
        }
        const data = Buffer.concat(buffers).toString();
        const reqData: Request = JSON.parse(data);

        if (reqData.control === ControlCode.Connect) {
            const nodeId = reqData.from ?? nextNodeId++;
            nodes.set(nodeId, {
                id: nodeId,
                ts: performance.now()
            });
            broadcast(nodeId, {event: NetEvent.NodeAdded});
            res.writeHead(200, Object.assign({"Content-Type": "application/json"}, corsHeaders));
            const resData: Response = {
                to: nodeId,
                in: 0,
                responses: [...nodes.keys()].filter(id => id !== nodeId).map((id): Message => {
                    return {to: nodeId, from: id, data: {}};
                })
            };
            res.end(JSON.stringify(resData));
            return;
        }
        if (reqData.control === ControlCode.Close) {
            nodes.delete(reqData.from);
            broadcast(reqData.from, {event: NetEvent.NodeRemoved});
            res.writeHead(200, corsHeaders);
            res.end();
            return;
        }

        // process new nodes
        const nodeState = nodes.get(reqData.from);
        if (nodeState) {
            nodeState.ts = performance.now();
        } else {
            console.warn("node is not active: ", reqData.from);
        }

        // else {
        //     nodes[reqData.from] = {
        //         id: reqData.from,
        //         ts: performance.now()
        //     };
        //     broadcast(reqData.from, {event: "node_added"});
        // }

        let inMessagesCount = 0;
        if (reqData.messages) {
            inMessagesCount = reqData.messages.length;
            queue.push(...reqData.messages);
        }
        const newQueue = [];
        let responses: Message[] | undefined = undefined;
        for (const m of queue) {
            if (m.to === reqData.from) {
                if (!responses) {
                    responses = [];
                }
                responses.push(m);
            } else {
                if(nodes.has(m.to)) {
                    newQueue.push(m);
                }
                else {
                    newQueue.push({
                        to: m.from,
                        from: m.to,
                        call: m.call,
                        data: {error:404}
                    });
                }
            }
        }
        queue = newQueue;
        const resData: Response = {
            to: reqData.from,
            in: inMessagesCount,
            responses
        };
        res.writeHead(200, Object.assign({"Content-Type": "application/json"}, corsHeaders));
        res.end(JSON.stringify(resData));
        return;
    }
    if (req.method === "GET") {
        const publicDir = url.fileURLToPath(new URL('.', import.meta.url));
        const filePath = publicDir + (req.url === '/' ? '/index.html' : req.url);
        fs.readFile(filePath, (err, data) => {
            if (err) {
                _404(req, res, err);
                return;
            }
            res.writeHead(200);
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