import {execSync} from "child_process";
import {copyFileSync, readFileSync, writeFileSync, mkdirSync} from "fs";
import {minify} from "terser";
import {mergeProps} from "./mergeProps.js";

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
}
catch {}

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

execSync(`html-minifier --collapse-whitespace --remove-comments --remove-optional-tags --remove-redundant-attributes --remove-script-type-attributes --remove-tag-whitespace --use-short-doctype --minify-css true --minify-js true -o build/index.html html/index.html`);

{
    console.info("build debug version");
    execSync(`esbuild src/lib/index.ts --bundle --format=esm --define:process.env.NODE_ENV='\"development\"' --define:__VERSION__='\"${buildVersion}\"' --outfile=build/debug.js`);
    copyFileSync("html/index4.html", "public/index4.html");
    copyFileSync("html/debug4.html", "public/debug4.html");
    copyFileSync("html/debug.html", "public/debug.html");
}

{
    const getBuildArgs = (name:string) => {
        const esbuildArgs: string[] = [];
        esbuildArgs.push("--drop:debugger");
        if(name !== "server") {
            esbuildArgs.push("--drop:console");
        }
        esbuildArgs.push("--minify-syntax");
        esbuildArgs.push(`--define:__VERSION__='\"${buildVersion}\"'`);
        esbuildArgs.push(`--define:process.env.NODE_ENV='\"production\"'`);
        return esbuildArgs.join(" ");
    }

    execSync(`esbuild server/src/index.ts --tsconfig=server/tsconfig.json ${getBuildArgs("server")} --bundle --format=esm --platform=node --target=node16 --outfile=build/server0.js --metafile=build/server0-build.json`, {
        encoding: "utf8",
        stdio: "inherit"
    });
    execSync(`esbuild src/lib/index.ts --tsconfig=tsconfig.json ${getBuildArgs("client")} --bundle --format=esm --outfile=build/client0.js --metafile=build/client0-build.json`, {
        encoding: "utf8",
        stdio: "inherit"
    });

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
