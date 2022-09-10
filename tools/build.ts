import {execSync} from "child_process";
import {copyFileSync, readFileSync, rmSync, writeFileSync} from "fs";
import {filter, propMap} from "./rehash.js";

let report = [];
const files = ["public/c.js", "public/s.js", "public/index.html"];
const zipFolderFiles = ["zip/c.js", "zip/s.js", "zip/index.html"];//, "zip/r"];
const isProd = process.argv.indexOf("--dev") < 0;
const envDef = isProd ? "production" : "development";

function del(...files: string[]) {
    for (const file of files) {
        try {
            rmSync(file);
        } catch {
        }
    }
}

function sz(...files: string[]) {
    let total = 0;
    for (const file of files) {
        try {
            const bytes = readFileSync(file);
            total += bytes.length;
        } catch {
            console.warn("file not found:", file);
        }
    }
    return total;
}

del("game.zip");
del(...files);
del(...zipFolderFiles);

execSync(`html-minifier --collapse-whitespace --remove-comments --remove-optional-tags --remove-redundant-attributes --remove-script-type-attributes --remove-tag-whitespace --use-short-doctype --minify-css true --minify-js true -o public/index.html html/index.html`);
copyFileSync("html/debug.html", "public/debug.html");

const manglePropsRegex = "._$";
// execSync(`esbuild server/src/index.ts --bundle --minify --mangle-props=_$ --platform=node --target=node16 --format=esm --outfile=public/server.js`);
const esbuildArgs: string[] = [];
if (isProd) {
    // esbuildArgs.push("--minify");
    esbuildArgs.push("--drop:console");
    esbuildArgs.push("--drop:debugger");
    // esbuildArgs.push("--ignore-annotations");
    // esbuildArgs.push("--charset=utf8");
    // esbuildArgs.push("--tree-shaking=true");
    // esbuildArgs.push("--minify-whitespace");
    // esbuildArgs.push("--minify-identifiers");
    esbuildArgs.push("--minify-syntax");
    // esbuildArgs.push("--mangle-props=" + manglePropsRegex);
    //esbuildArgs.push("--analyze");
}

execSync(`esbuild server/src/index.ts --tsconfig=server/tsconfig.json ${esbuildArgs.join(" ")} --bundle --format=esm --define:process.env.NODE_ENV='\"${envDef}\"' --platform=node --target=node16 --outfile=public/s0.js --metafile=dump/server-build.json`, {
    encoding: "utf8",
    stdio: "inherit"
});
execSync(`esbuild src/lib/index.ts --tsconfig=tsconfig.json ${esbuildArgs.join(" ")} --bundle --format=esm --define:process.env.NODE_ENV='\"${envDef}\"' --outfile=public/c0.js --metafile=dump/client-build.json`, {
    encoding: "utf8",
    stdio: "inherit"
});
// copyFileSync("client.js", "public/c0.js");
// copyFileSync("server.js", "public/s0.js");

report.push("BUILD: " + sz("public/c0.js", "public/s0.js", "public/index.html"));

mangle_types("public/c0.js", "public/c1.js");
mangle_types("public/s0.js", "public/s1.js");
// copyFileSync("public/c0.js", "public/c1.js");
// copyFileSync("public/s0.js", "public/s1.js");

report.push("MANGLE: " + sz("public/c1.js", "public/s1.js", "public/index.html"));

const pureFunc = [
    // 'console.log',
    // 'console.warn',
    // 'console.info',
    // 'console.error',
    'M.sin',
    'M.cos',
    'M.sqrt',
    'M.hypot',
    'M.floor',
    'M.round',
    'M.ceil',
    'M.max',
    'M.min',
    'M.random',
    'M.abs',
    'reach',
    'lerp',
    'toRad',
    // 'getLumaColor32',
    'temper',
    'unorm_f32_from_u32',
    // 'newPointer',
];

const compress = [
    "booleans_as_integers=true",
    "unsafe_arrows=true",
    "passes=1000",
    "keep_fargs=false",
    "pure_getters=true",
    `pure_funcs=[${pureFunc.map(x => `'${x}'`).join(",")}]`,
    "unsafe_methods=true",
    //"expression=true",
    // "hoist_funs=true",
    "inline=3",
];//"unsafe=true",


