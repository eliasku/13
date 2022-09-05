const F32 = new Float32Array(1);
const U32 = new Uint32Array(F32.buffer);

/* @__PURE__ */
export const unorm_f32_from_u32 = (value: number /* u32 */): number => {
    const exponent = 127;
    const mantissa = value & ((1 << 23) - 1);
    U32[0] = (exponent << 23) | mantissa;
    return F32[0] - 1;
}
