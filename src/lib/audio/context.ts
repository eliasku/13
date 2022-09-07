export const audioContext = new AudioContext();

export type AudioBufferWithState = AudioBuffer & {
    currentSource_?: AudioBufferSourceNode
};

export const play = (audioBuffer: AudioBufferWithState,
                     vol: number | StereoPannerNode,
                     pan: number | AudioBufferSourceNode,
                     loop: boolean,
                     gain?: GainNode): void => {
    const testMasterVol = 0.8;
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
