import {imul} from "./math";

const enum Hash {
    Seed = 48639327,
    Mod = 427,
}

const H = (str: string, i = Hash.Seed, a = "################################", c?: string) => {
    for (c of str) {
        i = (imul(i, 23131) + c.charCodeAt(0)) >>> 0;
    }
    i %= Hash.Mod;
    return a[i % 32] + (i < 32 ? [] : a[i >> 5]);
}

export const rehash = <T extends object>(obj: T): T => {
    for (const i in obj) {
        if (i[4] && i[0] > "_") {
            Reflect.defineProperty(obj, H(i), {
                get(): any {
                    return this[i];
                },
                set(v: any) {
                    this[i] = v;
                },
            });
        }
    }
    return obj;
}
