/* @__PURE__ */
export function reach(t0: number, t1: number, v: number): number {
    if (t0 < t1) {
        return Math.min(t0 + v, t1);
    } else if (t0 > t1) {
        return Math.max(t0 - v, t1);
    }
    return t0;
}

/* @__PURE__ */
export function toRad(degrees: number): number {
    return degrees * PI / 180;
}

/* @__PURE__ */
export function lerp(a: number, b: number, t: number): number {
    return (1 - t) * a + t * b;
}

/* @__PURE__ */
export function getLumaColor32(luma: number): number {
    return (luma << 16) | (luma << 8) | luma;
}

//
// /* @__PURE__ */
// export function max(a:number, b: number) {
//     return a > b ? a : b;
// }
//
// /* @__PURE__ */
// export function min(a:number, b: number) {
//     return a < b ? a : b;
// }
//
// /* @__PURE__ */
// export function abs(a:number) {
//     return a < 0 ? -a : a;
// }

export function sign(v: number) {
    return v > 0 ? 1 : -1;
}

export const PI = Math.PI;
export const PI2 = 2 * PI;
