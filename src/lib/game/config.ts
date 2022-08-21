const DEV_MODE = process.env.NODE_ENV === "development"

export const MUTE_ALL = DEV_MODE;

export const enum Const {
    NetFq = 60,
    NetDt = 1.0 / NetFq,
    InputDelay = 8,
    Prediction = 1,

    AnglesRes = 16,
}

export const DEBUG_LAG_ENABLED = DEV_MODE;
export const enum DebugLag {
    LagMin = 2000,
    LagMax = 2000,
    // PacketLoss = 0.05,
    PacketLoss = 0.5,
}