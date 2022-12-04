import {parseRGB} from "../utils/utils";

export const enum Const {
    NetFq = 60,
    InputDelay = 8,
    PredictionMax = 8,
    Prediction = 1,
}

export let _debugLagK = 0;

export const setDebugLagK = (a: number) => _debugLagK = a;

export const GAME_CFG = {
    npc: {
        initWeaponLen: 4,
        period: 10,
        // period: 9,
        max: 8,
    },
    items: {
        lifetime: 10 * Const.NetFq
    },
    barrels: {
        initCount: 32,
        hp: [3, 7],
        dropWeapon: {
            chance: 70,
            min: 4
        },
    },
    trees: {
        initCount: 64,
    },
    camera: {
        // base resolution
        size: 256,
        listenerRadius: 256,
        baseScale: 1.1,
    },
    player: {
        // initial values for player's spawn
        hp: 10,
        sp: 0,
        mags: 1,
        jumpVel: 80,
        runVel: 120,
        walkVel: 60,
    },
    world: {
        gravity: 5,
        gravityWeak: 3
    },
    minimap: {
        size: 48,
        markerScale: 1,
        colors: {
            me: parseRGB("#fff"),
            player: parseRGB("#f00"),
            npc: parseRGB("#d06"),
            tree: parseRGB("#888"),
            barrel: parseRGB("#07f"),
            item: parseRGB("#0f0"),
            background: parseRGB("#010"),
            backgroundAlpha: 0.6,
        }
    },
    bodyColor: [
        parseRGB("#FF99DD"),
        parseRGB("#FFCC99"),
        parseRGB("#CCFF99"),
        parseRGB("#222222"),
        parseRGB("#8855FF"),
        parseRGB("#CCCCCC"),
    ],
    voice: {
        killAB: [
            "{0} CRUSHED {1}",
            "{0} destroyed {1}",
            "{0} killed {1}",
            "{0} took {1} life",
        ],
        killNPC: [
            "warm-up for {0}",
            "{0} killed someone",
            "death by {0}",
            "{0} sows DEATH",
        ]
    }
};