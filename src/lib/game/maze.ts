export function generateMapBackground(): HTMLCanvasElement {
    const w = 512;
    const h = 512;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", {alpha: true})!;

    ctx.fillStyle = "darkgreen";
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "green";
    ctx.save();
    ctx.scale(1, 0.5);
    for (let i = 0; i < 32; ++i) {
        ctx.beginPath()
        ctx.arc((Math.random() * w) | 0, (Math.random() * h * 2) | 0, 4 + 16 * Math.random(), 0, 2 * Math.PI);
        ctx.closePath();
        ctx.fill();
    }
    ctx.restore();

    ctx.fillStyle = "darkgrey";
    for (let i = 0; i < 32; ++i) {
        ctx.beginPath()
        ctx.arc((Math.random() * w) | 0, (Math.random() * h) | 0, 2, 0, Math.PI, true);
        ctx.closePath();
        ctx.fill();
    }

    ctx.fillStyle = "darkolivegreen";
    for (let i = 0; i < 2048; ++i) {
        ctx.fillRect((Math.random() * w) | 0, (Math.random() * h) | 0, 1, 2 + (4 * Math.random()) | 0);
    }

    return canvas;
}
