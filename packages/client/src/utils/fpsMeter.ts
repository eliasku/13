let fpsAcc = 0;
let fpsTime = 0;
export const stats = {
    _drawCalls: 0,
    _vertices: 0,
    _triangles: 0,

    _frameDrawCalls: 0,
    _frameVertices: 0,
    _frameTriangles: 0,

    _fps: 0,
};

export const updateStats = (ts: number) => {
    stats._drawCalls = stats._frameDrawCalls;
    stats._frameDrawCalls = 0;

    stats._vertices = stats._frameVertices;
    stats._frameVertices = 0;

    stats._triangles = stats._frameTriangles;
    stats._frameTriangles = 0;

    ++fpsAcc;
    const div = 1;
    if (ts - fpsTime >= div) {
        stats._fps = fpsAcc / div;
        fpsAcc = 0;
        fpsTime += div;
    }
};
