export interface Image {
    // first index for sub mesh
    index: number;
    triangles: number;
    tx: number;
    ty: number;
    tw: number;
    th: number;
    x: number;
    y: number;
}

export interface AtlasPage {
    images: Image[];
    vertices: Float32Array;
    indices: Uint16Array;
    atlas: HTMLCanvasElement;
}
