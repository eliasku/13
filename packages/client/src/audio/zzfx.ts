import {audioContext} from "./context";
import {abs, clamp, cos, PI2, round, sign, sin, tan} from "../utils/math";
import {fxRandom} from "../utils/rnd";

export const zzfx = (code: number[]): AudioBuffer => zzfxG(...code);

const zzfxG = (
    // parameters
    volume = 1, randomness = .05, frequency = 220, attack = 0, sustain = 0,
    release = .1, shape = 0, shapeCurve = 1, slide = 0, deltaSlide = 0,
    pitchJump = 0, pitchJumpTime = 0, repeatTime = 0, noise = 0, modulation = 0,
    bitCrush = 0, delay = 0, sustainVolume = 1, decay = 0, tremolo = 0,
    // VARS
    zzfxR = 44100, zzfxV = .3
): AudioBuffer => {
    // init parameters
    let startSlide = slide *= 500 * PI2 / zzfxR / zzfxR,
        startFrequency = frequency *= (1 + randomness * 2 * fxRandom() - randomness)
            * PI2 / zzfxR,
        b = [], t = 0, tm = 0, i = 0, j = 1, r = 0, c = 0, s = 0, f, length;

    // scale by sample rate
    attack = attack * zzfxR + 9; // minimum attack to prevent pop
    decay *= zzfxR;
    sustain *= zzfxR;
    release *= zzfxR;
    delay *= zzfxR;
    deltaSlide *= 500 * PI2 / zzfxR ** 3;
    modulation *= PI2 / zzfxR;
    pitchJump *= PI2 / zzfxR;
    pitchJumpTime *= zzfxR;
    repeatTime = repeatTime * zzfxR | 0;

    // generate waveform
    for (length = attack + decay + sustain + release + delay | 0;
         i < length; b[i++] = s) {
        if (!(++c % (bitCrush * 100 | 0)))                      // bit crush
        {
            s = shape ? shape > 1 ? shape > 2 ? shape > 3 ?         // wave shape
                            sin((t % PI2) ** 3) :                    // 4 noise
                            clamp(tan(t), -1, 1) :     // 3 tan
                        1 - (2 * t / PI2 % 2 + 2) % 2 :                        // 2 saw
                    1 - 4 * abs(round(t / PI2) - t / PI2) :    // 1 triangle
                sin(t);                              // 0 sin

            s = (repeatTime ?
                    1 - tremolo + tremolo * sin(PI2 * i / repeatTime) // tremolo
                    : 1) *
                sign(s) * (abs(s) ** shapeCurve) *       // curve 0=square, 2=pointy
                volume * zzfxV * (                        // envelope
                    i < attack ? i / attack :                   // attack
                        i < attack + decay ?                      // decay
                            1 - ((i - attack) / decay) * (1 - sustainVolume) :  // decay falloff
                            i < attack + decay + sustain ?           // sustain
                                sustainVolume :                           // sustain volume
                                i < length - delay ?                      // release
                                    (length - i - delay) / release *            // release falloff
                                    sustainVolume :                           // release volume
                                    0);                                       // post release

            s = delay ? s / 2 + (delay > i ? 0 :            // delay
                (i < length - delay ? 1 : (length - i) / delay) *  // release delay
                b[i - delay | 0] / 2) : s;                      // sample delay
        }

        f = (frequency += slide += deltaSlide) *          // frequency
            cos(modulation * tm++);                    // modulation
        t += f - f * noise * (1 - (sin(i) + 1) * 1e9 % 2);     // noise

        if (j && ++j > pitchJumpTime)       // pitch jump
        {
            frequency += pitchJump;         // apply pitch jump
            startFrequency += pitchJump;    // also apply to start
            j = 0;                          // reset pitch jump time
        }

        if (repeatTime && !(++r % repeatTime)) // repeat
        {
            frequency = startFrequency;     // reset frequency
            slide = startSlide;             // reset slide
            j = j || 1;                     // reset pitch jump time
        }
    }

    const audioBuffer = audioContext.createBuffer(1, b.length, zzfxR);
    audioBuffer.getChannelData(0).set(b);
    return audioBuffer;
}
