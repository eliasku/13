import {Img} from "../../assets/img";

export const enum BulletType {
    Melee = 0,
    Shell = 1,
    Plasma = 2,
    Arrow = 3,
    Ray = 4,
}

export interface BulletData {
    readonly _length: number;
    readonly _lightLength: number;
    readonly _size: number;
    readonly _pulse: number;
    readonly _color: number[];
    readonly _images: [Img, Img, Img];
}

export const bullets: Record<BulletType, BulletData> = [
    {
        _length: 0.2,
        _lightLength: 0.1,
        _size: 6,
        _pulse: 0,
        _color: [0xFFFFFF],
        _images: [Img.circle_4_60p, Img.circle_4_70p, Img.box]
    },
    {
        _length: 2,
        _lightLength: 2,
        _size: 3 / 2,
        _pulse: 0,
        _color: [0xFFFF44],
        _images: [Img.circle_4_60p, Img.circle_4_70p, Img.box]
    },
    {
        _length: 1,
        _lightLength: 2,
        _size: 2,
        _pulse: 1,
        _color: [0x44FFFF],
        _images: [Img.circle_4_60p, Img.circle_4_70p, Img.box]
    },
    {
        _length: 8,
        _lightLength: 2,
        _size: 4,
        _pulse: 0,
        _color: [0x333333],
        _images: [Img.box_r, Img.box_r, Img.box_r]
    },
    {
        _length: 512,
        _lightLength: 512,
        _size: 12,
        _pulse: 0,
        _color: [0xFF0000, 0x00FF00, 0x00FFFF, 0xFFFF00, 0xFF00FF],
        _images: [Img.box_l, Img.box_l, Img.box_l]
    },
];
