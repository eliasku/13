import {exec} from "child_process";
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
            if ((opts.entryPoints as string[])[0] !== "server/src/index.ts") {
                opts.drop.push("console");
            }
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
            entryPoints: ["server/src/index.ts"],
            outfile: "server.js",
            tsconfig: "server/tsconfig.json",
            platform: "node",
            target: "node16",
        })).catch(e => {
            console.warn(e);
            process.exit(1);
        }),
        build(addBuildOptions({
            entryPoints: ["client/src/index.ts"],
            outfile: "public/client.js",
            tsconfig: "client/tsconfig.json",
            plugins: [],
        })).catch(e => {
            console.warn(e);
            process.exit(1);
        }),
        build(addBuildOptions({
            entryPoints: ["client/src/index.ts"],
            outfile: "public/debug.js",
            tsconfig: "client/tsconfig.json",
            plugins: [],
        }, true)).catch(e => {
            console.warn(e);
            process.exit(1);
        }),
    ];

    await Promise.all(esbuildTasks);
}

console.info("watching... " + process.cwd());

exec("node ./server.js");