let tl = "--toplevel";
execSync(`terser public/s1.js -f wrap_func_args=false ${tl} --module --ecma=2020 -c ${compress.join(",")} --mangle-props regex=/${manglePropsRegex}/ -m -o public/s.js`);
execSync(`terser public/c1.js -f wrap_func_args=false ${tl} --module --ecma=2020 -c ${compress.join(",")} --mangle-props regex=/${manglePropsRegex}/ -m -o public/c.js`);

report.push("TERSER: " + sz(...files));

rehashWebAPI("public/c.js", "public/c.js");

report.push("REHASH: " + sz(...files));

// debug.js
execSync(`esbuild src/lib/index.ts --bundle --format=esm --define:process.env.NODE_ENV='\"development\"' --outfile=public/debug.js`);
// rehashWebAPI("public/debug.js", "public/debug.js");

// function postprocess(file) {
//     let A = readFileSync(file, "utf8");
//     A = A.replaceAll(new RegExp("([^\\w_$]|^)(const\\s)", "gm"), (a, c1, c2) => {
//         return c1 + "let ";
//     });
//     writeFileSync(file, A, "utf8");
// }
//
// postprocess("public/c.js");
// postprocess("public/s.js");
// report.push("TERSER+: " + sz(...files));

console.info("release build ready... " + sz(...files));

if (process.argv.indexOf("--zip") > 0) {

    // Include only files you need! Do not include some hidden files like .DS_Store (6kb)
    // execSync(`zip -9 -X -D game.zip public/index.js public/server.js public/index.html`);
    // report.push("ZIP: " + sz("game.zip"));

    execSync(`roadroller -D -O2 -- public/c.js -o zip/c.js`);
    copyFileSync("public/s.js", "zip/s.js");
    copyFileSync("public/index.html", "zip/index.html");

    report.push("ROADROLL: " + sz(...zipFolderFiles));

    try {
        // https://linux.die.net/man/1/advzip
        // execSync(`advzip --not-zip --shrink-insane --recompress game.zip`);
        // advzip --not-zip --shrink-insane --iter=1000 --add game.zip zip/index.js zip/server.js zip/index.html
        // --not-zip
        execSync(`advzip --shrink-insane --iter=1000 --add game.zip ${zipFolderFiles.join(" ")}`);
        execSync(`advzip --list game.zip`);
        const zipSize = sz("game.zip");
        report.push("LZMA: " + zipSize);
        report.push("rem: " + (13 * 1024 - zipSize));
    } catch {
        console.warn("please install `advancecomp`");
    }
}

console.info(report.join("\n"));

