import {OutgoingHttpHeaders, ServerResponse} from "http";
import * as path from "path";
import {readFile} from "fs";

const TYPE_HEADERS: Record<string, OutgoingHttpHeaders> = {
    ".json": {
        "content-type": "application/json"
    },
    ".html": {
        "content-type": "text/html;charset=utf-8",
        "cache-control": "no-cache",
    },
    ".js": {
        "cache-control": "no-cache"
    },
    ".map": {
        "cache-control": "no-cache"
    },
    ".ttf": {
        "content-type": "font/ttf",
        "cache-control": "max-age=86400"
    },
    ".png": {
        "content-type": "image/png",
        "cache-control": "no-cache"
    },
    ".dat": {
        "content-type": "application/octet-stream",
        "cache-control": "no-cache"
    },
};

const BASE_PATH = "./public";
const ROUTE_MAPPING: Record<string, string> = {
    "/": "/index.html"
};

export const serveFile = (file: string, res: ServerResponse): void => {
    file = ROUTE_MAPPING[file] ?? file;
    const ext = path.extname(file);
    const mime = TYPE_HEADERS[ext];
    if (!mime) {
        console.warn(`Unknown file type "${ext}"`);
        res.writeHead(500);
        res.end();
        return;
    }
    readFile(BASE_PATH + file,
        (err, data) => {
            if (err) {
                console.warn(`Static file "${file}" serve error: ${err}`);
                res.writeHead(404);
                res.end();
            } else {
                res.writeHead(200, mime);
                res.end(data);
            }
        });
}
