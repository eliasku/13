import {rand} from "./rnd";

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
        ctx.arc(rand() % w, rand() % (h * 2), 4 + rand() % 16, 0, 2 * Math.PI);
        ctx.closePath();
        ctx.fill();
    }
    ctx.restore();

    ctx.fillStyle = "darkgrey";
    for (let i = 0; i < 32; ++i) {
        ctx.beginPath()
        ctx.arc(rand() %  w, rand() % h, 2, 0, Math.PI, true);
        ctx.closePath();
        ctx.fill();
    }

    ctx.fillStyle = "darkolivegreen";
    for (let i = 0; i < 2048; ++i) {
        ctx.fillRect(rand() % w, rand() %  h, 1, 2 + rand() % 4);
    }

    return canvas;
}
