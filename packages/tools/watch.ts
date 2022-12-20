import {spawn} from "child_process";
import {build, BuildOptions} from 'esbuild';
import {copyPublicAssets, prepareFolders, resolveVersion} from "./common.js";

prepareFolders();
copyPublicAssets();
const buildVersion = resolveVersion();

{
    console.info("esbuild: server, client, debug");

    const addBuildOptions = (opts: BuildOptions, debug: boolean = false): BuildOptions => {
        opts.bundle = true;
        opts.format = "esm";
        opts.watch = {
            onRebuild(error, result) {
                if (error) console.error('watch build failed:', error)
                else console.log('watch build succeeded:', result)
            }
        };
        if (!debug) {
            opts.drop = ["debugger"];
            // if ((opts.entryPoints as string[])[0] !== "server/src/index.ts") {
            //     opts.drop.push("console");
            // }
            // opts.minify = true;
            opts.minifySyntax = true;
        }
        opts.define = {
            __VERSION__: `"${buildVersion}"`,
            "process.env.NODE_ENV": debug ? `"development"` : `"production"`,
        };
        return opts;
    }

    const esbuildTasks = [
        build(addBuildOptions({
            entryPoints: ["packages/server/src/index.ts"],
            tsconfig: "packages/server/tsconfig.json",
            outfile: "server.js",
            platform: "node",
            target: "node16",
        })).catch(e => {
            console.warn(e);
            process.exit(1);
        }),
        build(addBuildOptions({
            entryPoints: ["packages/client/src/index.ts"],
            tsconfig: "packages/client/tsconfig.json",
            outfile: "public/client.js",
            plugins: [],
        })).catch(e => {
            console.warn(e);
            process.exit(1);
        }),
        build(addBuildOptions({
            entryPoints: ["packages/client/src/index.ts"],
            tsconfig: "packages/client/tsconfig.json",
            outfile: "public/debug.js",
            plugins: [],
        }, true)).catch(e => {
            console.warn(e);
            process.exit(1);
        }),
    ];

    await Promise.all(esbuildTasks);
}

console.info("watching... " + process.cwd());

const server = spawn("node", ["./server.js"]);
server.stdout.on('data', data => process.stdout.write(data));
server.stderr.on('data', data => process.stderr.write(data));
server.on('exit', code => console.log('[SERVER] process exited with code ' + code.toString()));
