let fpsAcc = 0;
let fpsTime = 0;
export let fps = 0;

export function updateFpsMeter(ts: number) {
    ++fpsAcc;
    const div = 0.25;
    if ((ts - fpsTime) >= div) {
        fps = fpsAcc / div;
        fpsAcc = 0;
        fpsTime += div;
    }
}
