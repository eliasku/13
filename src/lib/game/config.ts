export const enum Const {
    NetFq = 60,
    InputDelay = 8,
    PredictionMax = 8,

    // ~35 bytes
    Prediction = 1,

    StartWeapon = 0,

    NetPrecision = 65536,
}

export let _debugLagK = 0;

export const setDebugLagK = (a: number) => _debugLagK = a;
