export const createCanvas = (size: number, _canvas?: HTMLCanvasElement | CanvasRenderingContext2D): CanvasRenderingContext2D => {
    _canvas = document.createElement("canvas");
    _canvas.width = _canvas.height = size;
    _canvas = _canvas.getContext("2d");
    _canvas.fillStyle = _canvas.strokeStyle = "#fff";
    _canvas.textAlign = "center";
    _canvas.textBaseline = "alphabetic";
    return _canvas;
}

export const loadArrayBuffer = (url: string): Promise<ArrayBuffer> => fetch(url).then(b => b.arrayBuffer());

export const loadImage = (url: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
    const image = new Image();
    image.onerror = (e) => reject(e);
    image.onload = () => resolve(image);
    image.src = url;
});
