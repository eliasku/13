import {Actor, BulletActor, ItemType, PlayerActor} from "./types";
import {WORLD_SCALE} from "../assets/params";
import {EMOJI, img, Img} from "../assets/gfx";
import {draw, drawMeshSprite, drawMeshSpriteUp, drawZ, gl, setDrawZ, setMVP} from "../graphics/draw2d";
import {lookAtX, lookAtY, viewX, viewY} from "./controls";
import {atan2, clamp, cos, min, PI, sin} from "../utils/math";
import {mat4_create, mat4_makeXRotation, mat4_makeZRotation, mat4_mul, mat4_orthoProjectionLH} from "../utils/mat4";
import {weapons} from "./data/weapons";
import {getLumaColor32} from "../utils/utils";
import {actorsConfig, ANIM_HIT_MAX, BULLET_RADIUS} from "./data/world";
import {Const, GAME_CFG} from "./config";
import {bullets, BulletType} from "./data/bullets";
import {fxRandElement} from "../utils/rnd";
import {lastFrameTs} from "./gameState";
import {drawTextShadowCenter, fnt} from "../graphics/font";

export const drawShadows = (drawList: Actor[]) => {
    for (const actor of drawList) {
        const prop = actorsConfig[actor._type];
        const shadowScale = (2 - actor._z / (WORLD_SCALE * 64)) * prop._shadowScale;
        drawMeshSprite(
            img[Img.circle_4],
            actor._x / WORLD_SCALE,
            actor._y / WORLD_SCALE,
            0,
            shadowScale,
            shadowScale / 4,
            0.4,
            prop._shadowColor,
            prop._shadowAdd
        );
    }
}

export const drawCrosshair = (player: PlayerActor | undefined, gameCamera: number[], screenScale: number) => {
    if (player && ((viewX | 0) || (viewY | 0))) {
        const img = fnt[0]._textureBoxT1;
        const W = gl.drawingBufferWidth;
        const H = gl.drawingBufferHeight;
        const x = ((lookAtX - gameCamera[0]) / gameCamera[2] + W / 2) / screenScale;
        const y = ((lookAtY - gameCamera[1]) / gameCamera[2] + H / 2) / screenScale;
        const t = lastFrameTs;
        // const x = lookAtX;
        // const y = lookAtY;
        if (player._weapon) {
            const weapon = weapons[player._weapon];
            if (weapon._clipSize) {
                if (player._clipReload && player._mags) {
                    // reloading
                    const t = 1.0 - player._clipReload / weapon._clipReload;
                    const N = 8;
                    for (let i = 0; i < N; ++i) {
                        const sc = clamp(t * N - i, 0, 1);
                        draw(img, x, y, (i / N) * PI * 2 - PI, 2 * sc, 5 - 2 * sc, 1, 0xFFFF99);
                    }
                    return;
                }
                if (!player._clipAmmo) {
                    // blinking
                    if (sin(t * 32) >= 0) {
                        for (let i = 0; i < 4; ++i) {
                            draw(img, x, y, t / 10 + i * PI / 2, 2, 4, 1, 0xFF3333);
                        }
                    }
                    return;
                }
            }
        }

        const len = 4 + sin(2 * t) * cos(4 * t) / 4 + (player._detune / 8) + player._s / 10;
        for (let i = 0; i < 4; ++i) {
            draw(img, x, y, t / 10 + i * PI / 2, 2, len);
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

export const getHitColorOffset = (anim: number) =>
    getLumaColor32(0xFF * min(1, 2 * anim / ANIM_HIT_MAX));

export const drawObjectMesh2D = (p: Actor, id: Img, z: number = 0, scale: number = 1, oy: number = 0.0) =>
    drawMeshSpriteUp(img[id], p._x / WORLD_SCALE, p._y / WORLD_SCALE + oy, p._z / WORLD_SCALE + z, 0, scale, scale, 1, 0xFFFFFF, 0, getHitColorOffset(p._animHit));

export const drawBarrelOpaque = (p: Actor): void => drawObjectMesh2D(p, p._subtype + Img.barrel0);
export const drawTreeOpaque = (p: Actor): void => drawObjectMesh2D(p, p._subtype + Img.tree0);

export const drawItemOpaque = (item: Actor) => {
    if (item._s) {
        const limit = GAME_CFG._items._lifetime >>> 1;
        if (item._s < limit) {
            const f = 1 - item._s / limit;
            const fr = 8 + 16 * f;
            if (sin(fr * (limit - item._s) / (Const.NetFq / 3)) >= 0.5) {
                return;
            }
        }
    }
    if (item._subtype & ItemType.Weapon) {
        drawObjectMesh2D(item, Img.weapon0 + item._weapon, 4, 0.8);
        if (item._mags) {
            drawObjectMesh2D(item, Img.item0 + ItemType.Ammo, 8, 0.8, -0.1);
        }
    } else /*if (cat == ItemCategory.Effect)*/ {
        const t = lastFrameTs * 4 + item._anim0 / 25;
        drawObjectMesh2D(item, Img.item0 + item._subtype, BULLET_RADIUS / WORLD_SCALE + cos(t), 0.9 + 0.1 * sin(4 * t));
    }
}

export const drawBullet = (bullet: BulletActor) => {
    const x = bullet._x / WORLD_SCALE;
    const y = bullet._y / WORLD_SCALE;
    const z = bullet._z / WORLD_SCALE;
    const a = atan2(bullet._v, bullet._u);
    const type = bullet._subtype as BulletType;
    const bulletData = bullets[type];
    const color = fxRandElement(bulletData._color);
    const longing = bulletData._length;
    const longing2 = bulletData._lightLength;
    const sz = bulletData._size + bulletData._pulse * sin(32 * lastFrameTs + bullet._anim0) / 2;
    setDrawZ(z - 0.1);
    drawMeshSprite(img[bulletData._images[0]], x, y, a, sz * longing, sz, 0.1, 0xFFFFFF, 1);
    setDrawZ(z);
    drawMeshSprite(img[bulletData._images[1]], x, y, a, sz * longing / 2, sz / 2, 1, color);
    setDrawZ(z + 0.1);
    drawMeshSprite(img[bulletData._images[2]], x, y, a, 2 * longing2, 2);
}

export const drawHotUsableHint = (hotUsable?: Actor) => {
    if (hotUsable) {
        if (hotUsable._subtype & ItemType.Weapon) {
            const weapon = weapons[hotUsable._weapon];
            let text = weapon._name + " " + EMOJI[Img.weapon0 + hotUsable._weapon];
            if (weapon._clipSize) {
                text += hotUsable._clipAmmo;
            }
            const x = hotUsable._x / WORLD_SCALE;
            const y = hotUsable._y / WORLD_SCALE + drawZ;
            drawTextShadowCenter(fnt[0], text, 7, x, y - 28);
            drawTextShadowCenter(fnt[0], "Pick [E]", 7, x, y - 20);
        }
    }
};
