import {writeFileSync} from "fs";
import {FParam, WaveShape} from "../src/lib/audio/sfxr";

function numberToFloat(bytes: number) {
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

    return sign * significand * (2 ** exponent);
}


const b58alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function b58_decode(S: any, A: string) {
    var d: any[] = [], b: any[] = [], i: any, j, c, n;
    for (i in S) {
        j = 0, c = A.indexOf(S[i]);
        if (c < 0) return undefined;
        c || b.length ^ i ? i : b.push(0);
        while (j in d || c) {
            n = d[j];
            n = n ? n * 58 + c : c;
            c = n >> 8;
            d[j] = n % 256;
            j++;
        }
    }
    while (j--) b.push(d[j]);
    return new Uint8Array(b);
}

function convert(code: string): Float32Array {
    const data = b58_decode(code, b58alphabet);
    const wave = data[0];
    const params = new Float32Array(24);
    params[0] = wave;
    let pi = 1;
    for (let i = 1; i < data.length; i += 4) {
        const val = (data[i] | (data[i + 1] << 8) | (data[i + 2] << 16) | (data[i + 3] << 24));
        params[pi++] = numberToFloat(val);
    }
    return params;
}

function f2a(f: number) {
    const x = Math.round(f * 1e6) / 1e6;
    //console.log(x);
    return x.toString();
    // const a = f.toString();
    // let b = f.toPrecision(6);
    // while (b.length > 3 && (b[b.length - 1] === "0" || b[b.length - 1] === ".")) {
    //     b = b.substring(0, b.length - 1);
    // }
    // return a.length < b.length ? a : b;
}

function sign(s: number) {
    return s >= 0 ? 1 : -1;
}

function prepare(ps: Float32Array) {
    ps[FParam.p_base_freq] = 100 / (ps[FParam.p_base_freq] ** 2 + 0.001);
    ps[FParam.p_freq_limit] = sign(ps[FParam.p_freq_limit]) * (100 / (ps[FParam.p_freq_limit] ** 2 + 0.001));
    ps[FParam.p_freq_ramp] = 1 - (ps[FParam.p_freq_ramp] ** 3) * 0.01;
    ps[FParam.p_freq_dramp] = -(ps[FParam.p_freq_dramp] ** 3) * 0.000001;
    ps[FParam.p_duty] = 0.5 - ps[FParam.p_duty] * 0.5;
    ps[FParam.p_duty_ramp] = -ps[FParam.p_duty_ramp] * 0.00005;

// p_arp_mod
    if (ps[FParam.p_arp_mod] >= 0) {
        ps[FParam.p_arp_mod] = 1 - (ps[FParam.p_arp_mod] ** 2) * .9;
    } else {
        ps[FParam.p_arp_mod] = 1 + (ps[FParam.p_arp_mod] ** 2) * 10;
    }

    if (ps[FParam.p_arp_speed] === 1) {
        ps[FParam.p_arp_speed] = 0;
    } else {
        ps[FParam.p_arp_speed] = (((1 - ps[FParam.p_arp_speed]) ** 2) * 20000 + 32) | 0;
    }

    ps[FParam.p_lpf_freq] = (ps[FParam.p_lpf_freq] ** 3) * 0.1;
    ps[FParam.p_lpf_ramp] = 1 + ps[FParam.p_lpf_ramp] * 0.0001;
    ps[FParam.p_lpf_resonance] = 5 / (1 + (ps[FParam.p_lpf_resonance] ** 2) * 20) * (0.01 + ps[FParam.p_lpf_freq]);
    if (ps[FParam.p_lpf_resonance] > 0.8) {
        ps[FParam.p_lpf_resonance] = 0.8;
    }

    ps[FParam.p_hpf_freq] = (ps[FParam.p_hpf_freq] ** 2) * 0.1;
    ps[FParam.p_hpf_ramp] = 1 + ps[FParam.p_hpf_ramp] * 0.0003;

// Vibrato
    ps[FParam.p_vib_speed] = (ps[FParam.p_vib_speed] ** 2) * 0.01;
    ps[FParam.p_vib_strength] = ps[FParam.p_vib_strength] * 0.5;

    ps[FParam.p_env_attack] = ((ps[FParam.p_env_attack] ** 2) * 100000) | 0;
    ps[FParam.p_env_sustain] = ((ps[FParam.p_env_sustain] ** 2) * 100000) | 0;
    ps[FParam.p_env_decay] = ((ps[FParam.p_env_decay] ** 2) * 100000) | 0;

    ps[FParam.p_pha_offset] = sign(ps[FParam.p_pha_offset]) * (ps[FParam.p_pha_offset] ** 2) * 1020;
    ps[FParam.p_pha_ramp] = sign(ps[FParam.p_pha_ramp]) * (ps[FParam.p_pha_ramp] ** 2);

    if (ps[FParam.p_repeat_speed] !== 0) {
        ps[FParam.p_repeat_speed] = (((1 - ps[FParam.p_repeat_speed]) ** 2) * 20000 + 32) | 0;
    }
}

