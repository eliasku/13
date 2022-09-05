export const DEBUG_TERM = 1;

export const enum Const {
    NetFq = 60,
    InputDelay = 8,

    // ~35 bytes
    Prediction = 1,

    // ~130 bytes
    RLE = 0,

    StartWeapon = 0,

    NetPrecision = 65536,
}

export let _debugLagK = 2;

export function setDebugLagK(a: number) {
    _debugLagK = a;
}
