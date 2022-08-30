/* @__PURE__ */
export function getLumaColor32(luma: number): number {
    return (luma << 16) | (luma << 8) | luma;
}

export const COLOR_WHITE = getLumaColor32(0xFF);
// export const COLOR_ARM = getLumaColor32(0x44);
// export const COLOR_BODY = getLumaColor32(0x22);

export const COLOR_BODY = [0xFF99DD, 0xFFCC99, 0xCCFF99, 0x222222, 0x8855FF, 0xCCCCCC];

"#FF99DD";
"#FFCC99";
"#CCFF99";

"#845efd";
"#222";
"#c4c4c4";