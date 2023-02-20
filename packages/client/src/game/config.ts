import {GameConfig} from "../data/config.js";

export const Const = {
    NetFq: 60,
    InputDelay: 8,
    PredictionMax: 8,
    Prediction: 1,
} as const;
export type Const = (typeof Const)[keyof typeof Const];

export let _debugLagK = 0;

export const setDebugLagK = (a: number) => (_debugLagK = a);

export let GAME_CFG: GameConfig;
export const setGameConfig = (gameConfig: GameConfig) => (GAME_CFG = gameConfig);
