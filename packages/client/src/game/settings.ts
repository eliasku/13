import {IsPokiBuild} from "@iioi/shared/types.js";

const prefix = "iioi";

export const BloodMode = {
    Off: 0,
    Normal: 1,
    Paint: 2,
} as const;
export type BloodMode = (typeof BloodMode)[keyof typeof BloodMode];

export const DEFAULT_FRAMERATE_LIMIT = 60;

export const Setting = {
    Name: 0,
    Flags: 1,
    Blood: 2,
    Particles: 3,
    FrameRateCap: 4,
} as const;
export type Setting = (typeof Setting)[keyof typeof Setting];

/* @__PURE__ */
export const SettingFlag = {
    Sound: 1 << 0,
    Music: 1 << 1,
    Speech: 1 << 2,
    HighDPI: 1 << 3,
    DevMode: 1 << 4,
    DevShowFrameStats: 1 << 5,
    DevShowCollisionInfo: 1 << 6,
    DevShowDebugInfo: 1 << 7,
    DevLogging: 1 << 8,
    DevAutoPlay: 1 << 9,
    Antialiasing: 1 << 10,
} as const;
export type SettingFlag = (typeof SettingFlag)[keyof typeof SettingFlag];

interface SettingsMap {
    [Setting.Name]: string;
    [Setting.Flags]: SettingFlag;
    [Setting.Blood]: BloodMode;
    [Setting.Particles]: number;
    [Setting.FrameRateCap]: number;
}

export const settings: SettingsMap = {
    [Setting.Name]: "",
    [Setting.Flags]:
        SettingFlag.Sound |
        SettingFlag.Music |
        SettingFlag.Speech |
        SettingFlag.HighDPI |
        SettingFlag.DevShowFrameStats |
        SettingFlag.DevShowDebugInfo |
        SettingFlag.DevLogging,
    [Setting.Blood]: IsPokiBuild ? BloodMode.Paint : BloodMode.Normal,
    [Setting.Particles]: 1,
    [Setting.FrameRateCap]: DEFAULT_FRAMERATE_LIMIT,
} as const;

const getItem = (key: Setting | string): string | undefined => {
    try {
        return localStorage.getItem(prefix + key);
    } catch {
        // ignore
    }
};

const setItem = (key: Setting, value: string) => {
    try {
        localStorage.setItem(prefix + key, value);
    } catch {
        // ignore
    }
};

for (const key in settings) {
    const v = getItem(key);
    if (v != null) {
        const type = typeof settings[key];
        switch (type) {
            case "number":
                settings[key] = parseFloat(v);
                break;
            case "string":
                settings[key] = v;
                break;
        }
    }
}

export const setSetting = <K extends keyof SettingsMap>(key: K, value: SettingsMap[K]): SettingsMap[K] => {
    settings[key] = value;
    setItem(key, "" + value);
    return value;
};

/* @__PURE__ */
export const getDevFlag = (key: SettingFlag = 0): boolean =>
    (settings[Setting.Flags] & (SettingFlag.DevMode | key)) === (SettingFlag.DevMode | key);

export const enableSettingsFlag = (flag: SettingFlag) => setSetting(Setting.Flags, settings[Setting.Flags] | flag);

/* @__PURE__ */
export const hasSettingsFlag = (flag: SettingFlag): boolean => (settings[Setting.Flags] & flag) === flag;

export const toggleSettingsFlag = (mask: SettingFlag) => setSetting(Setting.Flags, settings[Setting.Flags] ^ mask);
