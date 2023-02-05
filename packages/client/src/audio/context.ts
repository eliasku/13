import {hasSettingsFlag, SettingFlag} from "../game/settings.js";

export const audioContext = new AudioContext();

export const audioMaster = audioContext.createGain();
audioMaster.connect(audioContext.destination);

export const play = (
    audioBuffer: AudioBuffer,
    vol: number | StereoPannerNode,
    pan: number | AudioBufferSourceNode,
    gain?: GainNode,
): void => {
    if (!hasSettingsFlag(SettingFlag.Sound)) return;

    const testMasterVol = 0.5;
    gain = audioContext.createGain();
    gain.gain.value = (vol as number) * testMasterVol;
    gain.connect(audioMaster);

    vol = audioContext.createStereoPanner();
    vol.pan.value = pan as number;
    vol.connect(gain);

    pan = audioContext.createBufferSource();
    pan.buffer = audioBuffer;
    pan.connect(vol);
    pan.start();
};

export const speak = (text: string) => {
    if (!hasSettingsFlag(SettingFlag.Speech) || audioMaster.gain.value <= 0) return;
    if (!("SpeechSynthesisUtterance" in window)) return;

    const speech = new SpeechSynthesisUtterance(text);
    speech.volume = 0.5;
    speechSynthesis.speak(speech);
};
