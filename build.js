import {execSync} from "child_process";
import {copyFileSync, readFileSync, rmSync, writeFileSync} from "fs";

let report = [];
const files = ["public/index.js", "public/server.js", "public/index.html"];
const zipFolderFiles = ["zip/index.js", "zip/server.js", "zip/index.html"];
const isProd = process.argv.indexOf("--dev") < 0;
const envDef = isProd ? "production" : "development";

function del(...files) {
    for (const file of files) {
        try {
            rmSync(file);
        } catch {
        }
    }
}

function sz(...files) {
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

function const2let(file) {
    let js = readFileSync(file, "utf8");
    js = js.replaceAll("const ", "let ");
    // js = js.replaceAll("\\n", "\n");
    writeFileSync(file, js, "utf8");
}

del("game.zip");
del(...files);
del(...zipFolderFiles);

execSync(`html-minifier --collapse-whitespace --remove-comments --remove-optional-tags --remove-redundant-attributes --remove-script-type-attributes --remove-tag-whitespace --use-short-doctype --minify-css true --minify-js true -o public/index.html html/index.html`);

// execSync(`esbuild server/src/index.ts --bundle --minify --mangle-props=_$ --platform=node --target=node16 --format=esm --outfile=public/server.js`);
execSync(`esbuild server/src/index.ts --bundle --format=esm --define:process.env.NODE_ENV='\"${envDef}\"' --platform=node --target=node16 --outfile=public/server.js --metafile=server-build.json`);
execSync(`esbuild src/lib/index.ts --bundle --format=esm --define:process.env.NODE_ENV='\"${envDef}\"' --outfile=public/index.js --metafile=index-build.json`);
report.push("BUILD: " + sz(...files));

const2let("public/server.js");
const2let("public/index.js");
report.push("C2LET: " + sz(...files));


const compress = ["booleans_as_integers=true", "unsafe_arrows=true", "passes=100", "keep_fargs=false", "pure_getters=true", "pure_funcs=['console.log','console.warn','console.info','console.error']"];//"unsafe=true",
if (isProd) {
    compress.push("drop_console=true");
}

execSync(`terser public/server.js --toplevel --module --ecma=2020 -c ${compress.join(",")} --mangle-props regex=/_$/ -m -o public/server.js`);
execSync(`terser public/index.js --toplevel --module --ecma=2020 -c ${compress.join(",")} --mangle-props regex=/_$/ -m -o public/index.js`);
report.push("TERSER: " + sz(...files));

if (process.argv.indexOf("--zip") > 0) {

    // Include only files you need! Do not include some hidden files like .DS_Store (6kb)
    // execSync(`zip -9 -X -D game.zip public/index.js public/server.js public/index.html`);
    // report.push("ZIP: " + sz("game.zip"));
    execSync(`roadroller -D -O1 -- public/index.js -o zip/index.js`);
    copyFileSync("public/server.js", "zip/server.js");
    copyFileSync("public/index.html", "zip/index.html");

    report.push("ROADROLL: " + sz(...zipFolderFiles));

    try {
        // https://linux.die.net/man/1/advzip
        // execSync(`advzip --not-zip --shrink-insane --recompress game.zip`);
        const mode = "--shrink-insane";
        // const mode = "--shrink-extra";
        execSync(`advzip --not-zip ${mode} --iter=1000 --add game.zip ${zipFolderFiles.join(" ")}`);
        report.push("LZMA: " + sz("game.zip"));
    } catch {
        console.warn("please install `advancecomp`");
    }
}

console.info(report.join("\n"));

// Baseline:
// -----
// BUILD: 104797
// C2LET: 103967
// TERSER: 38841
// ROADROLL: 18880
// LZMA: 13936

// item #2
// BUILD: 103639
// C2LET: 102835
// TERSER: 37741
// ROADROLL: 18512
// LZMA: 13663

// BUILD: 103570
// C2LET: 102768
// TERSER: 37670
// ROADROLL: 18493
// LZMA: 13645

