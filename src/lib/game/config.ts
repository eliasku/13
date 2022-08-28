export const DEBUG_TERM = 1;

export const enum Const {
    NetFq = 60,
    InputDelay = 8,

    // ~35 bytes
    Prediction = 0,

    // ~130 bytes
    RLE = 0,

    AnglesRes = 16,
    ViewAngleRes = 256,
}

export const enum DebugLag {
    // LagMin = 20,
    // LagMax = 200,
    // PacketLoss = 0.05,

    // Heart-Attack mode
    LagMin = 500,
    LagMax = 2000,
    PacketLoss = 0.5,
}