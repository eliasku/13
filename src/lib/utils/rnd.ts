import {unorm_f32_from_u32} from "./bits";

const enum Tempering {
    MaskB = 0x9D2C5680,
    MaskC = 0xEFC60000,
}

/* @__PURE__ */
const temper = (x: number /* u32 */): number /* u32 */ => {
    x ^= x >>> 11;
    x ^= (x << 7) & Tempering.MaskB;
    x ^= (x << 15) & Tempering.MaskC;
    x ^= x >>> 18;
    return x;
}

// simple PRNG from libc with u32 state
export let _SEED = Date.now() >>> 0;

export const setSeed = (state: number) => _SEED = state;

export const nextInt = (): number /* u32 */ => {
    let x = _SEED;
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    _SEED = x;
    return temper(x) >>> 1;
}

export const rand = (max: number): number /* u32 */ => nextInt() % max;

export const random = (max: number): number /* u32 */ => nextFloat() * max;

export const nextFloat = () => unorm_f32_from_u32(nextInt());

// just visual random

export const fx_chance = (prob: number): boolean => Math.random() < prob;

export const fx_range = (min: number, max: number): number =>
    min + (max - min) * Math.random();

export const fxRand = (max: number): number => (Math.random() * max) | 0;

export const fxRandElement = <T>(m: T[]): T => m[fxRand(m.length)];

// replayable random for effects

export let _SEED2 = ~Date.now();

export const setSeed2 = (state: number) => _SEED2 = state;

export const nextInt2 = (): number /* u32 */ => {
    let x = _SEED2;
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    _SEED2 = x;
    return temper(x) >>> 1;
}

export const nextFloat2 = () => unorm_f32_from_u32(nextInt2());
