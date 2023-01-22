import {spawn} from "child_process";
import {BuildOptions, context, PluginBuild} from 'esbuild';
import {copyPublicAssets, prepareFolders, resolveVersion} from "./common.js";

prepareFolders();
copyPublicAssets();
const buildVersion = resolveVersion();

{
    console.info("esbuild: server, client, debug");

    const addBuildOptions = (opts: BuildOptions, debug: boolean = false): BuildOptions => {
        opts.bundle = true;
        opts.format = "esm";
        if (!debug) {
            opts.drop = ["debugger"];
            // if ((opts.entryPoints as string[])[0] !== "server/src/index.ts") {
            //     opts.drop.push("console");
            // }
            // opts.minify = true;
            opts.minifySyntax = true;
        }
        opts.define = {
            __SERVER_URL__: `""`,
            __VERSION__: `"${buildVersion}"`,
            "process.env.NODE_ENV": debug ? `"development"` : `"production"`,
        };
        opts.plugins = [{
            name: 'watch-errors',
            setup(build: PluginBuild) {
                let count = 0;
                build.onEnd(result => {
                    if (result.errors.length > 0) console.error('watch build failed:');
                    else console.log('watch build succeeded');
                });
            },
        }];
        return opts;
    }

    const esbuildTasks = [
        context(addBuildOptions({
            entryPoints: ["packages/server/src/index.ts"],
            tsconfig: "packages/server/tsconfig.json",
            outfile: "server.js",
            platform: "node",
            target: "node16",
        })).then(_ => _.watch()).catch(e => {
            console.warn(e);
            process.exit(1);
        }),
        context(addBuildOptions({
            entryPoints: ["packages/client/src/index.ts"],
            tsconfig: "packages/client/tsconfig.json",
            outfile: "public/client.js",
            plugins: [],
        })).then(_ => _.watch()).catch(e => {
            console.warn(e);
            process.exit(1);
        }),
        context(addBuildOptions({
            entryPoints: ["packages/client/src/index.ts"],
            tsconfig: "packages/client/tsconfig.json",
            outfile: "public/debug.js",
            plugins: [],
        }, true)).then(_ => _.watch()).catch(e => {
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
