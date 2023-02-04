
// SCAN BOUNDS

// finds the first y coord in imgData that is not white
function scanY(fromTop:boolean, imgWidth:number, imgHeight:number, imgData:ImageData) {
    const offset = fromTop ? 1 : -1
    const firstCol = fromTop ? 0 : imgHeight - 1

    // loop through each row
    for (let y = firstCol; fromTop ? (y < imgHeight) : (y > -1); y += offset) {
        // loop through each column
        for (let x = 0; x < imgWidth; x++) {
            // if not white, return col
            if (getAlpha(x, y, imgWidth, imgData)) {
                return y;
            }
        }
    }

    // the whole image is white already
    return 0;
}

// finds the first x coord in imgData that is not white
function scanX(fromLeft:boolean, imgWidth:number, imgHeight:number, imgData:ImageData) {
    const offset = fromLeft ? 1 : -1
    const firstRow = fromLeft ? 0 : imgWidth - 1

    // loop through each column
    for (let x = firstRow; fromLeft ? (x < imgWidth) : (x > -1); x += offset) {
        // loop through each row
        for (let y = 0; y < imgHeight; y++) {
            // if not white, return row
            if (getAlpha(x, y, imgWidth, imgData)) {
                return x;
            }
        }
    }

    // the whole image is white already
    return 0;
}

function getAlpha(x:number, y:number, imgWidth:number, imgData:ImageData) {
    return imgData.data[(y * imgWidth + x) * 4 + 3];
}

// https://github.com/agilgur5/trim-canvas
function scanBounds(bmp:ImageData) {
    // get the corners of the relevant content (everything that's not white)
    const cropTop = scanY(true, bmp.width, bmp.height, bmp);
    const cropBottom = scanY(false, bmp.width, bmp.height, bmp);
    const cropLeft = scanX(true, bmp.width, bmp.height, bmp);
    const cropRight = scanX(false, bmp.width, bmp.height, bmp);
    return {
        x: cropLeft,
        y: cropTop,
        w: cropRight - cropLeft + 1,
        h: cropBottom - cropTop + 1
    };
}

export function preview2(emoji:string, opts:{size?:number, sx?:number, sy? : number, a?: number, cut?: number, x?: number, y?: number} = {}) {
    let x = 0;
    let y = 0;
    const scaleUp = 8;
    const emojiSize = ((opts.size ?? 16) * scaleUp) | 0;
    const maxSize = 512;
    const w_ = maxSize; // 14->16
    const h_ = maxSize; // 14 -> 20
    const canvas = document.createElement("canvas");
    canvas.width = w_;
    canvas.height = h_;
    const ctx = canvas.getContext("2d", {alpha: true}) as CanvasRenderingContext2D;
    // ctx.imageSmoothingEnabled = false;
    ctx.font = emojiSize + "px e";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.translate(w_ / 2, h_ / 2);
    ctx.rotate(Math.PI * (opts.a ?? 0) / 180);
    ctx.scale(opts.sx ?? 1, opts.sy ?? 1);
    ctx.fillText(emoji, 0, 0);

    const bmp = ctx.getImageData(x, y, w_, h_);
    const bounds = scanBounds(bmp);
    ctx.putImageData(bmp, x, y);
    // document.body.appendChild(canvas);
    {
        const lc = document.createElement("canvas");
        const scale = 1 / scaleUp;
        // const scale = 1;
        const cut2 = opts.cut ?? 0x80;
        lc.width = 1 + (bounds.w * scale + 2) | 0;
        lc.height = 1 + (bounds.h * scale + 2) | 0;
        const ctx2 = lc.getContext("2d") as CanvasRenderingContext2D;
        ctx2.imageSmoothingEnabled = false;
        ctx2.scale(scale, scale);
        ctx2.translate(-bounds.x, -bounds.y);
        ctx2.drawImage(canvas, 1 / scale, 1 / scale);
        ctx2.resetTransform();
        const bmp = ctx2.getImageData(x, y, w_, h_);
        for (let i = 0; i < bmp.data.length; i += 4) {
            let a = bmp.data[i + 3];
            if (a >= cut2) {
                bmp.data[i + 3] = 0xFF;
            } else {
                bmp.data[i + 3] = 0;
            }
        }
        ctx2.putImageData(bmp, x, y);
        ctx2.fillStyle = "rgba(255,0,0,0.5)";
        ctx2.fillRect((lc.width * (opts.x ?? 0.5)) | 0, (lc.height * (opts.y ?? 0.5)) | 0, 1, 1);
        // document.body.appendChild(lc);
        // {
        //     const previewCanvas = document.createElement("canvas");
        //     previewCanvas.style.border = "solid 1px blue";
        //     previewCanvas.width = lc.width * 4;
        //     previewCanvas.height = lc.height * 4;
        //     const previewCtx = previewCanvas.getContext("2d");
        //     previewCtx.imageSmoothingEnabled = false;
        //     previewCtx.scale(4, 4);
        //     previewCtx.drawImage(lc, 0, 0);
        //     document.body.appendChild(previewCanvas);
        // }

        const rsize = (opts.size ?? 16) - 16;
        return `/* ${emoji} */ ["${emoji}", ${bounds.x}, ${bounds.y}, ${lc.width}, ${lc.height}, ${rsize || ""}, ${opts.a ?? ""}, ${opts.sx ?? ""}, ${opts.sy ?? ""}, ${opts.cut ?? ""}, ${opts.x ?? ""}, ${opts.y ?? ""}],\n`;
        //return [emoji, bounds.x, bounds.y, lc.width, lc.height, opts.size, opts.a, opts.sx, opts.sy, opts.cut, opts.x ?? 0.5, opts.y ?? 0.5];
        // return lc;
    }
}