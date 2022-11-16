let fpsAcc = 0;
let fpsTime = 0;
export let stats = {
    drawCalls: 0,
    frameDrawCalls: 0,
    fps: 0,
};

export const updateStats = (ts: number) => {
    stats.drawCalls = stats.frameDrawCalls;
    stats.frameDrawCalls = 0;
    ++fpsAcc;
    const div = 1;
    if ((ts - fpsTime) >= div) {
        stats.fps = fpsAcc / div;
        fpsAcc = 0;
        fpsTime += div;
    }
}
