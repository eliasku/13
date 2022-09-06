let fpsAcc = 0;
let fpsTime = 0;
let fps = 0;

export const updateFpsMeter = (ts: number) => {
    ++fpsAcc;
    const div = .5;
    if ((ts - fpsTime) >= div) {
        fps = fpsAcc / div;
        fpsAcc = 0;
        fpsTime += div;
    }
    return fps;
}
