/* @__PURE__ */
export const reach = (t0: number, t1: number, v: number): number => {
    if (t0 < t1) {
        return Math.min(t0 + v, t1);
    } else if (t0 > t1) {
        return Math.max(t0 - v, t1);
    }
    return t0;
}

/* @__PURE__ */
export const toRad = (degrees: number): number => degrees * PI / 180;

/* @__PURE__ */
export const lerp = (a: number, b: number, t: number): number => (1 - t) * a + t * b;

/* @__PURE__ */
export const getLumaColor32 = (luma: number): number => (luma << 16) | (luma << 8) | luma;

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

export const PI = Math.PI;
export const PI2 = 2 * PI;