function dumpProps(ps: Float32Array) {
    const aa = [];
    for (const x of ps) {
        aa.push(f2a(x));
    }
    return aa.join(",");
    //return ps.map(x => f2a(x)).join(",");
}

interface SoundDecl {
    name: string[];
    code: string;
    i?: number;
    props?: Float32Array;
}

const sounds: SoundDecl[] = [
    {
        name: ["blip", "heal", "med", "pick"],
        code: "34T6PktZ4axhapFFPhA7twnABw1FyGConUjS8Cjshjym6iNCamakVukZ6reS863897Kae2Bp3geSHwpXmPdFQD5nRUNYSEi1LrMcgRQQkizcA1oejht1thzxN",
    },
    {
        name: ["shoot"],
        code: "7BMHBGCZFc5aXpRKETBQrCjuxUuwoF1F9ovqMuZrUQGBZoaxzcfaju2BmsHwoKoDn94PoU8TXMZbj3a1vHybBzAjLAg23LTxxKZ5Fg2hm8vkquRVUSZWcNdHy",
    },
    {
        name: ["hurt"],
        code: "7BMHBGLMAznxzJ78hkrpuCXM31jegR1XjMXwBKbBZUF2zxQQA9g8gijGoRwDQZGYXhV7kgdDVvWQZKFKgXNrJRYjs8aLhSZsqe3ozazwDoPWhAXU43yKwuEo1",
    },
    {
        name: ["death"],
        code: "7BMHBGGKpyvRwcXtGttesStu6m23jzcDvcG8bnqS4SgPBx5554BK1puNbNfMwRpdTKMycqqXeZv8VSkTVvqPpqAsxZ5Krr3ABqC7DMjBSM1fH9StqLonjPZ6o",
    },
    {
        name: ["step"],
        code: "7xZZDfZUkmERHMZGxWZxTXMdzAy7KnWbSCg1L13bqeCPvUfXgDPFGnMgmUMunc92GcQfsduC7fd8AiaBBJkLxfPZRradR6M5sUw6L6f8eNiP8cktDj7frKQLM",
    },
    {
        name: ["hit"],
        code: "11111LdfTv5fuPjEPZxtWMy1KMWu8ftYhofNkw9BguFGjEtUk1kNM3RJnizPEyfhNfUwmmJZUYTNHEU8VAUKCmnyMgmYvW5UVkBL92Cmh2Hvrbor8sbFFdH"
    }
];

const enumerations = [];
for (let i = 0; i < sounds.length; ++i) {
    const sound = sounds[i];
    const ps = convert(sound.code);
    prepare(ps);
    ps[FParam.length] = resolveLength(ps);
    console.warn(ps[FParam.length]);
    ps[FParam.p_freq_limit] = Math.abs(ps[FParam.p_freq_limit]);
    sound.props = ps;
    sound.i = i;
    for (const name of sound.name) {
        enumerations.push(name + " = " + i + ",");
    }
}

