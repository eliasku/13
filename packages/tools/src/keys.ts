import {executeAsync} from "./common.js";
import {readFileSync} from "fs";

const isKeysFolderExists = () => {
    try {
        readFileSync("13-keys/ice.json", "utf-8");
        return true;
    } catch {
        // ignore
    }
    return false;
}

export const prepareKeysFolder = async () => {
    if (!isKeysFolderExists()) {
        try {
            console.info("check out keys folder");
            await executeAsync(`git clone https://eliasku:${process.env.KEYS_GH_TOKEN}@github.com/13-keys.git`);
        } catch (e) {
            console.warn("keys folder checkout error", e);
        }
    }
}
