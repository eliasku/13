let ctx_: AudioContext | null = null;

export function getAudioContext(): AudioContext {
    if (!ctx_) {
        const ctr = (window as any)['AudioContext'] ?? (window as any)['webkitAudioContext'];
        if (ctr) {
            ctx_ = new AudioContext();
        }
        setupUnlock();
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

export function setupUnlock() {
    // "touchstart", "touchend", "mousedown", "pointerdown"
    const events = ["touchstart", "touchend", "mousedown", "click", "keydown"];
    const num = events.length;
    const doc = document;
    const handle = () => {
        if (ctx_.state === "suspended") {
            ctx_.resume().then(() => {
                //log(Message.DeviceResumed);
            }).catch((reason) => {
                //error(Message.DeviceResumeError, reason);
            });
            return;
        }
        for (let i = 0; i < num; ++i) {
            doc.removeEventListener(events[i], handle, true);
        }
    };
    for (let i = 0; i < num; ++i) {
        doc.addEventListener(events[i], handle, true);
    }
}