let code = `import {createAudioBuffer} from "../audio/sfxr";

export const enum Snd {
  ${enumerations.join("\n  ")}
}

export const snd:AudioBuffer[] = [];
`;
code += `

function createAudioBuffers(buffer: ArrayBuffer) {
  const i32 = new Int32Array(buffer);
  for(let i = 0; i < ${sounds.length}; ++i) {
    snd[i] = createAudioBuffer(Array.from(i32.subarray(i * 24, i * 24 + 24)).map(x => x / 65536));
  }
}

export async function loadSounds() {
  createAudioBuffers(new Float32Array((await (await fetch("r")).arrayBuffer())));
}

export function loadSoundsInline() {
  snd.push(
    ${sounds.map(x => `createAudioBuffer([${dumpProps(x.props)}]),`).join("\n    ")}
  );
}
`;

// const floats = new Float32Array(1024 * 64);
// let ptr = 0;
//
// for (const sound of sounds) {
//     for (const prop of sound.props) {
//         floats[ptr++] = prop;
//     }
// }

const i32 = new Int32Array(1024 * 64);
let ptr = 0;

for (const sound of sounds) {
    for (const prop of sound.props) {
        i32[ptr++] = prop * 65536;
    }
}

writeFileSync("public/r", i32.subarray(0, ptr));
writeFileSync("src/lib/assets/sfx.ts", code, "utf8");

