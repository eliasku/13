import {rand} from "../utils/rnd.js";
import {createTexture, initFramebuffer, uploadTexture} from "../graphics/draw2d.js";
import {BOUNDS_SIZE} from "./params.js";
import {PI2} from "../utils/math.js";
import {createCanvas} from "../graphics/utils.js";
import {TILE_MAP_STRIDE, TILE_SIZE} from "../game/tilemap.js";

interface MapTheme {
    primaryColor: string;
    splatColors: string[];
    splatR: [number, number];
    rectW: [number, number];
    rectH: [number, number];
    treeGfx: number[];
}

const themes: MapTheme[] = [
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
    },
];

export const mapTexture0 = createTexture(BOUNDS_SIZE);
export const mapTexture = createTexture(BOUNDS_SIZE);
initFramebuffer(mapTexture);

export const generateMapBackground = (themeId: number, blocks: number[]): MapTheme => {
    const theme = themes[themeId];
    const size = BOUNDS_SIZE;
    const map = createCanvas(size);
    map.fillStyle = theme.primaryColor;
    map.fillRect(0, 0, size, size);

    const sc = 4;
    map.scale(1, 1 / sc);

    for (let i = 0; i++ < size; ) {
        map.fillStyle = theme.splatColors[rand(theme.splatColors.length)];
        map.beginPath();
        const splatR = theme.splatR[0] + rand(theme.splatR[1] - theme.splatR[0]);
        map.arc(rand(size), rand(size) * sc, splatR, 0, PI2);
        map.fill();
        const splatW = theme.rectW[0] + rand(theme.rectW[1] - theme.rectW[0]);
        const splatH = theme.rectH[0] + rand(theme.rectH[1] - theme.rectH[0]);
        map.fillRect(rand(size), rand(size) * sc, splatW, splatH);
    }
    {
        map.resetTransform();
        map.fillStyle = theme.splatColors[0];
        const pad = 4;
        for (let cy = 0; cy < TILE_MAP_STRIDE; ++cy) {
            for (let cx = 0; cx < TILE_MAP_STRIDE; ++cx) {
                const t = blocks[cx + cy * TILE_MAP_STRIDE];
                if (t) {
                    map.fillRect(cx * TILE_SIZE - pad, cy * TILE_SIZE - pad, TILE_SIZE + 2 * pad, TILE_SIZE + 2 * pad);
                }
            }
        }
    }

    uploadTexture(mapTexture0, map.canvas);
    uploadTexture(mapTexture, map.canvas);
    return theme;
};
