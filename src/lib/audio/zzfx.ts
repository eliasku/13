import {audioContext} from "./context";
import {M, PI2, sign} from "../utils/math";

const zzfxV = .3;    // volume
const zzfxR = 44100; // sample rate

const createAudioBuffer = (...channels: number[][]): AudioBuffer => {
    const audioBuffer = audioContext.createBuffer(channels.length, channels[0].length, zzfxR);
    channels.map((x, i) => audioBuffer.getChannelData(i).set(x));
    return audioBuffer;
}

export const zzfx = (code: number[]): AudioBuffer => createAudioBuffer(zzfxG(...code));

const zzfxG = // generate samples
    (
        // parameters
        volume = 1, randomness = .05, frequency = 220, attack = 0, sustain = 0,
        release = .1, shape = 0, shapeCurve = 1, slide = 0, deltaSlide = 0,
        pitchJump = 0, pitchJumpTime = 0, repeatTime = 0, noise = 0, modulation = 0,
        bitCrush = 0, delay = 0, sustainVolume = 1, decay = 0, tremolo = 0
    ) => {
        // init parameters
        let startSlide = slide *= 500 * PI2 / zzfxR / zzfxR,
            startFrequency = frequency *= (1 + randomness * 2 * M.random() - randomness)
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
                                M.sin((t % PI2) ** 3) :                    // 4 noise
                                M.max(M.min(M.tan(t), 1), -1) :     // 3 tan
                            1 - (2 * t / PI2 % 2 + 2) % 2 :                        // 2 saw
                        1 - 4 * M.abs(M.round(t / PI2) - t / PI2) :    // 1 triangle
                    M.sin(t);                              // 0 sin

                s = (repeatTime ?
                        1 - tremolo + tremolo * M.sin(PI2 * i / repeatTime) // tremolo
                        : 1) *
                    sign(s) * (M.abs(s) ** shapeCurve) *       // curve 0=square, 2=pointy
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
                M.cos(modulation * tm++);                    // modulation
            t += f - f * noise * (1 - (M.sin(i) + 1) * 1e9 % 2);     // noise

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

        return b;
    }

/**
 * ZzFX Music Renderer v2.0.3 by Keith Clark and Frank Force
 */

/**
 * @typedef Channel
 * @type {Array.<Number>}
 * @property {Number} 0 - Channel instrument
 * @property {Number} 1 - Channel panning (-1 to +1)
 * @property {Number} 2 - Note
 */

/**
 * @typedef Pattern
 * @type {Array.<Channel>}
 */

/**
 * @typedef Instrument
 * @type {Array.<Number>} ZzFX sound parameters
 */

/**
 * Generate a song
 *
 * @param {Array.<Instrument>} instruments - Array of ZzFX sound paramaters.
 * @param {Array.<Pattern>} patterns - Array of pattern data.
 * @param {Array.<Number>} sequence - Array of pattern indexes.
 * @param {Number} [speed=125] - Playback speed of the song (in BPM).
 * @returns {Array.<Array.<Number>>} Left and right channel sample data.
 */

export const zzfxM = (instruments: number[][], patterns: (number|undefined)[][][], sequence: number[], BPM = 125): AudioBuffer => {
    let instrumentParameters;
    let i;
    let j;
    let k;
    let note: number;
    let sample;
    let patternChannel;
    let notFirstBeat: any;
    let stop;
    let instrument: any;
    let pitch;
    let attenuation: number;
    let outSampleOffset: number;
    let isSequenceEnd;
    let sampleOffset = 0;
    let nextSampleOffset;
    let sampleBuffer: number[] = [];
    let leftChannelBuffer: number[] = [];
    let rightChannelBuffer: number[] = [];
    let channelIndex = 0;
    let panning = 0;
    let hasMore = 1;
    let sampleCache: Record<any, any> = {};
    let beatLength = zzfxR / BPM * 60 >> 2;

    // for each channel in order until there are no more
    for (; hasMore; channelIndex++) {

        // reset current values
        sampleBuffer = [hasMore = notFirstBeat = pitch = outSampleOffset = 0];

        // for each pattern in sequence
        sequence.map((patternIndex, sequenceIndex) => {
            // get pattern for current channel, use empty 1 note pattern if none found
            patternChannel = patterns[patternIndex][channelIndex] || [0, 0, 0];

            // check if there are more channels
            hasMore |= !!patterns[patternIndex][channelIndex] as any as number;

            // get next offset, use the length of first channel
            nextSampleOffset = outSampleOffset + (patterns[patternIndex][0].length - 2 - (!notFirstBeat as any as number)) * beatLength;
            // for each beat in pattern, plus one extra if end of sequence
            isSequenceEnd = sequenceIndex == sequence.length - 1;
            for (i = 2, k = outSampleOffset; i < patternChannel.length + (isSequenceEnd as any as number); notFirstBeat = ++i) {

                // <channel-note>
                note = patternChannel[i];

                // stop if end, different instrument or new note
                stop = i == patternChannel.length + (isSequenceEnd as any as number) - 1 && isSequenceEnd ||
                    instrument != ((patternChannel[0] || 0) | note | 0) as any as number;

                // fill buffer with samples for previous beat, most cpu intensive part
                for (j = 0; j < beatLength && notFirstBeat;

                    // fade off attenuation at end of beat if stopping note, prevents clicking
                     j++ > beatLength - 99 && stop ? attenuation += (attenuation < 1) as any as number / 99 : 0
                ) {
                    // copy sample to stereo buffers with panning
                    sample = (1 - attenuation) * sampleBuffer[sampleOffset++] / 2 || 0;
                    leftChannelBuffer[k] = (leftChannelBuffer[k] || 0) - sample * panning + sample;
                    rightChannelBuffer[k] = (rightChannelBuffer[k++] || 0) + sample * panning + sample;
                }

                // set up for next note
                if (note) {
                    // set attenuation
                    attenuation = note % 1;
                    panning = patternChannel[1] || 0;
                    if (note |= 0) {
                        // get cached sample
                        sampleBuffer = sampleCache[
                            [
                                instrument = patternChannel[sampleOffset = 0] || 0,
                                note
                            ] as any as number
                            ] = sampleCache[[instrument, note] as any as number] || (
                            // add sample to cache
                            instrumentParameters = [...instruments[instrument]],
                                instrumentParameters[2] *= 2 ** ((note - 12) / 12),

                                // allow negative values to stop notes
                                note > 0 ? zzfxG(...instrumentParameters) : []
                        );
                    }
                }
            }

            // update the sample offset
            outSampleOffset = nextSampleOffset;
        });
    }

    return createAudioBuffer(leftChannelBuffer, rightChannelBuffer);
}
