import {execSync} from "child_process";
import {copyFileSync, readFileSync, writeFileSync, mkdirSync} from "fs";
import {minify} from "terser";
import {mergeProps} from "./mergeProps.js";
import {build, BuildOptions} from 'esbuild';

// create build dir
try {
    mkdirSync("build");
} catch {
}

let report: string[] = [];
let buildVersion = "0.0.0";

try {
    const pkg = JSON.parse(readFileSync("package.json", "utf-8")) as { version: string };
    buildVersion = pkg.version;
    console.info("build version: " + buildVersion);
} catch {
}

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
    // copy html
    console.info("build html files");
    execSync(`html-minifier --collapse-whitespace --remove-comments --remove-optional-tags --remove-redundant-attributes --remove-script-type-attributes --remove-tag-whitespace --use-short-doctype --minify-css true --minify-js true -o build/index.html html/index.html`);
    copyFileSync("html/index4.html", "public/index4.html");
    copyFileSync("html/debug4.html", "public/debug4.html");
    copyFileSync("html/debug.html", "public/debug.html");
}

{
    console.info("esbuild: server, client, debug");

    const addBuildOptions = (opts: BuildOptions, debug: boolean = false): BuildOptions => {
        opts.bundle = true;
        opts.format = "esm";
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
            outfile: "build/server0.js",
            tsconfig: "server/tsconfig.json",
            platform: "node",
            target: "node16",
        })).catch(e => {
            console.warn(e);
            process.exit(1);
        }),
        build(addBuildOptions({
            entryPoints: ["src/lib/index.ts"],
            outfile: "build/client0.js",
            tsconfig: "tsconfig.json",
            plugins: [],
        })).catch(e => {
            console.warn(e);
            process.exit(1);
        }),
        build(addBuildOptions({
            entryPoints: ["src/lib/index.ts"],
            outfile: "build/debug.js",
            tsconfig: "tsconfig.json",
            plugins: [],
        }, true)).catch(e => {
            console.warn(e);
            process.exit(1);
        }),
    ]

    await Promise.all(esbuildTasks);
    printSize("build", "build/index.html", "build/client0.js", "build/server0.js");
}

{
    console.info("merge properties");
    mergeProps("tsconfig.json", "build/client0.js", "build/client1.js");
    mergeProps("server/tsconfig.json", "build/server0.js", "build/server1.js");
    printSize("merge", "build/index.html", "build/client1.js", "build/server1.js");
}

{
    console.info("terser");
    const pureFunc = [
        'sin',
        'cos',
        'sqrt',
        'hypot',
        'floor',
        'round',
        'ceil',
        'max',
        'min',
        'random',
        'abs',
        'reach',
        'lerp',
        'temper',
        'unorm_f32_from_u32',
    ];

    const terser = async (input: string, output: string) => {
        const result = await minify(readFileSync(input, "utf8"), {
            toplevel: true,
            module: true,
            ecma: 2020,
            compress: {
                booleans_as_integers: true,
                unsafe_arrows: true,
                passes: 10000,
                keep_fargs: false,
                hoist_funs: true,
                // hoist_vars: true,
                pure_getters: true,
                dead_code: true,
                pure_funcs: pureFunc,
                unsafe_methods: true,
                inline: 3,
                expression: true,
                unsafe_math: true,
                unsafe: true
            },
            format: {
                wrap_func_args: false,
                inline_script: false,
            },
            mangle: {
                properties: {
                    regex: "._$"
                },
            }
        });
        writeFileSync(output, result.code);
    };

    await Promise.all([
        terser("build/server1.js", "build/server2.js"),
        terser("build/client1.js", "build/client2.js")
    ]);
    printSize("terser", "build/index.html", "build/client2.js", "build/server2.js");
}

copyFileSync("build/server2.js", "server.js");
copyFileSync("build/client2.js", "public/client.js");
copyFileSync("build/index.html", "public/index.html");
printSize("game", "public/index.html", "server.js", "public/client.js");

console.info(report.join("\n"));
