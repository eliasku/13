export const enum Const {
    NetFq = 60,
    InputDelay = 8,
    PredictionMax = 8,
    Prediction = 1,
}

export let _debugLagK = 0;

export const setDebugLagK = (a: number) => _debugLagK = a;
