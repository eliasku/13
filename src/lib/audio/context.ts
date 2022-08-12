let ctx_: AudioContext | null = null;

export function getAudioContext(): AudioContext {
    if (!ctx_) {
        const ctr = (window as any)['AudioContext'] ?? (window as any)['webkitAudioContext'];
        if (ctr) {
            ctx_ = new AudioContext();
        }
    }
    return ctx_;
}

const channels: AudioBufferSourceNode[] = [];

export function play(audioBuffer: AudioBuffer, loop?: boolean, vol?: number): AudioBufferSourceNode {
    const ctx = getAudioContext();
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    const gainNode = ctx.createGain()
    gainNode.gain.value = vol ?? 1.0;
    gainNode.connect(ctx.destination);
    source.connect(gainNode);
    source.loop = !!loop;
    source.start();
    channels.push(source);
    return source;
}
