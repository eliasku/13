import {unorm_f32_from_u32} from "./bits";
import {newSeedFromTime, rollSeed32, temper} from "@eliasku/13-shared/src/seed";

// simple PRNG from libc with u32 state
export const _SEEDS = [, , ,].fill(newSeedFromTime());

export const nextInt = (idx = 0): number /* u32 */ =>
    temper(_SEEDS[idx] = rollSeed32(_SEEDS[idx]));

export const rand = (max: number): number /* u32 */ => nextInt() % max;
export const random = (max: number = 1, idx?: number) => max * unorm_f32_from_u32(nextInt(idx));
export const random1n = (v: number = 1) => random(v * 2, 1) - v;
export const random1i = (max: number) => nextInt(1) % max;
export const random1 = (max?: number) => random(max, 1);

// just visual random

export const fxRandom = (max: number = 1): number => random(max, 2);
export const fxRandomNorm = (max: number): number => 2 * fxRandom(max) - max;
export const fxRand = (max: number): number => nextInt(2) % max;
export const fxRandElement = <T>(m: T[]): T => m[fxRand(m.length)];
