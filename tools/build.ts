import {execSync} from "child_process";
import {copyFileSync, readFileSync, rmSync, writeFileSync, mkdirSync} from "fs";
import {Input, InputAction, InputType, Packer, PackerOptions} from "roadroller";
import {minify} from "terser";
import * as readline from "readline";
import {mergeProps} from "./mergeProps.js";
import {rehashWebAPI} from "./doRehash.js";

// create build dir
try {
    mkdirSync("build");
} catch {
}

let report: string[] = [];

const zip = (label: string, ...files: string[]) => {
    const size0 = sz(...files);
    let size1 = size0;
    if (process.argv.indexOf("--zip") >= 0) {
        try {
            const zipname = "build/" + label + ".zip";
            console.log("estimate zip...");
            execSync(`advzip --shrink-insane --iter=1000 --add ${zipname} ${files.join(" ")}`);
            execSync(`./tools/vendor/ect -z -9 -strip ${zipname}`);
            size1 = sz(zipname);
        } catch {
            console.warn("zip not found. please install `advancecomp`");
        }
    }
    const free = 13 * 1024 - size1;
    console.info(label + ":\t" + size0 + "\t| " + size1 + "\t| " + free);
    report.push(label + ":\t" + size0 + "\t| " + size1 + "\t| " + free);
};

const roadroller = async () => {
    if (process.argv.indexOf("--rr") > 0) {
        console.info("run roadroller");
        const inputs: Input[] = [
            {
                data: readFileSync("build/client3.js", "utf8"),
                type: InputType.JS,
                action: InputAction.Eval,
            },
        ];
        const options: PackerOptions = {};
        const packer = new Packer(inputs, options);
        let i = 0;
        await packer.optimize(process.argv.indexOf("--max") > 0 ? 2 : 1,
            (): any => {
                const i0 = i++ % 11;
                const i1 = (10 - i0);
                process.stdout.write("[" + ".".repeat(i0) + " ".repeat(i1) + "]");
                readline.cursorTo(process.stdout, 0);
            });

        const {firstLine, secondLine} = packer.makeDecoder();
        writeFileSync("build/client4.js", firstLine + secondLine);
    }
    else {
        console.info("skip roadroller");
        copyFileSync("build/client3.js", "build/client4.js");
    }
};

const isProd = process.argv.indexOf("--dev") < 0;

// build special debug.js and debug.html
const buildDebugVersion = process.argv.indexOf("--debug") >= 0;
const envDef = isProd ? "production" : "development";

function del(...files: string[]) {
    for (const file of files) {
        try {
            rmSync(file);
        } catch {
        }
    }
}

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

del("game.zip");
//del(...files);

execSync(`html-minifier --collapse-whitespace --remove-comments --remove-optional-tags --remove-redundant-attributes --remove-script-type-attributes --remove-tag-whitespace --use-short-doctype --minify-css true --minify-js true -o build/index.html html/index.html`);

if (buildDebugVersion) {
    console.info("build debug");
    execSync(`esbuild src/lib/index.ts --bundle --format=esm --define:process.env.NODE_ENV='\"development\"' --outfile=build/debug.js`);
    copyFileSync("html/index4.html", "public/index4.html");
    copyFileSync("html/debug4.html", "public/debug4.html");
    copyFileSync("html/debug.html", "public/debug.html");
}

{
    console.info("build");
    const esbuildArgs: string[] = [];
    if (isProd) {
        // esbuildArgs.push("--minify");
        esbuildArgs.push("--drop:console");
        esbuildArgs.push("--drop:debugger");
        // esbuildArgs.push("--ignore-annotations");
        // esbuildArgs.push("--charset=utf8");
        // esbuildArgs.push("--tree-shaking=true");
        // esbuildArgs.push("--minify-whitespace");
        // esbuildArgs.push("--minify-identifiers");
        esbuildArgs.push("--minify-syntax");
        // esbuildArgs.push("--mangle-props=" + manglePropsRegex);
        //esbuildArgs.push("--analyze");
    }

    execSync(`esbuild server/src/index.ts --tsconfig=server/tsconfig.json ${esbuildArgs.join(" ")} --bundle --format=esm --define:process.env.NODE_ENV='\"${envDef}\"' --platform=node --target=node16 --outfile=build/server0.js --metafile=build/server0-build.json`, {
        encoding: "utf8",
        stdio: "inherit"
    });
    execSync(`esbuild src/lib/index.ts --tsconfig=tsconfig.json ${esbuildArgs.join(" ")} --bundle --format=esm --define:process.env.NODE_ENV='\"${envDef}\"' --outfile=build/client0.js --metafile=build/client0-build.json`, {
        encoding: "utf8",
        stdio: "inherit"
    });

    zip("build", "build/index.html", "build/client0.js", "build/server0.js");
}

{
    console.info("merge properties");
    mergeProps("tsconfig.json", "build/client0.js", "build/client1.js");
    mergeProps("server/tsconfig.json", "build/server0.js", "build/server1.js");
    zip("merge", "build/index.html", "build/client1.js", "build/server1.js");
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
    zip("terser", "build/index.html", "build/client2.js", "build/server2.js");
}

{
    console.info("rehash");
    rehashWebAPI("build/client2.js", "build/client3.js");
    zip("rehash", "build/index.html", "build/client3.js", "build/server2.js");
}

{
    console.info("inject html");
    // inject source code to HTML (remove client.js file)
    let html = readFileSync("build/index.html", "utf8");
    let client = readFileSync("build/client3.js", "utf8");
    html = html.replace(`<script></script>`, `<script>${client}</script>`);
    writeFileSync("public/index.html", html);
}

copyFileSync("build/server2.js", "public/s.js");

console.info("release build ready... " + sz("public/index.html", "public/s.js"));

await roadroller();
zip("rr", "build/index.html", "build/client4.js", "build/server2.js");

{
    // inject source code to HTML (remove client.js file)
    let html = readFileSync("build/index.html", "utf8");
    let client = readFileSync("build/client4.js", "utf8");
    if (process.argv.indexOf("--rr") > 0) {
        html = html.replace(`<script></script>`, `<script>${client}</script>`);
        writeFileSync("public/index.html", html);
        zip("game", "public/index.html", "public/s.js");
    }
    else {
        html = html.replace(`<script></script>`, `<script src="c.js"></script>`);
        writeFileSync("public/index.html", html);
        writeFileSync("public/c.js", client);
        zip("game", "public/index.html", "public/s.js", "public/c.js");
    }
}

console.info(report.join("\n"));
