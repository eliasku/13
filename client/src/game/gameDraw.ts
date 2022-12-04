import {Actor, ItemType} from "./types";
import {WORLD_SCALE} from "../assets/params";
import {EMOJI, img, Img} from "../assets/gfx";
import {draw, drawBillboard, gl, setDrawZ, setMVP} from "../graphics/draw2d";
import {lookAtX, lookAtY, viewX, viewY} from "./controls";
import {atan2, clamp, cos, min, PI, sin} from "../utils/math";
import {mat4_create, mat4_makeXRotation, mat4_makeZRotation, mat4_mul, mat4_orthoProjectionLH} from "../utils/mat4";
import {weapons} from "./data/weapons";
import {getLumaColor32} from "../utils/utils";
import {actorsConfig, ANIM_HIT_MAX, BULLET_RADIUS} from "./data/world";
import {Const} from "./config";
import {bullets, BulletType} from "./data/bullets";
import {fxRandElement} from "../utils/rnd";
import {lastFrameTs} from "./gameState";
import {drawTextShadowCenter, fnt} from "../graphics/font";

export const drawShadows = (drawList: Actor[]) => {
    for (const actor of drawList) {
        const prop = actorsConfig[actor.type_];
        const shadowScale = (2 - actor.z_ / (WORLD_SCALE * 64)) * prop.shadowScale;
        draw(
            img[Img.circle_4],
            actor.x_ / WORLD_SCALE,
            actor.y_ / WORLD_SCALE,
            0,
            shadowScale,
            shadowScale / 4,
            0.4,
            prop.shadowColor,
            prop.shadowAdd
        );
    }
}

export const drawCrosshair = (player?: Actor) => {
    if (player && ((viewX | 0) || (viewY | 0))) {
        setDrawZ(1000);
        const t = lastFrameTs;

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

export const getHitColorOffset = (anim: number) =>
    getLumaColor32(0xFF * min(1, 2 * anim / ANIM_HIT_MAX));

export const drawObject = (p: Actor, id: Img, z: number = 0, scale: number = 1) =>
    drawBillboard(img[id], p.x_ / WORLD_SCALE, p.y_ / WORLD_SCALE, p.z_ / WORLD_SCALE + z, 0, scale, scale, 1, 0xFFFFFF, 0, getHitColorOffset(p.animHit_));

export const drawBarrel = (p: Actor): void => drawObject(p, p.btn_ + Img.barrel0);
export const drawTree = (p: Actor): void => drawObject(p, p.btn_ + Img.tree0);

export const drawItem = (item: Actor) => {
    if (item.clipReload_) {
        const limit = 5 * Const.NetFq;
        if (item.clipReload_ < limit) {
            const f = 1 - item.clipReload_ / limit;
            const fr = 8 + 16 * f;
            if (sin(fr * (limit - item.clipReload_) / Const.NetFq) >= 0.5) {
                return;
            }
        }
    }
    if (item.btn_ & ItemType.Weapon) {
        if (item.mags_) {
            drawObject(item, Img.item0 + ItemType.Ammo, 8, 0.8);
        }
        drawObject(item, Img.weapon0 + item.weapon_, 4, 0.8);
    } else /*if (cat == ItemCategory.Effect)*/ {
        const t = lastFrameTs * 4 + item.anim0_ / 25;
        drawObject(item, Img.item0 + item.btn_, BULLET_RADIUS / WORLD_SCALE + cos(t), 0.9 + 0.1 * sin(4 * t));
    }
}

export const drawBullet = (actor: Actor) => {
    const x = actor.x_ / WORLD_SCALE;
    const y = actor.y_ / WORLD_SCALE;
    const z = actor.z_ / WORLD_SCALE;
    const a = atan2(actor.v_, actor.u_);
    const type = actor.btn_ as BulletType;
    const bulletData = bullets[type];
    const color = fxRandElement(bulletData.color);
    const longing = bulletData.length;
    const longing2 = bulletData.lightLength;
    const sz = bulletData.size + bulletData.pulse * sin(32 * lastFrameTs + actor.anim0_) / 2;
    setDrawZ(z);
    draw(img[bulletData.images[0]], x, y, a, sz * longing, sz, 0.1, 0xFFFFFF, 1);
    draw(img[bulletData.images[1]], x, y, a, sz * longing / 2, sz / 2, 1, color);
    draw(img[bulletData.images[2]], x, y, a, 2 * longing2, 2);
}

export const drawHotUsableHint = (hotUsable?: Actor) => {
    if (hotUsable) {
        if (hotUsable.btn_ & ItemType.Weapon) {
            const weapon = weapons[hotUsable.weapon_];
            let text = weapon.name_ + " " + EMOJI[Img.weapon0 + hotUsable.weapon_];
            if (weapon.clipSize_) {
                text += hotUsable.clipAmmo_;
            }
            const x = hotUsable.x_ / WORLD_SCALE;
            const y = hotUsable.y_ / WORLD_SCALE;
            drawTextShadowCenter(fnt[0], text, 7, x, y - 28);
            drawTextShadowCenter(fnt[0], "Pick [E]", 7, x, y - 20);
        }
    }
};
