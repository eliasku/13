import {execSync} from "child_process";
import {copyFileSync, readFileSync, rmSync, writeFileSync} from "fs";

let report = [];
const files = ["public/c.js", "public/s.js", "public/i.html"];
const zipFolderFiles = ["zip/c.js", "zip/s.js", "zip/i.html"];//, "zip/r"];
const isProd = process.argv.indexOf("--dev") < 0;
const envDef = isProd ? "production" : "development";

function del(...files) {
    for (const file of files) {
        try {
            rmSync(file);
        } catch {
        }
    }
}

function sz(...files) {
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

execSync(`html-minifier --collapse-whitespace --remove-comments --remove-optional-tags --remove-redundant-attributes --remove-script-type-attributes --remove-tag-whitespace --use-short-doctype --minify-css true --minify-js true -o public/i.html html/index.html`);
copyFileSync("html/debug.html", "public/debug.html");

const manglePropsRegex = "._$";
// execSync(`esbuild server/src/index.ts --bundle --minify --mangle-props=_$ --platform=node --target=node16 --format=esm --outfile=public/server.js`);
const esbuildArgs = [];
if (isProd) {
    esbuildArgs.push("--minify");
    esbuildArgs.push("--drop:console");
    esbuildArgs.push("--drop:debugger");
    // esbuildArgs.push("--mangle-props=" + manglePropsRegex);
    esbuildArgs.push("--analyze");
}

execSync(`esbuild server/src/index.ts ${esbuildArgs.join(" ")} --bundle --format=esm --define:process.env.NODE_ENV='\"${envDef}\"' --platform=node --target=node16 --outfile=public/s0.js --metafile=dump/server-build.json`);
execSync(`esbuild src/lib/index.ts ${esbuildArgs.join(" ")} --bundle --format=esm --define:process.env.NODE_ENV='\"${envDef}\"' --outfile=public/c0.js --metafile=dump/client-build.json`);

report.push("BUILD: " + sz("public/c0.js", "public/s0.js", "public/i.html"));

mangle_types("public/c0.js", "public/c1.js");
mangle_types("public/s0.js", "public/s1.js");

report.push("MANGLE: " + sz("public/c1.js", "public/s1.js", "public/i.html"));

// debug.js
execSync(`esbuild src/lib/index.ts --minify --mangle-props=${manglePropsRegex} --bundle --format=esm --define:process.env.NODE_ENV='\"development\"' --outfile=public/debug.js`);

const pureFunc = [
    'console.log',
    'console.warn',
    'console.info',
    'console.error',
    'Math.sin',
    'Math.cos',
    'Math.sqrt',
    'Math.hypot',
    'Math.floor',
    'Math.round',
    'Math.ceil',
    'Math.max',
    'Math.min',
    'Math.random',
    'Math.abs',
];

const compress = [
    "booleans_as_integers=true",
    "unsafe_arrows=true",
    "passes=100",
    "keep_fargs=false",
    "pure_getters=true",
    `pure_funcs=[${pureFunc.map(x => `'${x}'`).join(",")}]`,
    "unsafe_methods=true",

    // "hoist_funs=true",
    //"inline=2",
];//"unsafe=true",

execSync(`terser public/s1.js --toplevel --module --ecma=2020 -c ${compress.join(",")} --mangle-props regex=/${manglePropsRegex}/ -m -o public/s.js`);
execSync(`terser public/c1.js --toplevel --module --ecma=2020 -c ${compress.join(",")} --mangle-props regex=/${manglePropsRegex}/ -m -o public/c.js`);

report.push("TERSER: " + sz(...files));

if (process.argv.indexOf("--zip") > 0) {

    // Include only files you need! Do not include some hidden files like .DS_Store (6kb)
    // execSync(`zip -9 -X -D game.zip public/index.js public/server.js public/index.html`);
    // report.push("ZIP: " + sz("game.zip"));

    execSync(`roadroller -D -O1 -- public/c.js -o zip/c.js`);
    copyFileSync("public/s.js", "zip/s.js");
    copyFileSync("public/i.html", "zip/i.html");
    copyFileSync("public/r", "zip/r");

    report.push("ROADROLL: " + sz(...zipFolderFiles));

    try {
        // https://linux.die.net/man/1/advzip
        // execSync(`advzip --not-zip --shrink-insane --recompress game.zip`);
        // advzip --not-zip --shrink-insane --iter=1000 --add game.zip zip/index.js zip/server.js zip/index.html
        // --not-zip
        execSync(`advzip --shrink-insane --iter=1000 --add game.zip ${zipFolderFiles.join(" ")}`);
        execSync(`advzip --list game.zip`);
        report.push("LZMA: " + sz("game.zip"));
    } catch {
        console.warn("please install `advancecomp`");
    }
}

console.info(report.join("\n"));

// Before:
// BUILD: 103525
// C2LET: 102717
// TERSER: 37641
// ROADROLL: 18455
// LZMA: 13620

// After:
// BUILD: 102866
// C2LET: 102072
// TERSER: 37396
// ROADROLL: 18413
// LZMA: 13590


function mangle_types(file, dest) {

    const _rename = new Map();
    let alphaSize = 0;

    function addType(fields) {
        const alphabet = [
            "x", "y", "z",
            "u", "v", "w",
            "r", "s", "t", "q",
            "a", "b", "c", "d", "e", "f", "g", "h",
            "i", "j", "k", "l", "m", "n", "o", "p", "_", "$"];
        const usedIds = new Set();
        for (const f of fields) {
            if (f.length === 1 || f[f.length - 1] !== "_") {
                usedIds.add(f);
            }
        }
        for (const f of fields) {
            if (f.length === 1 || f[f.length - 1] !== "_") {
                continue;
            }
            let renamed = _rename.get(f);
            if (renamed) {
                usedIds.add(renamed);
            } else {
                let idx = 0;
                while (usedIds.has(alphabet[idx])) {
                    idx++;
                    if (idx >= alphabet.length) {
                        console.error("not enough alphabet");
                        process.exit();
                    }
                    if (alphaSize < idx) {
                        alphaSize = idx;
                    }
                }
                const id = alphabet[idx];
                _rename.set(f, id);
                // console.info("replace: " + f + " to " + id);
                usedIds.add(id);
            }
        }
    }

    const archetypes = [
        [
            "id_",
            "pc_",
            "dc_",
            "name_",
            "debugPacketByteLength_",
        ],
        [
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
            "cameraFeedback_",
            "cameraLookForward_",
            "gfxRot_",
            "gfxSx_",
            "handsAnim_",
            "bulletType_",
            "bulletDamage_",
            "bulletLifetime_",
            "bulletHp_",
        ],
        [
            "songData_",
            "rowLen_",
            "patternLen_",
            "endPattern_",
            "numChannels_",
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
            "x",
            "y",
            "z",
            "u",
            "v",
            "w",
            "a",
            "r",
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
            "x",
            "y",
            "z",
            "u",
            "v",
            "w",
            "type_",
            "btn_",
            "weapon_",
            "hp_",
            "anim0_",
            "animHit_",
            "c",
            "s",
            "t",
            "p",
            "q",
        ],
        [
            "acknowledgedTic_",
            "ready_",
            "isPlaying_",
            "c",
            "t",
        ],
        [
            "btn_",
            "t",
            "c"
        ],
        [
            "mapSeed_",
            "seed_",
            "actors_",
        ],
        [
            "c", "t", "e", "s",
            "sync_",
            "check_seed_",
            "check_tic_",
            "receivedOnSender_",
        ],
        [
            "atX_",
            "atY_",
            "toX_",
            "toY_",
            "angle_",
            "scale_",
        ],
        [
            "id_",
            "startX_",
            "startY_",
            "x",
            "y",
            "downEvent_",
            "upEvent_",
            "active_",
        ]
    ];

    for (const arch of archetypes) {
        addType(arch);
    }

    let src = readFileSync(file, "utf8");
    for (const [from, to] of _rename) {
        src = src.replaceAll(new RegExp("([^\\w_$])(" + from + ")([^\\w_$])", "gm"), (a, c1, c2, c3) => {
            // console.info(a + " => " + c1 + to + c3);
            return c1 + to + c3;
        });
    }
    console.info("Total used dict: " + alphaSize);
    writeFileSync(dest, src, "utf8");
}