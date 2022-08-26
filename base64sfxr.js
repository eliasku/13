// http://stackoverflow.com/a/16001019
function numberToFloat(bytes) {
    const sign = (bytes & 0x80000000) ? -1 : 1;
    let exponent = ((bytes >> 23) & 0xFF) - 127;
    let significand = (bytes & ~(-1 << 23));

    if (exponent === 128)
        return sign * ((significand) ? Number.NaN : Number.POSITIVE_INFINITY);

    if (exponent === -127) {
        if (significand === 0) {
            return sign * 0.0;
        }
        exponent = -126;
        significand /= (1 << 22);
    } else significand = (significand | (1 << 23)) / (1 << 23);

    return sign * significand * (2 **  exponent);
}


const b58alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function b58_decode(S, A) {
    var d = [], b = [], i, j, c, n;
    for (i in S) {
        j = 0, c = A.indexOf(S[i]);
        if (c < 0) return undefined;
        c || b.length ^ i ? i : b.push(0);
        while (j in d || c) {
            n = d[j];
            n = n ? n * 58 + c : c;
            c = n >> 8;
            d[j] = n % 256;
            j++
        }
    }
    while (j--) b.push(d[j]);
    return new Uint8Array(b)
}

function convert(ps) {
    const data = b58_decode(ps, b58alphabet);
    const wave = data[0];
    const params = new Float32Array(23);
    params[0] = wave;
    let pi = 1;
    for (let i = 1; i < data.length; i += 4) {
        const val = (data[i] | (data[i + 1] << 8) | (data[i + 2] << 16) | (data[i + 3] << 24));
        params[pi++] = numberToFloat(val);
    }
    return params;
}

// shoot
// const r = convert("111113CjSbiwgL7MCabvaf7PbN55NqyGNGJsc27VBCUVG4PacbecoNzEVkMXegFvqwjfAoaKnWn9MwEMS6LptqYFLuvYMzoEx2nqChUkCQ9B8GchiPHMz9D1");
// jump
const r = convert("11111Eh1QLewCdFgvpScbFobMMBFcDb6ToxYYSNKnhVmf1jk33vrHuiey9dftNbkzyDfCN9LY6uV3ctAtpvNNWRQFGtb5PdYHJBpWk6j6VZCoXZR5uXA6oGB");
const ps = [...r.values()];

function f2a(f) {
    // const a = f.toString();
    // let b = f.toPrecision(16);
    // while (b.length > 3 && (b[b.length - 1] === "0" || b[b.length - 1] === ".")) {
    //     b = b.substring(0, b.length - 1);
    // }
    // return a.length < b.length ? a : b;
    return f.toString();
}


const wave = 0;
const p_env_attack = 1;
const p_env_sustain = 2;
const p_env_punch = 3;
const p_env_decay = 4;
const p_base_freq = 5;
const p_freq_limit = 6;
const p_freq_ramp = 7;
const p_freq_dramp = 8;
const p_vib_strength = 9;
const p_vib_speed = 10;
const p_arp_mod = 11;
const p_arp_speed = 12;
const p_duty = 13;
const p_duty_ramp = 14;
const p_repeat_speed = 15;
const p_pha_offset = 16;
const p_pha_ramp = 17;
const p_lpf_freq = 18;
const p_lpf_ramp = 19;
const p_lpf_resonance = 20;
const p_hpf_freq = 21;
const p_hpf_ramp = 22;

ps[p_env_attack] = ((ps[p_env_attack] ** 2) * 100000) | 0;
ps[p_env_sustain] = ((ps[p_env_sustain] ** 2) * 100000) | 0;
ps[p_env_decay] = ((ps[p_env_decay] ** 2) * 100000) | 0;

ps[p_hpf_freq] = (ps[p_hpf_freq] ** 2) * 0.1;
ps[p_hpf_ramp] = 1 + ps[p_hpf_ramp] * 0.0003;

// Vibrato
ps[p_vib_speed] = (ps[p_vib_speed] ** 2) * 0.01;
ps[p_vib_strength] = ps[p_vib_strength] * 0.5;

ps[p_pha_offset] = Math.sign(ps[p_pha_offset]) * (ps[p_pha_offset] ** 2) * 1020;
ps[p_pha_ramp] = Math.sign(ps[p_pha_ramp]) * (ps[p_pha_ramp] ** 2);

ps[p_duty] = 0.5 - ps[p_duty] * 0.5;
ps[p_duty_ramp] = -ps[p_duty_ramp] * 0.00005;

// p_arp_mod
if (ps[p_arp_mod] >= 0) {
    ps[p_arp_mod] = 1 - (ps[p_arp_mod] ** 2) * .9;
} else {
    ps[p_arp_mod] = 1 + (ps[p_arp_mod] ** 2) * 10;
}

if (ps[p_arp_speed] === 1) {
    ps[p_arp_speed] = 0;
} else {
    ps[p_arp_speed] = (((1 - ps[p_arp_speed]) ** 2) * 20000 + 32) | 0;
}

ps[p_base_freq] = 100 / (ps[p_base_freq] ** 2 + 0.001);
ps[p_freq_limit] = Math.sign(ps[p_freq_limit]) * 100 / (ps[p_freq_limit] ** 2 + 0.001);
ps[p_freq_ramp] = 1 - (ps[p_freq_ramp] ** 3) * 0.01;
ps[p_freq_dramp] = -(ps[p_freq_dramp] ** 3) * 0.000001;
ps[p_lpf_ramp] = 1 + ps[p_lpf_ramp] * 0.0001;

if (ps[p_repeat_speed] !== 0) {
    ps[p_repeat_speed] = (((1 - ps[p_repeat_speed]) ** 2) * 20000 + 32) | 0;
}

ps[p_lpf_freq] = (ps[p_lpf_freq] ** 3) * 0.1;
ps[p_lpf_resonance] = 5 / (1 + (ps[p_lpf_resonance] ** 2) * 20) * (0.01 + ps[p_lpf_freq]);
if (ps[p_lpf_resonance] > 0.8) {
    ps[p_lpf_resonance] = 0.8;
}

console.info(`[${ps.map(x => f2a(x)).join(",")}]`);
console.info(ps[p_pha_offset]);
console.info(ps[p_pha_ramp]);
