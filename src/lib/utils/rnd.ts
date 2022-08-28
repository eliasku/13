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
let _state = (Math.random() * 0xFFFFFFFF) >>> 0;

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
