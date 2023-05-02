import {execSync} from "child_process";
const r = execSync(`poki upload --name "$(git rev-parse --short HEAD)" --notes "$(git log -1 --pretty=%B)"`, {
    encoding: "utf8",
});
console.log(r);
