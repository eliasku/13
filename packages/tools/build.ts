import {copyFileSync, readFileSync} from "fs";
import {build, BuildOptions} from 'esbuild';
import {copyPublicAssets, prepareFolders, resolveVersion} from "./common.js";

prepareFolders();
copyPublicAssets();
const buildVersion = resolveVersion();

let report: string[] = [];

const printSize = (label: string, ...files: string[]) => {
    const size = sz(...files);
    console.info(label + ":\t" + size);
    report.push(label + ":\t" + size);
};

function sz(...files: string[]) {
    let total = 0;
    for (const file of files) {
        try {
            const bytes = readFileSync(file);
            total += bytes.length;
        } catch {
            console.warn("file not found:", file);
        }
    }
    return total;
}

{
    console.info("esbuild: server, client, debug");

    const addBuildOptions = (opts: BuildOptions, debug: boolean = false): BuildOptions => {
        opts.bundle = true;
        opts.format = "esm";
        if (!debug) {
            opts.drop = ["debugger"];
            if ((opts.entryPoints as string[])[0] !== "packages/server/src/index.ts") {
                opts.drop.push("console");
            }
            opts.minifySyntax = true;
            opts.minify = true;
            opts.mangleProps = /^_[a-z]/;
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
            outfile: "build/server0.js",
            platform: "node",
            target: "node16",
        })).catch(e => {
            console.warn(e);
            process.exit(1);
        }),
        build(addBuildOptions({
            entryPoints: ["packages/client/src/index.ts"],
            tsconfig: "packages/client/tsconfig.json",
            outfile: "build/client0.js",
            plugins: [],
            target: "es2020"
        })).catch(e => {
            console.warn(e);
            process.exit(1);
        }),
        build(addBuildOptions({
            entryPoints: ["packages/client/src/index.ts"],
            tsconfig: "packages/client/tsconfig.json",
            outfile: "build/debug.js",
            target: "es2020",
            plugins: [],
        }, true)).catch(e => {
            console.warn(e);
            process.exit(1);
        }),
    ]

    await Promise.all(esbuildTasks);
    printSize("build", "public/index.html", "build/client0.js", "build/server0.js");
}

copyFileSync("build/server0.js", "server.js");
copyFileSync("build/client0.js", "public/client.js");
printSize("game", "public/index.html", "public/client.js", "server.js");

console.info(report.join("\n"));
