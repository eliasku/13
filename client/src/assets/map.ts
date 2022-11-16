import {rand} from "../utils/rnd";
import {createCanvas} from "./gfx";
import {createTexture, initFramebuffer, uploadTexture} from "../graphics/draw2d";
import {BOUNDS_SIZE} from "./params";
import {PI2} from "../utils/math";

interface MapTheme {
    primaryColor: string;
    splatColors: string[];
    splatR: [number, number];
    rectW: [number, number];
    rectH: [number, number];
    treeGfx: number[];
}

const themes:MapTheme[] = [
    {
        primaryColor: "#060",
        splatColors: ["#080", "#572"],
        splatR: [1, 16],
        rectW: [1, 1],
        rectH: [4, 12],
        treeGfx: [0, 1],
    },
    {
        primaryColor: "#753",
        splatColors: ["#876", "#863"],
        splatR: [1, 16],
        rectW: [1, 4],
        rectH: [1, 4],
        treeGfx: [2, 3],
    },
    {
        primaryColor: "#acd",
        splatColors: ["#ade", "#aef"],
        splatR: [1, 16],
        rectW: [1, 12],
        rectH: [1, 2],
        treeGfx: [4, 5],
    }
];

export const mapTexture = createTexture(BOUNDS_SIZE);
initFramebuffer(mapTexture);

export const generateMapBackground = (_i: number = 0, _size: number = BOUNDS_SIZE, _map = createCanvas(_size)): MapTheme => {
    const themeId = rand(themes.length);
    const theme = themes[themeId];
    _map.fillStyle = theme.primaryColor;
    _map.fillRect(0, 0, _size, _size);
    const sc = 4;
    _map.scale(1, 1 / sc);
    for(; _i++ < _size;) {
        _map.fillStyle = theme.splatColors[rand(theme.splatColors.length)];
        _map.beginPath()
        const splatR = theme.splatR[0] + rand(theme.splatR[1] - theme.splatR[0]);
        _map.arc(rand(_size), rand(_size) * sc, splatR, 0, PI2);
        _map.fill();
        const splatW = theme.rectW[0] + rand(theme.rectW[1] - theme.rectW[0]);
        const splatH = theme.rectH[0] + rand(theme.rectH[1] - theme.rectH[0]);
        _map.fillRect(rand(_size), rand(_size) * sc, splatW, splatH);
    }
    uploadTexture(mapTexture, _map.canvas);
    return theme;
}
