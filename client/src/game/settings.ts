const prefix = "l3";

export const enum BloodMode {
    Off = 0,
    Normal = 1,
    Paint = 2,
}

export const DEFAULT_FRAMERATE_LIMIT = 60;

export const settings: any = {
    name: "",
    sound: 1,
    music: 1,
    speech: 1,
    blood: BloodMode.Normal,
    particles: 1,
    highDPI: 1,
    frameRateCap: DEFAULT_FRAMERATE_LIMIT,
};

for (const key of Object.keys(settings)) {
    settings[key] = localStorage.getItem(prefix + key) ?? settings[key];
}

export function setSetting(key: string, value: any): any {
    settings[key] = value;
    localStorage.setItem(prefix + key, value);
    return value;
}

export const devSettings: any = {
    enabled: process.env.NODE_ENV === "development",
    fps: 1,
    collision: 0,
    console: 1,
    info: 0,
};

export function getDevSetting(key: string) {
    return devSettings.enabled && devSettings[key];
}
