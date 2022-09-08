import {unorm_f32_from_u32} from "./bits";
import {M} from "./math";

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
    return x >>> 1;
}

// simple PRNG from libc with u32 state
export let _SEED = new Date as any as number >>> 0;
export let _SEED2 = new Date as any as number >>> 0;

export const setSeed = (state: number) => _SEED = state;

export const nextInt = (): number /* u32 */ =>
    temper(_SEED = (M.imul(_SEED, 1103515245) + 12345) >>> 0);

export const rand = (max: number): number /* u32 */ => nextInt() % max;

export const random = (max: number): number /* u32 */ => nextFloat() * max;

export const nextFloat = () => unorm_f32_from_u32(nextInt());

// just visual random

export const fxRandomNorm = (max: number): number => max * 2 * (0.5 - M.random());
export const fxRand = (max: number): number => (M.random() * max) | 0;

export const fxRandElement = <T>(m: T[]): T => m[fxRand(m.length)];

// replayable random for effects

export const setSeed2 = (state: number) => _SEED2 = state;

export const nextInt2 = (): number /* u32 */ => {
    _SEED2 = (M.imul(_SEED2, 1103515245) + 12345) >>> 0;
    return temper(_SEED2) >>> 1;
}

export const nextFloat2 = () => unorm_f32_from_u32(nextInt2());
