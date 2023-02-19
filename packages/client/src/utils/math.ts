/* @__PURE__ */
export const {max, min, abs, sin, cos, atan2, hypot, PI, sqrt, tan, imul, round, exp, log} = Math;

/* @__PURE__ */
export const PI2 = 2 * PI;

/* @__PURE__ */
export const TO_RAD = PI / 180;

/* @__PURE__ */
export const lerp = (a: number, b: number, t: number): number => (1 - t) * a + t * b;

/* @__PURE__ */
export const lerpLog = (a: number, b: number, t: number): number => exp(lerp(log(a), log(b), t));

/* @__PURE__ */
export const dec1 = (x: number) => (x ? --x : x);

/* @__PURE__ */
export const clamp = (x: number, _min: number, _max: number) => min(_max, max(x, _min));

/* @__PURE__ */
export const sign = (v: number) => (v > 0 ? 1 : -1);

/* @__PURE__ */
export const reach = (t0: number, t1: number, v: number): number => {
    if (t0 < t1) {
        return min(t0 + v, t1);
    } else if (t0 > t1) {
        return max(t0 - v, t1);
    }
    return t0;
};

export const sqrLength3 = (x: number, y: number, z: number) => x * x + y * y + z * z;