function resolveLength(ps: Float32Array): number {
    const OVERSAMPLING = 8;
    let elapsedSinceRepeat = 0;

    const period0 = ps[FParam.p_base_freq];
    const periodMax = Math.abs(ps[FParam.p_freq_limit]);
    const enableFrequencyCutoff = ps[FParam.p_freq_limit] > 0;
    const periodMult0 = ps[FParam.p_freq_ramp];
    const periodMultSlide = ps[FParam.p_freq_dramp];
    const dutyCycle0 = ps[FParam.p_duty];
    const dutyCycleSlide0 = ps[FParam.p_duty_ramp];
    const arpeggioMultiplier = ps[FParam.p_arp_mod];
    const arpeggioTime0 = ps[FParam.p_arp_speed];

    // init repeat
    let period = period0;
    let periodMult = periodMult0;
    let dutyCycle = dutyCycle0;
    let dutyCycleSlide = dutyCycleSlide0;
    let arpeggioTime = arpeggioTime0;

// Waveform shape
    const waveShape = ps[FParam.wave];

    // Filter
    let fltw = ps[FParam.p_lpf_freq];
    const enableLowPassFilter = (fltw !== 0.1);
    const fltw_d = ps[FParam.p_lpf_ramp];
    const fltdmp = ps[FParam.p_lpf_resonance];
    let flthp = ps[FParam.p_hpf_freq];
    const flthp_d = ps[FParam.p_hpf_ramp];

    // Vibrato
    const vibratoSpeed = ps[FParam.p_vib_speed];
    const vibratoAmplitude = ps[FParam.p_vib_strength];

    // Envelope
    const envelopeLength = [
        ps[FParam.p_env_attack],
        ps[FParam.p_env_sustain],
        ps[FParam.p_env_decay],
    ];
    const envelopePunch = ps[FParam.p_env_punch];

    // Flanger
    let flangerOffset = ps[FParam.p_pha_offset];
    const flangerOffsetSlide = ps[FParam.p_pha_ramp];

    // Repeat
    const repeatTime = ps[FParam.p_repeat_speed];

    ////////// RENDER
    let fltp = 0;
    let fltdp = 0;
    let fltphp = 0;

    let noise_buffer = new Float32Array(32);
    for (let i = 0; i < 32; ++i) {
        noise_buffer[i] = Math.random() * 2 - 1;
    }

    let envelopeStage = 0;
    let envelopeElapsed = 0;

    let vibratoPhase = 0;

    let phase = 0;
    let ipp = 0;
    let flanger_buffer = new Float32Array(1024);
    for (let i = 0; i < 1024; ++i) {
        flanger_buffer[i] = 0;
    }

    let length = 0;

    for (let t = 0; ; ++t) {

        // Repeats
        if (repeatTime !== 0 && ++elapsedSinceRepeat >= repeatTime) {
            // INIT REPEAT
            period = period0;
            periodMult = periodMult0;
            dutyCycle = dutyCycle0;
            dutyCycleSlide = dutyCycleSlide0;
            arpeggioTime = arpeggioTime0;
        }

        // Arpeggio (single)
        if (arpeggioTime !== 0 && t >= arpeggioTime) {
            arpeggioTime = 0;
            period *= arpeggioMultiplier;
        }

        // Frequency slide, and frequency slide slide!
        periodMult += periodMultSlide;
        period *= periodMult;
        if (period > periodMax) {
            period = periodMax;
            if (enableFrequencyCutoff) {
                break;
            }
        }

        // Vibrato
        let rfperiod = period;
        if (vibratoAmplitude > 0) {
            vibratoPhase += vibratoSpeed;
            rfperiod = period * (1 + Math.sin(vibratoPhase) * vibratoAmplitude);
        }
        let iperiod = Math.floor(rfperiod);
        if (iperiod < OVERSAMPLING) {
            iperiod = OVERSAMPLING;
        }

        // Square wave duty cycle
        dutyCycle += dutyCycleSlide;
        if (dutyCycle < 0) {
            dutyCycle = 0;
        }
        if (dutyCycle > 0.5) {
            dutyCycle = 0.5;
        }

        // Volume envelope
        if (++envelopeElapsed > envelopeLength[envelopeStage]) {
            envelopeElapsed = 0;
            if (++envelopeStage > 2) {
                break;
            }
        }
        const envf = envelopeElapsed / envelopeLength[envelopeStage];
        let env_vol;
        if (envelopeStage === 0) {         // Attack
            env_vol = envf;
        } else if (envelopeStage === 1) {  // Sustain
            env_vol = 1 + (1 - envf) * 2 * envelopePunch;
        } else {                           // Decay
            env_vol = 1 - envf;
        }

        // Flanger step
        flangerOffset += flangerOffsetSlide;
        let iphase = Math.abs(Math.floor(flangerOffset));
        if (iphase > 1023) {
            iphase = 1023;
        }

        if (flthp_d !== 0) {
            flthp *= flthp_d;
            if (flthp < 0.00001) {
                flthp = 0.00001;
            }
            if (flthp > 0.1) {
                flthp = 0.1;
            }
        }

        // 8x oversampling
        let sample = 0;
        for (let si = 0; si < OVERSAMPLING; ++si) {
            let sub_sample = 0;
            ++phase;
            if (phase >= iperiod) {
                phase %= iperiod;
                if (waveShape === WaveShape.NOISE) {
                    for (let i = 0; i < 32; ++i) {
                        noise_buffer[i] = Math.random() * 2 - 1;
                    }
                }
            }

            // Base waveform
            const fp = phase / iperiod;
            if (waveShape === WaveShape.SQUARE) {
                sub_sample = fp < dutyCycle ? 0.5 : -0.5;
            } else if (waveShape === WaveShape.SAWTOOTH) {
                if (fp < dutyCycle) {
                    sub_sample = -1 + 2 * fp / dutyCycle;
                } else {
                    sub_sample = 1 - 2 * (fp - dutyCycle) / (1 - dutyCycle);
                }
            } else if (waveShape === WaveShape.SINE) {
                sub_sample = Math.sin(fp * 2 * Math.PI);
            } else if (waveShape === WaveShape.NOISE) {
                sub_sample = noise_buffer[(phase * 32 / iperiod) | 0];
            } else {
                // no-op; invalid wave shape
            }

            // Low-pass filter
            const pp = fltp;
            fltw *= fltw_d;
            if (fltw < 0) {
                fltw = 0;
            }
            if (fltw > 0.1) {
                fltw = 0.1;
            }
            if (enableLowPassFilter) {
                fltdp += (sub_sample - fltp) * fltw;
                fltdp -= fltdp * fltdmp;
            } else {
                fltp = sub_sample;
                fltdp = 0;
            }
            fltp += fltdp;

            // High-pass filter
            fltphp += fltp - pp;
            fltphp -= fltphp * flthp;
            sub_sample = fltphp;

            // Flanger
            flanger_buffer[ipp & 1023] = sub_sample;
            sub_sample += flanger_buffer[(ipp - iphase + 1024) & 1023];
            ipp = (ipp + 1) & 1023;

            // final accumulation and envelope application
            sample += sub_sample * env_vol;
        }

        // store normalized floating point sample
        ++length;
    }
    return length;
}
