const prefix = "l3";

export const enum BloodMode {
    Off = 0,
    Normal = 1,
    Paint = 2,
}

export const DEFAULT_FRAMERATE_LIMIT = 60;

type DevSettingsKey =
    "dev" |
    "dev_fps" |
    "dev_collision" |
    "dev_console" |
    "dev_info";

type SettingsKey = DevSettingsKey |
    "name" |
    "sound" |
    "music" |
    "speech" |
    "blood" |
    "particles" |
    "highDPI" |
    "frameRateCap";

interface Settings {
    name: string;
    sound: number;
    music: number;
    speech: number;
    blood: BloodMode;
    particles: number;
    highDPI: number;
    frameRateCap: number;

    dev: number;
    dev_fps: number;
    dev_collision: number;
    dev_console: number;
    dev_info: number;
}

export const settings: Settings = {
    name: "",
    sound: 1,
    music: 1,
    speech: 1,
    blood: BloodMode.Normal,
    particles: 1,
    highDPI: 1,
    frameRateCap: DEFAULT_FRAMERATE_LIMIT,
    dev: 0,
    dev_fps: 1,
    dev_collision: 0,
    dev_console: 1,
    dev_info: 0,
};

const getItem = (key: string): any => {
    try {
        return localStorage.getItem(prefix + key);
    } catch {
    }
}

const setItem = (key: string, value: any) => {
    try {
        localStorage.setItem(prefix + key, value);
    } catch {
    }
}

for (const key of Object.keys(settings)) {
    const v = getItem(key);
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

export function setSetting(key: SettingsKey, value: any): any {
    (settings as any)[key] = value;
    setItem(key, value);
    return value;
}

export function getDevSetting(key: DevSettingsKey) {
    return settings.dev && settings[key];
}
