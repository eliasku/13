import {build, BuildOptions} from 'esbuild';
import {copyPublicAssets, prepareFolders, resolveVersion} from "./common.js";
import {execSync} from "child_process";

const dist = "build/poki";
prepareFolders(dist);
copyPublicAssets(dist, false, "poki.html");
const buildVersion = resolveVersion();

{
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
            __SERVER_URL__: `"https://grtc.herokuapp.com/"`,
            __VERSION__: `"${buildVersion}"`,
            "process.env.NODE_ENV": debug ? `"development"` : `"production"`,
        };
        return opts;
    }

    const esbuildTasks = [
        build(addBuildOptions({
            entryPoints: ["packages/client/src/index.ts"],
            tsconfig: "packages/client/tsconfig.json",
            outfile: `${dist}/client.js`,
            plugins: [],
            target: "es2020"
        })).catch(e => {
            console.warn(e);
            process.exit(1);
        })
    ]

    await Promise.all(esbuildTasks);

    const r = execSync(`poki upload --name "$(git rev-parse --short HEAD)" --notes "$(git log -1 --pretty=%B)"`, {encoding: "utf8"});
    console.log(r);
}


