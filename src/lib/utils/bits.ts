const F32 = new Float32Array(1);
const U32 = new Uint32Array(F32.buffer);

export function u2f(u:number):number {
    U32[0] = u;
    return F32[0];
}

export function unorm_f32_from_u32(value: number /* u32 */): number {
    const exponent = 127;
    const mantissa = value & ((1 << 23) - 1);
    return u2f((exponent << 23) | mantissa) - 1;
}
