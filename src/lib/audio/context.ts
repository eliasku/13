export const audioContext = new AudioContext();

const channels: AudioBufferSourceNode[] = [];

export function play(audioBuffer: AudioBuffer, loop?: boolean, vol?: number): AudioBufferSourceNode {
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    const gainNode = audioContext.createGain()
    gainNode.gain.value = vol ?? 1.0;
    gainNode.connect(audioContext.destination);
    source.connect(gainNode);
    source.loop = !!loop;
    source.start();
    channels.push(source);
    return source;
}

export function unlockAudio() {
    if (audioContext.state === "suspended") {
        // audioContext.resume().then(() => {
        //     console.info("AudioContext resumed");
        // }).catch((reason) => {
        //     console.error("AudioContext resume failed:", reason);
        // });
        audioContext.resume().catch();
    }
}
