import {copyPublicAssets, prepareFolders} from "./common.js";
import {build} from "./rollup.js";
import {exit} from "process";

const dist = "build/poki";
prepareFolders(dist);
copyPublicAssets(dist, false, "poki.html");

await build({
    input: "packages/client/src/index.ts",
    tsconfig: "packages/client/tsconfig.json",
    output: `${dist}/client.js`,
    serverUrl: "https://iioi.herokuapp.com/",
    disableAnalytics: true,
}).catch(e => {
    console.warn(e);
    exit(1);
});
