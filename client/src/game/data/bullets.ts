import {Img} from "../../assets/gfx";

export const enum BulletType {
    Melee = 0,
    Shell = 1,
    Plasma = 2,
    Arrow = 3,
    Ray = 4,
}

export interface BulletData {
    readonly length: number;
    readonly lightLength: number;
    readonly size: number;
    readonly pulse: number;
    readonly color: number[];
    readonly images: [Img, Img, Img];
}

export const bullets: Record<BulletType, BulletData> = [
    {
        length: 0.2,
        lightLength: 0.1,
        size: 6,
        pulse: 0,
        color: [0xFFFFFF],
        images: [Img.circle_4_60p, Img.circle_4_70p, Img.box]
    },
    {
        length: 2,
        lightLength: 2,
        size: 3 / 2,
        pulse: 0,
        color: [0xFFFF44],
        images: [Img.circle_4_60p, Img.circle_4_70p, Img.box]
    },
    {
        length: 1,
        lightLength: 2,
        size: 2,
        pulse: 1,
        color: [0x44FFFF],
        images: [Img.circle_4_60p, Img.circle_4_70p, Img.box]
    },
    {
        length: 8,
        lightLength: 2,
        size: 4,
        pulse: 0,
        color: [0x333333],
        images: [Img.box_r, Img.box_r, Img.box_r]
    },
    {
        length: 512,
        lightLength: 512,
        size: 12,
        pulse: 0,
        color: [0xFF0000, 0x00FF00, 0x00FFFF, 0xFFFF00, 0xFF00FF],
        images: [Img.box_l, Img.box_l, Img.box_l]
    },
];
