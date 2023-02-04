import {spawn} from "child_process";
import {copyPublicAssets, executeAsync, prepareFolders} from "./common.js";
import {watch} from "./rollup.js";

prepareFolders("public");
copyPublicAssets();

console.info("Compile typescript...");
const res = await executeAsync("tsc -b -v");
console.info(res);
console.info("Continue watching Typescript in background...");
executeAsync("tsc -b -w -v");

console.info("Start watch game bundle");

const watchTasks = [
    watch({
        input: "packages/server/src/index.ts",
        tsconfig: "packages/server/tsconfig.json",
        output: "server.js",
        platform: "node",
        target: "node16",
        keepConsole: true,
    }).catch(e => {
        console.warn(e);
        process.exit(1);
    }),
    watch({
        input: "packages/client/src/index.ts",
        tsconfig: "packages/client/tsconfig.json",
        output: "public/client.js",
        keepConsole: true,
    }).catch(e => {
        console.warn(e);
        process.exit(1);
    }),
    watch({
        input: "packages/client/src/index.ts",
        tsconfig: "packages/client/tsconfig.json",
        output: "public/debug.js",
        debug: true,
    }).catch(e => {
        console.warn(e);
        process.exit(1);
    }),
    watch({
        input: "packages/bot-api/src/index.ts",
        tsconfig: "packages/bot-api/tsconfig.json",
        output: "packages/bot-api/dist/index.js",
        keepProps: true,
        dts: true,
    }).catch(e => {
        console.warn(e);
        process.exit(1);
    }),
    watch({
        input: "packages/autoplay/src/index.ts",
        tsconfig: "packages/autoplay/tsconfig.json",
        output: "public/autoplay.js",
    }).catch(e => {
        console.warn(e);
        process.exit(1);
    }),
];

await Promise.all(watchTasks);

console.info("First build OK. watching... " + process.cwd());

const server = spawn("node", ["./server.js"]);
server.stdout.on('data', data => process.stdout.write(data));
server.stderr.on('data', data => process.stderr.write(data));
server.on('exit', code => console.log('[SERVER] process exited with code ' + code?.toString()));
