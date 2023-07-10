import {executeAsync} from "./common.js";
import {readFileSync} from "fs";
import {exec, execSync} from "child_process";

const isKeysFolderExists = () => {
    try {
        readFileSync("13-keys/ice.json", "utf-8");
        return true;
    } catch {
        // ignore
    }
    return false;
}

export const prepareKeysFolder = () => {
    if (!isKeysFolderExists()) {
        try {
            console.info("check out keys folder");
            execSync(`git clone https://eliasku:${process.env.KEYS_GH_TOKEN}@github.com/eliasku/13-keys.git`);
        } catch (e) {
            console.warn("keys folder checkout error");
        }
    }
}
