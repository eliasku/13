import {audioContext} from "./context";

// Wave shapes

const enum WaveShape {
    SQUARE = 0,
    SAWTOOTH = 1,
    SINE = 2,
    NOISE = 3,
}

const enum FParam {
    wave = 0,
    p_env_attack,
    p_env_sustain,
    p_env_punch,
    p_env_decay,
    p_base_freq,
    p_freq_limit,
    p_freq_ramp,
    p_freq_dramp,
    p_vib_strength,
    p_vib_speed,
    p_arp_mod,
    p_arp_speed,
    p_duty,
    p_duty_ramp,
    p_repeat_speed,
    p_pha_offset,
    p_pha_ramp,
    p_lpf_freq,
    p_lpf_ramp,
    p_lpf_resonance,
    p_hpf_freq,
    p_hpf_ramp,
}

// render volume
const masterVolume = 1;
const OVERSAMPLING = 8;
// default sample parameters
const base_sound_vol = 0.5;
const gain = masterVolume * (Math.exp(base_sound_vol) - 1);

// Sound generation parameters are on [0,1] unless noted SIGNED & thus
// on [-1,1]
function render(ps: number[]): Float32Array {
    let elapsedSinceRepeat = 0;

    const period0 = 100 / (ps[FParam.p_base_freq] ** 2 + 0.001);
    const periodMax = 100 / (ps[FParam.p_freq_limit] ** 2 + 0.001);
    const enableFrequencyCutoff = (ps[FParam.p_freq_limit] > 0);
    const periodMult0 = 1 - (ps[FParam.p_freq_ramp] ** 3) * 0.01;
    const periodMultSlide = -(ps[FParam.p_freq_dramp] ** 3) * 0.000001;
    const dutyCycle0 = 0.5 - ps[FParam.p_duty] * 0.5;
    const dutyCycleSlide0 = -ps[FParam.p_duty_ramp] * 0.00005;

    let arpeggioMultiplier: number;
    if (ps[FParam.p_arp_mod] >= 0) {
        arpeggioMultiplier = 1 - (ps[FParam.p_arp_mod] ** 2) * .9;
    } else {
        arpeggioMultiplier = 1 + (ps[FParam.p_arp_mod] ** 2) * 10;
    }
    let arpeggioTime0 = (((1 - ps[FParam.p_arp_speed]) ** 2) * 20000 + 32) | 0;
    if (ps[FParam.p_arp_speed] === 1) {
        arpeggioTime0 = 0;
    }

    // init repeat
    let period = period0;
    let periodMult = periodMult0;
    let dutyCycle = dutyCycle0;
    let dutyCycleSlide = dutyCycleSlide0;
    let arpeggioTime = arpeggioTime0;

// Waveform shape
    const waveShape = ps[FParam.wave] | 0;

    // Filter
    let fltw = (ps[FParam.p_lpf_freq] ** 3) * 0.1;
    const enableLowPassFilter = (ps[FParam.p_lpf_freq] !== 1);
    const fltw_d = 1 + ps[FParam.p_lpf_ramp] * 0.0001;
    let fltdmp = 5 / (1 + (ps[FParam.p_lpf_resonance] ** 2) * 20) * (0.01 + fltw);
    if (fltdmp > 0.8) {
        fltdmp = 0.8;
    }
    let flthp = (ps[FParam.p_hpf_freq] ** 2) * 0.1;
    const flthp_d = 1 + ps[FParam.p_hpf_ramp] * 0.0003;

    // Vibrato
    const vibratoSpeed = (ps[FParam.p_vib_speed] ** 2) * 0.01;
    const vibratoAmplitude = ps[FParam.p_vib_strength] * 0.5;

    // Envelope
    const envelopeLength = [
        ((ps[FParam.p_env_attack] ** 2) * 100000) | 0,
        ((ps[FParam.p_env_sustain] ** 2) * 100000) | 0,
        ((ps[FParam.p_env_decay] ** 2) * 100000) | 0,
    ];
    const envelopePunch = ps[FParam.p_env_punch];

    // Flanger
    let flangerOffset = (ps[FParam.p_pha_offset] ** 2) * 1020;
    if (ps[FParam.p_pha_offset] < 0) {
        flangerOffset = -flangerOffset;
    }
    let flangerOffsetSlide = ps[FParam.p_pha_ramp] ** 2;
    if (ps[FParam.p_pha_ramp] < 0) {
        flangerOffsetSlide = -flangerOffsetSlide;
    }

    // Repeat
    let repeatTime = (((1 - ps[FParam.p_repeat_speed]) ** 2) * 20000 + 32) | 0;
    if (ps[FParam.p_repeat_speed] === 0) {
        repeatTime = 0.0;
    }

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

    let normalized: number[] = [];

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
                sub_sample = noise_buffer[(phase * 32 / iperiod)|0];
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
        normalized.push(sample * gain / OVERSAMPLING);
    }

    return new Float32Array(normalized);
}

export function createAudioBuffer(params: number[]): AudioBuffer {
    const samples = render(params);
    const audioBuffer = audioContext.createBuffer(1, samples.length, 44100);
    audioBuffer.copyToChannel(samples, 0, 0);
    return audioBuffer;
}

