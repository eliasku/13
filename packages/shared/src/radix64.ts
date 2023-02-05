const i2v = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-.".split("");
const v2i: Record<string, number> = {};
i2v.map((v, i) => (v2i[v] = i));

export const toRadix64String = (i32: number): string => {
    let result = "";
    for (;;) {
        result = i2v[i32 & 0x3f] + result;
        i32 >>>= 6;
        if (!i32) {
            break;
        }
    }
    return result;
};

export const parseRadix64String = (str: string): number => {
    let result = 0;
    const digits = str.split("");
    for (let i = 0; i < digits.length; ++i) {
        result = (result << 6) + v2i[digits[i]];
    }
    return result;
};
