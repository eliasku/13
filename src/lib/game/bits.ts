const F32 = new Float32Array(1);
const U32 = new Uint32Array(F32.buffer);

export function u2f(u:number):number {
    U32[0] = u;
    return F32[0];
}

