export const loadJSON = <T extends object>(url: string): Promise<T> => fetch(url).then(r => r.json() as T);

export const loadArrayBuffer = (url: string): Promise<ArrayBuffer> => fetch(url).then(r => r.arrayBuffer());

export const loadImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const image = new Image();
        image.onerror = e => reject(e);
        image.onload = () => resolve(image);
        image.src = url;
    });
