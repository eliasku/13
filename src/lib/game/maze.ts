import {rand, random} from "./rnd";

const colors = ["gray",  "orange",  "blue", "green",];

export function generateMap(): HTMLCanvasElement {
    const w = 128;
    const h = 128;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", {alpha: true})!;
    ctx.clearRect(0, 0, 1024, 1024);

    for (let j = 0; j < 4; ++j) {
        ctx.fillStyle = colors[j];
        ctx.strokeStyle = colors[j];
        const rMin = 4;
        const rVar = 8;
        const wMin = 2;
        const wVar = 4;
        let a = random() * Math.PI * 2;
        let d = 64 - j * 8 + rand() % 8;
        let x = w / 2 + (d * Math.cos(a)) | 0;
        let y = h / 2 + (d * Math.sin(a)) | 0;
        for (let i = 0; i < 20; ++i) {
            if (rand() & 1) {
                const sx = rMin + rand() % rVar;
                const sy = rMin + rand() % rVar;
                ctx.fillRect(x - sx, y - sy, sx * 2, sy * 2);
            } else {
                ctx.beginPath();
                ctx.arc(x, y, rMin + rand() % rVar, 0, Math.PI * 2);
                ctx.closePath();
                ctx.fill();
            }

            if (i === 9) {
                continue;
            }
            ctx.beginPath();
            ctx.moveTo(x, y);
            a += 0.2 + 0.3 * random();
            d = 64 - j * 8 + rand() % 8;
            x = w / 2 + (d * Math.cos(a)) | 0;
            y = h / 2 + (d * Math.sin(a)) | 0;
            ctx.lineWidth = wMin + rand() % wVar;
            ctx.lineTo(x, y);
            ctx.closePath();
            ctx.stroke();
        }
    }

    return canvas;
}
