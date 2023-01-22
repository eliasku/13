import {copyFileSync, mkdirSync, readFileSync, rmSync} from "fs";
import {execSync} from "child_process";

function ensureDir(dir: string) {
    try {
        mkdirSync(dir, {recursive: true});
    } catch {
    }
}

function tryRemove(file: string) {
    try {
        rmSync(file, {recursive: true});
        console.warn(`${file} is removed`);
    } catch (e) {
        console.warn(`${file} is not removed`);
    }
}

export function prepareFolders(...folders: string[]) {
    for (const folder of folders) {
        ensureDir(folder);
    }
}

export function clean() {
    tryRemove("./server.js");
    tryRemove("./build");
    tryRemove("./public");
}

export function copyPublicAssets(publicDir = "public", debugAssets = true, indexTemplate: string = "index.html") {
    // copy html
    console.info("copy assets");
    execSync([
        `html-minifier`,
        `--collapse-whitespace`,
        `--remove-comments`,
        `--remove-optional-tags`,
        `--remove-redundant-attributes`,
        `--remove-script-type-attributes`,
        `--remove-tag-whitespace`,
        `--use-short-doctype`,
        `--minify-css true`,
        `--minify-js true`,
        `-o ${publicDir}/index.html`,
        `packages/client/assets/${indexTemplate}`
    ].join(" "));
    copyFileSync("packages/client/assets/e.ttf", `${publicDir}/e.ttf`);
    copyFileSync("packages/client/assets/m.ttf", `${publicDir}/m.ttf`);
    copyFileSync("packages/client/assets/fa-brands-400.ttf", `${publicDir}/fa-brands-400.ttf`);
    copyFileSync("packages/client/assets/spot.png", `${publicDir}/spot.png`);
    copyFileSync("packages/client/assets/main.png", `${publicDir}/main.png`);
    copyFileSync("packages/client/assets/main.dat", `${publicDir}/main.dat`);
    if (debugAssets) {
        copyFileSync("packages/client/assets/debug.html", `${publicDir}/debug.html`);
        copyFileSync("packages/client/assets/index4.html", `${publicDir}/index4.html`);
        copyFileSync("packages/client/assets/debug4.html", `${publicDir}/debug4.html`);
    }
}

let version = "1.0.0";
let pokiGameId = "";

try {
    const pkg = JSON.parse(readFileSync("package.json", "utf-8")) as { version: string, poki?: { game_id?: string } };
    version = pkg.version ?? "1.0.0";
    pokiGameId = pkg.poki?.game_id ?? "";
} catch {
}

console.info("build version: " + version);

export const getCompileDefines = (debug?: boolean, serverUrl = "") => ({
    __SERVER_URL__: `"${serverUrl}"`,
    __VERSION__: `"${version}"`,
    __POKI_GAME_ID__: `"${pokiGameId}"`,
    "process.env.NODE_ENV": debug ? `"development"` : `"production"`,
});

