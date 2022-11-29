const prefix = "l3";

export const enum BloodMode {
    Off = 0,
    Normal = 1,
    Paint = 2,
}

export const DEFAULT_FRAMERATE_LIMIT = 60;

interface Settings {
    name: string;
    sound: number;
    music: number;
    speech: number;
    blood: BloodMode;
    particles: number;
    highDPI: number;
    frameRateCap: number;
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
};

for (const key of Object.keys(settings)) {
    const v = localStorage.getItem(prefix + key);
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

export function setSetting(key: string, value: any): any {
    (settings as any)[key] = value;
    localStorage.setItem(prefix + key, value);
    return value;
}

interface DevSettings {
    enabled: number;
    fps: number;
    collision: number;
    console: number;
    info: number;
}

export const devSettings: DevSettings = {
    enabled: (process.env.NODE_ENV === "development") as any | 0,
    fps: 1,
    collision: 0,
    console: 1,
    info: 0,
};

export function getDevSetting(key: string) {
    return devSettings.enabled && (devSettings as any)[key];
}
