import {exec, execSync} from "child_process";
import {copyFileSync, readFileSync, mkdirSync} from "fs";
import {build, BuildOptions} from 'esbuild';

// create build dir
try {
    mkdirSync("build");
} catch {
}

let buildVersion = "0.0.0";

try {
    const pkg = JSON.parse(readFileSync("package.json", "utf-8")) as { version: string };
    buildVersion = pkg.version;
    console.info("build version: " + buildVersion);
} catch {
}

{
    // copy html
    console.info("build html files");
    execSync(`html-minifier --collapse-whitespace --remove-comments --remove-optional-tags --remove-redundant-attributes --remove-script-type-attributes --remove-tag-whitespace --use-short-doctype --minify-css true --minify-js true -o public/index.html html/index.html`);
    copyFileSync("html/index4.html", "public/index4.html");
    copyFileSync("html/debug4.html", "public/debug4.html");
    copyFileSync("html/debug.html", "public/debug.html");
}

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
            entryPoints: ["src/lib/index.ts"],
            outfile: "public/client.js",
            tsconfig: "tsconfig.json",
            plugins: [],
        })).catch(e => {
            console.warn(e);
            process.exit(1);
        }),
        build(addBuildOptions({
            entryPoints: ["src/lib/index.ts"],
            outfile: "public/debug.js",
            tsconfig: "tsconfig.json",
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
