import {rand} from "../utils/rnd";
import {createCanvas} from "./gfx";
import {createTexture, initFramebuffer, uploadTexture} from "../graphics/draw2d";
import {BOUNDS_SIZE} from "./params";
import {PI2} from "../utils/math";

export const mapTexture = createTexture(BOUNDS_SIZE);
initFramebuffer(mapTexture);

export const generateMapBackground = (_i: number = 0, _size: number = BOUNDS_SIZE, _map = createCanvas(_size)): void => {
    _map.fillStyle = "#060";
    _map.fillRect(0, 0, _size, _size);
    const sc = 4;
    _map.scale(1, 1 / sc);
    for(; _i++ < _size;) {
        _map.fillStyle = ["#080", "#572"][rand(2)];
        _map.beginPath()
        _map.arc(rand(_size), rand(_size) * sc, 1 + rand(16), 0, PI2);
        _map.fill();
        _map.fillRect(rand(_size), rand(_size) * sc, 1, 4 + rand(8));
    }
    uploadTexture(mapTexture, _map.canvas);
}
