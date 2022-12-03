import {Actor} from "./types";
import {WORLD_SCALE} from "../assets/params";
import {img, Img} from "../assets/gfx";
import {draw, gl, setDrawZ, setMVP} from "../graphics/draw2d";
import {lookAtX, lookAtY, viewX, viewY} from "./controls";
import {clamp, cos, PI, sin} from "../utils/math";
import {mat4_create, mat4_makeXRotation, mat4_makeZRotation, mat4_mul, mat4_orthoProjectionLH} from "../utils/mat4";
import {weapons} from "./data/weapons";


const SHADOW_SCALE = [1, 1, 2, 1, 1];
const SHADOW_ADD = [0, 0, 1, 0, 0];
const SHADOW_COLOR = [0, 0, 0x333333, 0, 0];

export const drawShadows = (drawList: Actor[]) => {
    for (const actor of drawList) {
        const type = actor.type_;
        const shadowScale = (2 - actor.z_ / (WORLD_SCALE * 64)) * SHADOW_SCALE[type];
        const additive = SHADOW_ADD[type];
        const color = SHADOW_COLOR[type];
        draw(img[Img.circle_4], actor.x_ / WORLD_SCALE, actor.y_ / WORLD_SCALE, 0, shadowScale, shadowScale / 4, 0.4, color, additive);
    }
}

export const drawCrosshair = (t: number, player?: Actor) => {
    if (player && ((viewX | 0) || (viewY | 0))) {
        setDrawZ(1000);

        if (player.weapon_) {
            const weapon = weapons[player.weapon_];
            if (weapon.clipSize_) {
                if (player.clipReload_ && player.mags_) {
                    // reloading
                    const t = 1.0 - player.clipReload_ / weapon.clipReload_;
                    const N = 8;
                    for (let i = 0; i < N; ++i) {
                        const sc = clamp(t * N - i, 0, 1);
                        draw(img[Img.box_t1], lookAtX, lookAtY + 1000, (i / N) * PI * 2 - PI, 2 * sc, 5 - 2 * sc, 1, 0xFFFF99);
                    }
                    return;
                }
                if (!player.clipAmmo_) {
                    // blinking
                    if (sin(t * 32) >= 0) {
                        for (let i = 0; i < 4; ++i) {
                            draw(img[Img.box_t1], lookAtX, lookAtY + 1000, t / 10 + i * PI / 2, 2, 4, 1, 0xFF3333);
                        }
                    }
                    return;
                }
            }
        }

        const len = 4 + sin(2 * t) * cos(4 * t) / 4 + (player.detune_ / 8) + player.s_ / 10;
        for (let i = 0; i < 4; ++i) {
            draw(img[Img.box_t1], lookAtX, lookAtY + 1000, t / 10 + i * PI / 2, 2, len);
        }
    }
}

const mvp = mat4_create();
const projection = mat4_create();
const rotX = mat4_create();
const rotZ = mat4_create();
const translateNorm = mat4_create();
const translateScale = mat4_create();

export const setupWorldCameraMatrix = (x: number, y: number, scale: number, rx: number, rz: number) => {
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const angleX = Math.PI / 4 + rx;
    mat4_orthoProjectionLH(projection, 0, w, h, 0, 1e5, -1e5);
    translateNorm[12] = -x;
    translateNorm[13] = -y;
    translateScale[0] = scale;
    translateScale[5] = scale * cos(angleX) * 2;
    translateScale[10] = scale;
    translateScale[12] = w / 2;
    translateScale[13] = h / 2;
    mat4_makeXRotation(rotX, angleX);
    mat4_makeZRotation(rotZ, rz);
    mat4_mul(mvp, rotZ, translateNorm);
    mat4_mul(mvp, rotX, mvp);
    mat4_mul(mvp, translateScale, mvp);
    mat4_mul(mvp, projection, mvp);
    setMVP(mvp);
}
