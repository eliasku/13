import {copyFileSync, mkdirSync, readFileSync, rmSync} from "fs";
import {exec, execSync} from "child_process";
import * as crypto from "crypto";

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

export async function clean() {
    await executeAsync("tsc -b --clean");
    tryRemove("./server.js");
    tryRemove("./server.js.map");
    tryRemove("./build");
    tryRemove("./public");
    // maybe tsc output
    tryRemove("./dist");
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

let gitCommit = "";
const gitCommitBytes: number[] = [];
try {
    gitCommit = execSync('git rev-parse HEAD').toString().trim();
    for (let i = 0; i < gitCommit.length; i += 2) {
        gitCommitBytes.push(parseInt(gitCommit.substring(i, i + 2), 16));
    }
} catch {
    console.warn("Failed to get git commit hash (required for build meta)");
}

let buildHash = crypto.createHash("md5").update(version).update(new Uint8Array(gitCommitBytes)).digest("base64url");
console.info("build version: " + version);
console.info("build commit: " + gitCommit);
console.info("build hash: " + buildHash);

export const getCompileDefines = (debug?: boolean, serverUrl = "") => ({
    __SERVER_URL__: `"${serverUrl}"`,
    __VERSION__: `"${version}"`,
    __BUILD_HASH__: `"${buildHash}"`,
    __BUILD_COMMIT__: `"${gitCommit}"`,
    __POKI_GAME_ID__: `"${pokiGameId}"`,
    "process.env.NODE_ENV": debug ? `"development"` : `"production"`,
});

export function executeAsync(cmd: string): Promise<string> {
    return new Promise((resolve) => {
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.warn(error);
            }
            resolve(stdout ? stdout : stderr);
        });
    });
}