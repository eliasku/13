let fpsAcc = 0;
let fpsTime = 0;
export let stats = {
    drawCalls: 0,
    vertices: 0,
    triangles: 0,

    frameDrawCalls: 0,
    frameVertices: 0,
    frameTriangles: 0,

    fps: 0,
};

export const updateStats = (ts: number) => {
    stats.drawCalls = stats.frameDrawCalls;
    stats.frameDrawCalls = 0;

    stats.vertices = stats.frameVertices;
    stats.frameVertices = 0;

    stats.triangles = stats.frameTriangles;
    stats.frameTriangles = 0;

    ++fpsAcc;
    const div = 1;
    if ((ts - fpsTime) >= div) {
        stats.fps = fpsAcc / div;
        fpsAcc = 0;
        fpsTime += div;
    }
}
