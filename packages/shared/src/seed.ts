const enum Tempering {
    MaskB = 0x9D2C5680,
    MaskC = 0xEFC60000,
}

/* @__PURE__ */
export const temper = (x: number /* u32 */): number /* u32 */ => {
    x ^= x >>> 11;
    x ^= (x << 7) & Tempering.MaskB;
    x ^= (x << 15) & Tempering.MaskC;
    x ^= x >>> 18;
    return x >>> 1;
}

export const rollSeed32 = (seed: number): number => (Math.imul(seed, 1103515245) + 12345) >>> 0;
