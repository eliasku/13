import * as http from "http";
import {RequestListener} from "http";
import * as fs from "fs";
import * as url from 'url';

//const host = "127.0.0.1";
const port = +process.env.PORT || 8081;

let queue: Message[] = [];

type NodeID = string | "_";
type Receiver = NodeID | "*" | "_";

let nextNodeId = 1;

const enum NetEvent {
    NodeRemoved = 0,
    NodeAdded = 1,
}

const enum ControlCode {
    Connect = 0,
    Close = 1,
}

interface NodeState {
    id: NodeID;
    ts: number;
}

const nodes = new Map<NodeID, NodeState>();

interface Message {
    id: string;
    from: NodeID;
    to: Receiver;
    data: any;
}

interface Request {
    from: NodeID;
    messages?: Message[];
    control?: ControlCode;
}

interface Response {
    to: NodeID;
    in: number;
    responses?: Message[];
}

function broadcast(from: NodeID, data: any) {
    for (const nodeId of nodes.keys()) {
        if (nodeId !== from) {
            queue.push({
                id: "",
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
            const nodeId = reqData.from || "" + (nextNodeId++);
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
                    return {to: nodeId, from: id, id: "", data: {}};
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
                newQueue.push(m);
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
                res.writeHead(404);
                res.end(JSON.stringify(err));
                return;
            }
            res.writeHead(200);
            res.end(data);
        });
        return;
    }
    res.writeHead(500);
    res.end("internal error");
};

const server = http.createServer(requestListener);
server.listen(port, () => {
    const info = server.address();
    if (typeof info === "object") {
        console.log(`Server is running on http://localhost:${info.port}`);
    }
});