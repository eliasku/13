export const M = Math;
export const PI = M.PI;
export const PI2 = 2 * PI;

/* @__PURE__ */
export const reach = (t0: number, t1: number, v: number): number => {
    if (t0 < t1) {
        return M.min(t0 + v, t1);
    } else if (t0 > t1) {
        return M.max(t0 - v, t1);
    }
    return t0;
}

export const clamp = (x: number, min: number, max: number) => x > min ? (x < max ? x : max) : min;

export const TO_RAD = PI / 180;

/* @__PURE__ */
export const lerp = (a: number, b: number, t: number): number => (1 - t) * a + t * b;

/* @__PURE__ */
export const getLumaColor32 = (luma: number): number => (luma << 16) | (luma << 8) | luma;

export const dec1 = (x:number) => x ? --x : x;
export const incTo = (x:number, max: number) => x < max ? ++x : x;
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

export const sign = (v: number) => v > 0 ? 1 : -1;
