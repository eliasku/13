export function saturatef(x: number) {
    return x >= 0.0 ? (x <= 1.0 ? x : 1.0) : 0.0;
}

export function hue(vec: Vec4, h: number) {
    vec.x = saturatef(Math.abs(h * 6.0 - 3.0) - 1.0);
    vec.y = saturatef(2.0 - Math.abs(h * 6.0 - 2.0));
    vec.z = saturatef(2.0 - Math.abs(h * 6.0 - 4.0));
}

export class Vec4 {
    constructor(public x: number,
                public y: number,
                public z: number,
                public w: number) {
    }
}