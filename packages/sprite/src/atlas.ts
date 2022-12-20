export interface Image {
    tx: number;
    ty: number;
    tw: number;
    th: number;
    x: number;
    y: number;
    // first index for sub mesh
    index0: number;
    triangles: number;
    vertex0: number;
    vertexCount: number;
}

export interface AtlasPage {
    images: Image[];
    vertices: Float32Array;
    indices: Uint16Array;
    image: HTMLCanvasElement;
    data: ArrayBuffer;
}
