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
    }
};