import {rehash} from "../utils/hasher";

export const audioContext = rehash(new AudioContext());

export const play = (audioBuffer: AudioBuffer,
                     vol: number | StereoPannerNode,
                     pan: number | AudioBufferSourceNode,
                     gain?: GainNode): void => {
    const testMasterVol = 0.5;
    gain = audioContext.createGain();
    gain.gain.value = vol as number * testMasterVol;
    gain.connect(audioContext.destination);

    vol = audioContext.createStereoPanner();
    vol.pan.value = pan as number;
    vol.connect(gain);

    pan = audioContext.createBufferSource();
    pan.buffer = audioBuffer;
    pan.connect(vol);
    pan.start();
}

export const speak = (text: string) => {
    const speech = new SpeechSynthesisUtterance(text);
    speech.volume = 0.5;
    speechSynthesis.speak(speech);
}