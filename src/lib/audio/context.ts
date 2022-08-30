export const audioContext = new AudioContext();

//const channels: AudioBufferSourceNode[] = [];

export function play(audioBuffer: AudioBuffer, vol?: number, pan?: number, loop?: boolean): AudioBufferSourceNode {
    const testMasterVol = 0.05;
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;

    const gainNode = audioContext.createGain();
    gainNode.gain.value = (vol ?? 1) * testMasterVol;
    gainNode.connect(audioContext.destination);

    const panNode = audioContext.createStereoPanner();
    panNode.pan.value = pan ?? 0;
    panNode.connect(gainNode);

    source.connect(panNode);
    source.loop = !!loop;
    source.start();
    //channels.push(source);
    return source;
}

export function unlockAudio() {
    if (audioContext.state[0] == "s") {
        // audioContext.resume().then(() => {
        //     console.info("AudioContext resumed");
        // }).catch((reason) => {
        //     console.error("AudioContext resume failed:", reason);
        // });
        audioContext.resume().catch();
    }
}
