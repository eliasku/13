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
    return degrees * Math.PI / 180;
}