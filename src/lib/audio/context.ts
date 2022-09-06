export const audioContext = new AudioContext();

export type AudioBufferWithState = AudioBuffer & {
    $?: AudioBufferSourceNode
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

    pan = audioBuffer.$ = audioContext.createBufferSource();
    pan.buffer = audioBuffer;
    pan.loop = loop;
    pan.connect(vol);
    pan.start();
}

export const unlockAudio = () => {
    if (audioContext.state[0] == "s") {
        // audioContext.resume().then(() => {
        //     console.info("AudioContext resumed");
        // }).catch((reason) => {
        //     console.error("AudioContext resume failed:", reason);
        // });
        audioContext.resume().catch();
    }
}
