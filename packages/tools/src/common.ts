import {copyFileSync, mkdirSync, readFileSync, rmSync} from "fs";
import {exec, execSync} from "child_process";
import * as crypto from "crypto";

const ensureDir = (dir: string) => {
    try {
        mkdirSync(dir, {recursive: true});
    } catch {
        // ignore
    }
};

const tryRemove = (file: string) => {
    try {
        rmSync(file, {recursive: true});
        console.warn(`${file} is removed`);
    } catch (e) {
        console.warn(`${file} is not removed`);
    }
};

export const prepareFolders = (...folders: string[]) => {
    for (const folder of folders) {
        ensureDir(folder);
    }
};

export const clean = async () => {
    await executeAsync("tsc -b --clean");
    tryRemove("./server.js");
    tryRemove("./server.js.map");
    tryRemove("./build");
    tryRemove("./public");
    // maybe tsc output
    tryRemove("./dist");
};

export const copyPublicAssets = (publicDir = "public", debugAssets = true, indexTemplate = "index.html") => {
    // copy html
    console.info("copy assets");
    execSync(
        [
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
            `packages/client/assets/${indexTemplate}`,
        ].join(" "),
    );
    copyFileSync("packages/client/assets/e.ttf", `${publicDir}/e.ttf`);
    copyFileSync("packages/client/assets/m.ttf", `${publicDir}/m.ttf`);
    copyFileSync("packages/client/assets/fa-brands-400.ttf", `${publicDir}/fa-brands-400.ttf`);
    copyFileSync("packages/client/assets/spot.png", `${publicDir}/spot.png`);
    copyFileSync("packages/client/assets/main.png", `${publicDir}/main.png`);
    copyFileSync("packages/client/assets/main.dat", `${publicDir}/main.dat`);
    copyFileSync("packages/client/assets/config.json", `${publicDir}/config.json`);

    // copy translations
    ensureDir(`${publicDir}/translations`);
    for (const lang of [
        "de",
        "en",
        "es",
        "fr",
        "it",
        "ja",
        "ko",
        "pt-BR",
        "ru",
        "tr",
        "zh-Hans",
    ]) {
        copyFileSync(`packages/client/assets/translations/${lang}.json`, `${publicDir}/translations/${lang}.json`);
    }
    copyFileSync("ice.default.json", `${publicDir}/ice.json`);
    if (debugAssets) {
        copyFileSync("packages/client/assets/debug.html", `${publicDir}/debug.html`);
        copyFileSync("packages/client/assets/index4.html", `${publicDir}/index4.html`);
        copyFileSync("packages/client/assets/debug4.html", `${publicDir}/debug4.html`);
    }
};

type Pkg = {
    version?: string,
    poki?: {
        game_id?: string,
    },
};

const readPkg = (filepath: string): Pkg => {
    try {
        return JSON.parse(readFileSync(filepath, "utf-8")) as Pkg;
    } catch {
        // ignore
    }
    return {};
};

const rootPkg = readPkg("package.json");
const clientPkg = readPkg("packages/client/package.json");
const serverPkg = readPkg("packages/server/package.json");
const clientVersion = clientPkg.version ?? "0.0.1";
const serverVersion = serverPkg.version ?? "0.0.1";
const pokiGameId = rootPkg.poki?.game_id ?? "";

let gitCommit = "";
const gitCommitBytes: number[] = [];
try {
    gitCommit = execSync("git rev-parse HEAD").toString().trim();
    for (let i = 0; i < gitCommit.length; i += 2) {
        gitCommitBytes.push(parseInt(gitCommit.substring(i, i + 2), 16));
    }
} catch {
    console.warn("Failed to get git commit hash (required for build meta)");
}

// const buildHash = crypto.createHash("md5").update(version).update(new Uint8Array(gitCommitBytes)).digest("base64url");
const buildHash = crypto.createHash("md5").update(clientVersion).digest("base64url");
console.info("build client version: " + clientVersion);
console.info("build commit: " + gitCommit);
console.info("build hash: " + buildHash);

export const getCompileDefines = (debug?: boolean, serverUrl = "", pokiBuild = false) => ({
    __SERVER_URL__: `"${serverUrl}"`,
    __CLIENT_VERSION__: `"${clientVersion}"`,
    __SERVER_VERSION__: `"${serverVersion}"`,
    __BUILD_HASH__: `"${buildHash}"`,
    __BUILD_COMMIT__: `"${gitCommit}"`,
    __POKI_GAME_ID__: `"${pokiGameId}"`,
    __POKI_BUILD__: `${pokiBuild}`,
    "process.env.NODE_ENV": debug ? `"development"` : `"production"`,
});

export const executeAsync = (cmd: string): Promise<string> => {
    return new Promise(resolve => {
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.warn(error);
            }
            resolve(stdout ? stdout : stderr);
        });
    });
};
