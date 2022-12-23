import {copyFileSync, mkdirSync, readFileSync, rmSync} from "fs";
import {execSync} from "child_process";

function ensureDir(dir: string) {
    try {
        mkdirSync(dir);
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

export function prepareFolders() {
    ensureDir("build");
    ensureDir("public");
}

export function clean() {
    tryRemove("./server.js");
    tryRemove("./build");
    tryRemove("./public");
}

export function resolveVersion() {
    let version = "1.0.0";
    try {
        const pkg = JSON.parse(readFileSync("package.json", "utf-8")) as { version: string };
        version = pkg.version ?? "1.0.0";
    } catch {
    }
    console.info("build version: " + version);
    return version;
}

export function copyPublicAssets() {
    // copy html
    console.info("build html files");
    execSync(`html-minifier --collapse-whitespace --remove-comments --remove-optional-tags --remove-redundant-attributes --remove-script-type-attributes --remove-tag-whitespace --use-short-doctype --minify-css true --minify-js true -o public/index.html packages/client/assets/index.html`);
    copyFileSync("packages/client/assets/index4.html", "public/index4.html");
    copyFileSync("packages/client/assets/debug4.html", "public/debug4.html");
    copyFileSync("packages/client/assets/debug.html", "public/debug.html");
    copyFileSync("packages/client/assets/e.ttf", "public/e.ttf");
    copyFileSync("packages/client/assets/m.ttf", "public/m.ttf");
    copyFileSync("packages/client/assets/fa-brands-400.ttf", "public/fa-brands-400.ttf");
    copyFileSync("packages/client/assets/spot.png", "public/spot.png");
    copyFileSync("packages/client/assets/main.png", "public/main.png");
    copyFileSync("packages/client/assets/main.dat", "public/main.dat");
}