import {execSync} from "child_process";
import {readFileSync, rmSync, writeFileSync} from "fs";

let report = [];
const files = ["public/index.js", "public/server.js", "public/index.html"];

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

del("public/index.js", "public/server.js", "game.zip");

// execSync(`esbuild server/src/index.ts --bundle --minify --mangle-props=_$ --platform=node --target=node16 --format=esm --outfile=public/server.js`);
execSync(`esbuild server/src/index.ts --bundle --format=esm --define:process.env.NODE_ENV='\"production\"' --platform=node --target=node16 --outfile=public/server.js`);
execSync(`esbuild src/lib/index.ts --bundle --format=esm --define:process.env.NODE_ENV='\"production\"' --outfile=public/index.js`);
report.push("BUILD: " + sz(...files));

const2let("public/server.js");
const2let("public/index.js");
report.push("C2LET: " + sz(...files));

execSync(`terser public/server.js --toplevel --module --ecma=2020 --compress drop_console=true,booleans_as_integers=true,unsafe_arrows=true,unsafe=true,passes=8 --mangle-props regex=/_$/ -m -o public/server.js`);
execSync(`terser public/index.js --toplevel --module --ecma=2020 --compress drop_console=true,booleans_as_integers=true,unsafe_arrows=true,unsafe=true,passes=8 --mangle-props regex=/_$/ -m -o public/index.js`);
report.push("TERSER: " + sz(...files));

execSync(`roadroller -D -O1 -- public/index.js -o public/index.js`);
report.push("ROADROLL: " + sz(...files));

if (process.argv.indexOf("--zip") > 0) {
    // Include only files you need! Do not include some hidden files like .DS_Store (6kb)
    // execSync(`zip -9 -X -D game.zip public/index.js public/server.js public/index.html`);
    // report.push("ZIP: " + sz("game.zip"));

    try {
        // https://linux.die.net/man/1/advzip
        // execSync(`advzip --not-zip --shrink-insane --recompress game.zip`);
        const mode = "--shrink-insane";
        // const mode = "--shrink-extra";
        execSync(`advzip --not-zip ${mode} --iter=1000 --add game.zip ${files.join(" ")}`);
        report.push("LZMA: " + sz("game.zip"));
    } catch {
        console.warn("please install `advancecomp`");
    }
}

console.info(report.join("\n"));




// Baseline:
// BUILD: 93232
// C2LET: 92538
// TERSER: 34869
// ROADROLL: 17151
// LZMA: 12566

