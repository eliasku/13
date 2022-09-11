import {rehash} from "../utils/hasher";
import {Snd, snd} from "../assets/sfx";
import describe from "node:test";

export const audioContext = rehash(new AudioContext());

export type AudioBufferWithState = AudioBuffer & {
    currentSource_?: AudioBufferSourceNode
};

export const play = (audioBuffer: AudioBufferWithState,
                     vol: number | StereoPannerNode,
                     pan: number | AudioBufferSourceNode,
                     loop: boolean,
                     gain?: GainNode): void => {
    const testMasterVol = 0.5;
    gain = audioContext.createGain();
    gain.gain.value = vol as number * testMasterVol;
    gain.connect(audioContext.destination);

    vol = audioContext.createStereoPanner();
    vol.pan.value = pan as number;
    vol.connect(gain);

    pan = audioBuffer.currentSource_ = audioContext.createBufferSource();
    pan.buffer = audioBuffer;
    pan.loop = loop;
    pan.connect(vol);
    pan.start();
}
//
// function shootRound(audioBuffer: AudioBufferWithState, numberOfRounds: number, timeBetweenRounds:number) {
//     var time = audioContext.currentTime;
//     // Make multiple sources using the same buffer and play in quick succession.
//     for (var i = 0; i < numberOfRounds; i++) {
//         var source = this.makeSource(bulletBuffer);
//         source.playbackRate.value = 1 + Math.random() * RANDOM_PLAYBACK;
//         source.start(time + i * timeBetweenRounds + Math.random() * RANDOM_VOLUME);
//     }
// }

export const speak = (text: string) => {
    const speech = new SpeechSynthesisUtterance(text);
    speech.volume = 0.5;
    speechSynthesis.speak(speech);
}