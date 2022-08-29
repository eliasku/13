/* @__PURE__ */
export function getLumaColor32(luma: number): number {
    return (luma << 16) | (luma << 8) | luma;
}

export const COLOR_WHITE = getLumaColor32(0xFF);
export const COLOR_ARM = getLumaColor32(0x88);
export const COLOR_BODY = getLumaColor32(0x44);
