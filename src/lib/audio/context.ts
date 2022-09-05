export const audioContext = new AudioContext();

export const play = (audioBuffer: AudioBuffer, vol: number, pan: number, loop: boolean): AudioBufferSourceNode => {
    const testMasterVol = 0.8;
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;

    const gainNode = audioContext.createGain();
    gainNode.gain.value = vol * testMasterVol;
    gainNode.connect(audioContext.destination);

    const panNode = audioContext.createStereoPanner();
    panNode.pan.value = pan;
    panNode.connect(gainNode);

    source.connect(panNode);
    source.loop = loop;
    source.start();
    return source;
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
