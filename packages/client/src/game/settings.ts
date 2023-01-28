const prefix = "iioi";

export const enum BloodMode {
    Off = 0,
    Normal = 1,
    Paint = 2,
}

export const DEFAULT_FRAMERATE_LIMIT = 60;

export const enum Setting {
    Name,
    Flags,
    Blood,
    Particles,
    FrameRateCap
}

export const enum SettingFlag {
    Sound = 1 << 0,
    Music = 1 << 1,
    Speech = 1 << 2,
    HighDPI = 1 << 3,
    DevMode = 1 << 4,
    DevShowFrameStats = 1 << 5,
    DevShowCollisionInfo = 1 << 6,
    DevShowDebugInfo = 1 << 7,
    DevLogging = 1 << 8,
    DevAutoPlay = 1 << 9,

}

interface SettingsMap {
    [Setting.Name]: string;
    [Setting.Flags]: SettingFlag;
    [Setting.Blood]: BloodMode;
    [Setting.Particles]: number;
    [Setting.FrameRateCap]: number;
}

export const settings: SettingsMap = {
    [Setting.Name]: "",
    [Setting.Flags]: SettingFlag.Sound | SettingFlag.Music | SettingFlag.Speech | SettingFlag.DevShowFrameStats | SettingFlag.DevShowDebugInfo | SettingFlag.DevLogging,
    [Setting.Blood]: BloodMode.Normal,
    [Setting.Particles]: 1,
    [Setting.FrameRateCap]: DEFAULT_FRAMERATE_LIMIT,
};

const getItem = (key: Setting): any => {
    try {
        return localStorage.getItem(prefix + key);
    } catch {
    }
}

const setItem = (key: Setting, value: any) => {
    try {
        localStorage.setItem(prefix + key, value);
    } catch {
    }
}

for (const key in settings) {
    const v = getItem(key as any as Setting);
    if (v != null) {
        const type = typeof (settings as any)[key];
        switch (type) {
            case "number":
                (settings as any)[key] = parseFloat(v);
                break;
            case "string":
                (settings as any)[key] = v;
                break;
        }
    }
}

export function setSetting<K extends keyof SettingsMap>(key: K, value: SettingsMap[K]): any {
    settings[key] = value;
    setItem(key, value);
    return value;
}

export function getDevFlag(key: SettingFlag = 0) {
    return (settings[Setting.Flags] & (SettingFlag.DevMode | key)) === (SettingFlag.DevMode | key);
}

export function enableSettingsFlag(flag: SettingFlag) {
    setSetting(Setting.Flags, settings[Setting.Flags] | flag);
}

export function hasSettingsFlag(flag: SettingFlag) {
    return settings[Setting.Flags] & flag;
}

export function toggleSettingsFlag(mask: SettingFlag) {
    setSetting(Setting.Flags, settings[Setting.Flags] ^ mask);
}
