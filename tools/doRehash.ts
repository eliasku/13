import {readFileSync, writeFileSync} from "fs";
import {filter, propMap} from "./rehash.js";

const enum Hash {
    Seed = 48639327,
    Mod = 427,
}

export const rehashWebAPI = (file: string, dest: string) => {
    let src = readFileSync(file, "utf8");
    let BASE32: number[] = [];
    let SORTED_BASE32: number[] = [];
    {
        const hist = new Map<string, number>();
        for (let c of src) {
            if (/[a-zA-Z_$]/.test(c)) {
                hist.set(c, (hist.get(c) | 0) + 1);
            }
        }

        const list = [...hist];
        list.sort((a, b) => (b[1] - a[1]));
        for (const [c, n] of list) {
            if (BASE32.length < 32) {
                BASE32.push(c.charCodeAt(0));
            }
            //console.log(c + ": " + n);
        }
        //console.info(base32);
    }

    const reFieldID = (from: string) => new RegExp("([.])(" + from + ")([^\\w_$]|$)", "gm");

    const h2 = (str: string, seed = Hash.Seed, mod = Hash.Mod) => {
        for (const i of str) {
            seed = (Math.imul(seed, 23131) + i.charCodeAt(0)) >>> 0;
        }
        return seed % mod;
    }
    const l3 = (i: number, a: string) => a[i % 32] + (i < 32 ? [] : a[i >> 5]);

    let alphabet: string = String.fromCharCode(...BASE32);
    if (1) {
        let estimatedMap = new Map;
        const estimateUsage = (i: number) => {
            let idx = i % 32;
            estimatedMap.set(idx, 1 + (estimatedMap.get(idx) | 0));
            if (i >= 32) {
                idx = i >> 5;
                estimatedMap.set(idx, 1 + (estimatedMap.get(idx) | 0));
            }
        }

        for (let type in propMap) {
            for (let id of [...propMap[type]]) {
                if (filter.indexOf(id) < 0) {
                    const hash = h2(id);
                    src.replaceAll(reFieldID(id), (a, c1, c2, c3) => {
                        estimateUsage(hash);
                        return "";
                    });
                }
            }
        }
        estimatedMap = new Map([...estimatedMap].sort((a, b) =>
            (b[1] << 5) - (a[1] << 5) + a[0] - b[0]));
        const indices = [];
        for (let i = 0; i < 32; ++i) {
            indices[i] = i;
        }
        indices.sort((a, b) =>
            (estimatedMap.get(b) << 5) - (estimatedMap.get(a) << 5) +
            a - b
        );

        let tb = BASE32.concat();
        for (const i of indices) {
            SORTED_BASE32[i] = tb.shift();
        }
        console.info("INITIAL BASE32: " + String.fromCharCode(...BASE32));
        alphabet = String.fromCharCode(...SORTED_BASE32);
        console.info("SORTED  BASE32: " + alphabet);
    }

    const stats = new Map;
    for (let type in propMap) {
        for (let id of [...propMap[type]]) {
            if (filter.indexOf(id) < 0) {
                const hash = l3(h2(id), alphabet);
                src = src.replaceAll(reFieldID(id), (a, c1, c2, c3) => {
                    const statName = id + " - " + hash;
                    stats.set(statName, (stats.get(statName) | 0) + 1);
                    return c1 + hash + c3;
                });
            }
        }
    }

    src = src.replace(`"################################"`, `"${alphabet}"`);

    if (0) {
        const sortedStats = [...stats].sort((a, b) => b[1] - a[1]);
        for (const s of sortedStats) {
            console.info(s[1] + " : " + s[0]);
        }
    }

    writeFileSync(dest, src, "utf8");
}