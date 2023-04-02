import {copyPublicAssets, prepareFolders} from "./common.js";
import {build} from "./rollup.js";
import {execSync} from "child_process";
import {exit} from "process";

const dist = "build/poki";
prepareFolders(dist);
copyPublicAssets(dist, false, "poki.html");

await build({
    input: "packages/client/src/index.ts",
    tsconfig: "packages/client/tsconfig.json",
    output: `${dist}/client.js`,
    serverUrl: "https://iioi.herokuapp.com/",
}).catch(e => {
    console.warn(e);
    exit(1);
});
const r = execSync(`poki upload --name "$(git rev-parse --short HEAD)" --notes "$(git log -1 --pretty=%B)"`, {
    encoding: "utf8",
});
console.log(r);
