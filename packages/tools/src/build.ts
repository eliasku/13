import {copyPublicAssets, executeAsync, prepareFolders} from "./common.js";
import {build} from "./rollup.js";

prepareFolders("public");
copyPublicAssets();

console.info("Compile typescript...");
const res = await executeAsync("tsc -b -v");
console.info(res);

console.info("Rollup game");
const buildTasks = [
    build({
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
    build({
        input: "packages/client/src/index.ts",
        tsconfig: "packages/client/tsconfig.json",
        output: "public/client.js",
    }).catch(e => {
        console.warn(e);
        process.exit(1);
    }),
    build({
        input: "packages/client/src/index.ts",
        tsconfig: "packages/client/tsconfig.json",
        output: "public/debug.js",
        debug: true,
    }).catch(e => {
        console.warn(e);
        process.exit(1);
    }),
    (async () => {
        await build({
            input: "packages/bot-api/src/index.ts",
            tsconfig: "packages/bot-api/tsconfig.json",
            output: "packages/bot-api/dist/index.js",
            keepProps: true,
            dts: true,
        });
        await build({
            input: "packages/autoplay/src/index.ts",
            tsconfig: "packages/autoplay/tsconfig.json",
            output: "public/autoplay.js",
        });
    })().catch(e => {
        console.warn(e);
        process.exit(1);
    }),
]

await Promise.all(buildTasks);

console.info("build completed");