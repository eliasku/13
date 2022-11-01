export const getOrCreate = <K, T>(map: Map<K, T>, key: K, fn: (key: K) => T): T => {
    if (!map.has(key)) {
        map.set(key, fn(key));
    }
    return map.get(key);
}

/* @__PURE__ */
export const RGB = (r: number, g: number, b: number) => r << 16 | g << 8 | b;

/* @__PURE__ */
export const getLumaColor32 = (luma: number): number => RGB(luma, luma, luma);

export const parseRGB = (color: string): number => {
    const len = color.length;
    if (len) {
        if (color.charAt(0) === "#") {
            if (color.length === 4) {
                return RGB(parseInt(color.charAt(1), 16) * 0x11,
                    parseInt(color.charAt(2), 16) * 0x11,
                    parseInt(color.charAt(3), 16) * 0x11);
            } else if (color.length === 7) {
                return RGB(parseInt(color.slice(0, 2), 16),
                    parseInt(color.slice(2, 4), 16),
                    parseInt(color.slice(4, 6), 16));
            }
        }
    }
    return 0;
}
