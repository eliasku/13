const DEV_MODE = process.env.NODE_ENV === "development"

export const MUTE_ALL = DEV_MODE;

export const enum Const {
    NetFq = 30,
    NetDt = 1.0 / NetFq,
    InputDelay = 4,
    Prediction = 1,
}

export const DEBUG_LAG_ENABLED = DEV_MODE;
export const enum DebugLag {
    LagMin = 40,
    LagMax = 500,
    PacketLoss = 0.05
}