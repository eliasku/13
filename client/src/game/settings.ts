const prefix = "g13_";

export const settings: any = {
    sound: 1,
    music: 1,
    speech: 1,
};

for (const key of Object.keys(settings)) {
    settings[key] = localStorage.getItem(prefix + key) ?? settings[key];
}

export function setSetting(key: string, value: any): any {
    settings[key] = value;
    localStorage.setItem(prefix + key, value);
    return value;
}


