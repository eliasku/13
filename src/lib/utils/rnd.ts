import {unorm_f32_from_u32} from "./bits";

const enum Tempering {
    MaskB = 0x9D2C5680,
    MaskC = 0xEFC60000,
}

/* @__PURE__ */
function temper(x: number /* u32 */): number /* u32 */ {
    x ^= x >>> 11;
    x ^= (x << 7) & Tempering.MaskB;
    x ^= (x << 15) & Tempering.MaskC;
    x ^= x >>> 18;
    return x;
}

// simple PRNG from libc with u32 state
let _state = ~Date.now();

/* @__PURE__ */
export function getSeed() {
    return _state;
}

export function seed(state: number) {
    _state = state;
}

export function nextInt(): number /* u32 */ {
    let x = _state;
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    _state = x;
    return temper(x) >>> 1;
}

export function rand(max: number): number /* u32 */ {
    return nextInt() % max;
}

export function random(max: number): number /* u32 */ {
    return nextFloat() * max;
}


export function nextFloat() {
    return unorm_f32_from_u32(nextInt());
}


export function fx_chance(prob: number): boolean {
    return Math.random() < prob;
}

export function fx_range(min: number, max: number): number {
    return min + (max - min) * Math.random();
}

export function fxRand(max: number): number {
    return (Math.random() * max) | 0;
}

export function fxRandElement<T>(m: T[]): T {
    return m[fxRand(m.length)];
}
