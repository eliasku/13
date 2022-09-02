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

import {zzfxG, zzfxR} from "./zzfx";
import {audioContext} from "./context";

/**
 * Generate a song
 *
 * @param {Array.<Instrument>} instruments - Array of ZzFX sound paramaters.
 * @param {Array.<Pattern>} patterns - Array of pattern data.
 * @param {Array.<Number>} sequence - Array of pattern indexes.
 * @param {Number} [speed=125] - Playback speed of the song (in BPM).
 * @returns {Array.<Array.<Number>>} Left and right channel sample data.
 */

export const zzfxM = (instruments:number[][], patterns:[number, number, number][][], sequence:number[], BPM = 125):AudioBuffer => {
    let instrumentParameters;
    let i;
    let j;
    let k;
    let note:number;
    let sample;
    let patternChannel;
    let notFirstBeat:any;
    let stop;
    let instrument:any;
    let pitch;
    let attenuation:number;
    let outSampleOffset:number;
    let isSequenceEnd;
    let sampleOffset = 0;
    let nextSampleOffset;
    let sampleBuffer:number[] = [];
    let leftChannelBuffer:number[] = [];
    let rightChannelBuffer:number[] = [];
    let channelIndex = 0;
    let panning = 0;
    let hasMore = 1;
    let sampleCache:Record<any, any> = {};
    let beatLength = zzfxR / BPM * 60 >> 2;

    // for each channel in order until there are no more
    for(; hasMore; channelIndex++) {

        // reset current values
        sampleBuffer = [hasMore = notFirstBeat = pitch = outSampleOffset = 0];

        // for each pattern in sequence
        sequence.map((patternIndex, sequenceIndex) => {
            // get pattern for current channel, use empty 1 note pattern if none found
            patternChannel = patterns[patternIndex][channelIndex] || [0, 0, 0];

            // check if there are more channels
            hasMore |= !!patterns[patternIndex][channelIndex]  as any as number;

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
                     j++ > beatLength - 99 && stop ? attenuation += (attenuation < 1)as any as number / 99 : 0
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
                            ]as any as number
                            ] = sampleCache[[instrument, note]as any as number] || (
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

    const audioBuffer = audioContext.createBuffer(2, leftChannelBuffer.length, zzfxR);
    audioBuffer.getChannelData(0).set(leftChannelBuffer);
    audioBuffer.getChannelData(1).set(rightChannelBuffer);
    return audioBuffer;
}