function mangle_types(file: string, dest: string) {

    let src = readFileSync(file, "utf8");
    const getIDRegex = (from: string) => new RegExp("([^\\w_$]|^)(" + from + ")([^\\w_$]|$)", "gm");
    const _rename = new Map();
    let alphaSize = 0;

    const getAlphaID = (i: number) => `$${i}_`;
    const isRenamable = (id: string) => id.length > 1 && id.at(-1) === "_";

    function addType(fields: string[]) {

        const usedIds = new Set();
        for (const f of fields) {
            if (!isRenamable(f)) {
                usedIds.add(f);
            }
        }

        for (const f of fields) {
            if (isRenamable(f)) {
                const renamed = _rename.get(f);
                if (renamed) {
                    //console.info(f + " is used: " + renamed);
                    usedIds.add(renamed);
                }
            }
        }

        for (const f of fields) {
            if (isRenamable(f)) {
                let renamed = _rename.get(f);
                if (!renamed) {
                    let idx = 0;
                    while (usedIds.has(getAlphaID(idx))) {
                        idx++;
                        if (alphaSize < idx) {
                            alphaSize = idx;
                        }
                    }
                    const id = getAlphaID(idx);
                    _rename.set(f, id);
                    //console.info("replace: " + f + " to " + id);
                    usedIds.add(id);
                }
            }
        }
    }

    let archetypes = [
        [
            "id_",
            "pc_",
            "dc_",
            "name_",
            "debugPacketByteLength",
        ],
        [
            // WeaponConfig
            "rate_",
            "launchTime_",
            "relaunchSpeed_",
            "spawnCount_",
            "angleVar_",
            "angleSpread_",
            "kickBack_",
            "offset_",
            "offsetZ_",
            "velocity_",
            "velocityVar_",
            "cameraShake_",
            "detuneSpeed_",
            "cameraScale_",
            "cameraFeedback_",
            "cameraLookForward_",
            "gfxRot_",
            "gfxSx_",
            "handsAnim_",
            "bulletType_",
            "bulletDamage_",
            "bulletLifetime_",
            "bulletHp_",
            "bulletShellColor_",
        ],
        [
            "l_",
            "t_",
            "r_",
            "b_",
            "flags_",
            "pointer_",
            "r1_",
            "r2_",
        ],
        [
            "x_",
            "y_",
            "z_",
            "u_",
            "v_",
            "w_",
            "a_",
            "r_",
            "scale_",
            "color_",
            "lifeTime_",
            "lifeMax_",
            "img_",
            "splashSizeX_",
            "splashSizeY_",
            "splashEachJump_",
            "splashScaleOnVelocity_",
            "splashImg_",
            "followVelocity_",
            "followScale_",
        ],
        [
            // Actor
            "id_",
            "type_",
            "client_",
            "btn_",
            "weapon_",
            "hp_",
            "anim0_",
            "animHit_",
            "x_",
            "y_",
            "z_",
            "u_",
            "v_",
            "w_",
            "s_",
            "t_",
        ],
        [
            // Client
            "id_",
            "acknowledgedTic_",
            "tic_",
            "ready_",
            "isPlaying_"
        ],
        [
            // ClientEvent
            "tic_",
            "btn_",
            "client_",
        ],
        [
            // StateData
            "nextId_",
            "tic_",
            "seed_",
            "mapSeed_",
            "actors_",
            "scores_",
        ],
        [
            // Packet
            "sync_",
            "receivedOnSender_",
            "tic_",
            "events_",
            "state_",
            "debug",
        ],
        [
            // PacketDebug
            "seed",
            "tic",
            "nextId",
            "state",
        ],
        [
            // Pointer
            "id_",
            "startX_",
            "startY_",
            "x_",
            "y_",
            "downEvent_",
            "upEvent_",
            "active_",
        ],

        [
            // Texture
            "texture_",
            "w_",
            "h_",
            "x_",
            "y_",
            "u0_",
            "v0_",
            "u1_",
            "v1_",
            "fbo_",
        ],

        // GL renderer
        [
            "instancedArrays_",
            "quadCount_",
            "quadProgram_",
            "quadTexture_",
        ],

        // audio buffer source node
        [
            "currentSource_"
        ],

        // SERVER CONNECTION
        [
            "id_",
            "ts_",
            "eventStream_",
            "nextEventId_",
        ],
    ];
    for (let i = 0; i < archetypes.length; ++i) {
        archetypes[i] = archetypes[i].filter(a => findIdCount(a) > 0);
        archetypes[i].sort((a, b) => findIdCount(b) - findIdCount(a));
    }
    archetypes = archetypes.filter(a => a.length > 0);
    // solve unique fields
    const unique = new Set();
    const ntype = [];
    for (let i = 0; i < archetypes.length; ++i) {
        for (let j = 0; j < archetypes[i].length; ++j) {
            const id = archetypes[i][j];
            if (unique.has(id)) {
                ntype.push(id);
            } else {
                unique.add(id);
            }
        }
    }
    archetypes.unshift(ntype);

    for (const arch of archetypes) {
        addType(arch);
    }

    function findIdCount(id: string) {
        return isRenamable(id) ? (getIDRegex(id).exec(src)?.length ?? 0) : 0;
    }

    for (const [from, to] of _rename) {
        src = src.replaceAll(getIDRegex(from), (a, c1, c2, c3) => {
            // console.info(a + " => " + c1 + to + c3);
            return c1 + to + c3;
        });
    }
    console.info("Total used dict: " + alphaSize);

    writeFileSync(dest, src, "utf8");
}

const enum Hash {
     Seed = 2046694626,
     Mod = 591,
}

function rehashWebAPI(file: string, dest: string) {
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

    src = src.replaceAll('("canvas")', '`canvas`');
    src = src.replaceAll('("2d")', '`2d`');
    src = src.replaceAll('(",")', '`,`');
    src = src.replaceAll('getItem("_")', 'getItem`_`');
    src = src.replaceAll('("pick your name")', '`pick your name`');
    src = src.replaceAll('("connection lost")', '`connection lost`');

    src = src.replace(`"################################"`, `"${alphabet}"`);

    if (0) {
        const sortedStats = [...stats].sort((a, b) => b[1] - a[1]);
        for (const s of sortedStats) {
            console.info(s[1] + " : " + s[0]);
        }
    }

    writeFileSync(dest, src, "utf8");
}