import {Actor, BulletActor, ControlsFlag, ItemActor, ItemType, PlayerActor, unpackAngleByte} from "./types.js";
import {WORLD_SCALE} from "../assets/params.js";
import {EMOJI, img} from "../assets/gfx.js";
import {draw, drawMeshSprite, drawMeshSpriteUp, drawZ, gl, setDrawZ, setMVP} from "../graphics/draw2d.js";
import {lookAtX, lookAtY, viewX, viewY} from "./controls.js";
import {atan2, clamp, cos, hypot, max, min, PI, PI2, sin, TO_RAD} from "../utils/math.js";
import {mat4_create, mat4_makeXRotation, mat4_makeZRotation, mat4_mul, mat4_orthoProjectionLH} from "../utils/mat4.js";
import {weapons} from "./data/weapons.js";
import {getLumaColor32} from "../utils/utils.js";
import {actorsConfig, ANIM_HIT_MAX, BULLET_RADIUS, PLAYER_HANDS_PX_Z} from "./data/world.js";
import {Const, GAME_CFG} from "./config.js";
import {bullets, BulletType} from "./data/bullets.js";
import {fxRandElement} from "../utils/rnd.js";
import {getNameByClientId, lastFrameTs} from "./gameState.js";
import {drawTextAligned, fnt} from "../graphics/font.js";
import {Img} from "../assets/img.js";
import {clientId} from "../net/messaging.js";
import {drawParticleShadows} from "./particles.js";
import {gameCamera} from "@iioi/client/game/camera.js";

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
            prop._shadowAdd,
        );
    }
};

export const drawCrosshair = (player: PlayerActor | undefined, screenScale: number) => {
    if (player && (viewX | 0 || viewY | 0)) {
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
                        draw(img, x, y, (i / N) * PI * 2 - PI, 2 * sc, 5 - 2 * sc, 1, 0xffff99);
                    }
                    return;
                }
                if (!player._clipAmmo) {
                    // blinking
                    if (sin(t * 32) >= 0) {
                        for (let i = 0; i < 4; ++i) {
                            draw(img, x, y, t / 10 + (i * PI) / 2, 2, 4, 1, 0xff3333);
                        }
                    }
                    return;
                }
            }
        }

        const len = 4 + (sin(2 * t) * cos(4 * t)) / 4 + player._detune / 8 + player._lifetime / 10;
        for (let i = 0; i < 4; ++i) {
            draw(img, x, y, t / 10 + (i * PI) / 2, 2, len);
        }
    }
};

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
};

export const getHitColorOffset = (anim: number) => getLumaColor32(0xff * min(1, (2 * anim) / ANIM_HIT_MAX));

export const drawObjectMesh2D = (p: Actor, id: number | Img, z = 0, scale = 1, oy = 0.0) =>
    drawMeshSpriteUp(
        img[id],
        p._x / WORLD_SCALE,
        p._y / WORLD_SCALE + oy,
        p._z / WORLD_SCALE + z,
        0,
        scale,
        scale,
        1,
        0xffffff,
        0,
        getHitColorOffset(p._animHit),
    );

const drawBarrelOpaque = (p: Actor): void => drawObjectMesh2D(p, p._subtype + Img.barrel0);
const drawTreeOpaque = (p: Actor): void => drawObjectMesh2D(p, p._subtype + Img.tree0);

const drawItemOpaque = (item: ItemActor) => {
    if (item._lifetime) {
        const limit = GAME_CFG._items._lifetime >>> 1;
        if (item._lifetime < limit) {
            const f = 1 - item._lifetime / limit;
            const fr = 8 + 16 * f;
            if (sin((fr * (limit - item._lifetime)) / (Const.NetFq / 3)) >= 0.5) {
                return;
            }
        }
    }
    if (item._subtype & ItemType.Weapon) {
        drawObjectMesh2D(item, Img.weapon0 + item._itemWeapon, 4, 0.8);
        if (item._subtype & ItemType.Ammo) {
            drawObjectMesh2D(item, Img.item0 + ItemType.Ammo, 8, 0.8, -0.1);
        }
    } /*if (cat == ItemCategory.Effect)*/ else {
        const t = lastFrameTs * 4 + item._anim0 / 25;
        drawObjectMesh2D(item, Img.item0 + item._subtype, BULLET_RADIUS / WORLD_SCALE + cos(t), 0.9 + 0.1 * sin(4 * t));
    }
};

const drawBullet = (bullet: BulletActor) => {
    const x = bullet._x / WORLD_SCALE;
    const y = bullet._y / WORLD_SCALE;
    const z = bullet._z / WORLD_SCALE;
    const a = atan2(bullet._v, bullet._u);
    const type = bullet._subtype as BulletType;
    const bulletData = bullets[type];
    const color = fxRandElement(bulletData._color);
    const longing = bulletData._length;
    const longing2 = bulletData._lightLength;
    const sz = bulletData._size + (bulletData._pulse * sin(32 * lastFrameTs + bullet._anim0)) / 2;
    setDrawZ(z - 0.1);
    drawMeshSprite(img[bulletData._images[0]], x, y, a, sz * longing, sz, 0.1, 0xffffff, 1);
    setDrawZ(z);
    drawMeshSprite(img[bulletData._images[1]], x, y, a, (sz * longing) / 2, sz / 2, 1, color);
    setDrawZ(z + 0.1);
    drawMeshSprite(img[bulletData._images[2]], x, y, a, 2 * longing2, 2);
};

export const drawHotUsableHint = (hotUsable?: ItemActor) => {
    if (hotUsable) {
        if (hotUsable._subtype & ItemType.Weapon) {
            const weapon = weapons[hotUsable._itemWeapon];
            let text = weapon._name + " " + EMOJI[Img.weapon0 + hotUsable._itemWeapon];
            if (weapon._clipSize) {
                text += hotUsable._itemWeaponAmmo;
            }
            const x = hotUsable._x / WORLD_SCALE;
            const y = hotUsable._y / WORLD_SCALE + drawZ;
            drawTextAligned(fnt[0], text, 7, x, y - 28);
            drawTextAligned(fnt[0], "Pick [E]", 7, x, y - 20);
        }
    }
};

const drawPlayerOpaque = (p: PlayerActor): void => {
    const co = getHitColorOffset(p._animHit);
    const basePhase = p._anim0 + lastFrameTs;
    const colorC = GAME_CFG._bodyColor[p._anim0 % GAME_CFG._bodyColor.length];
    const colorArm = colorC;
    const colorBody = colorC;
    const x = p._x / WORLD_SCALE;
    const y = p._y / WORLD_SCALE;
    const z = p._z / WORLD_SCALE;
    const speed = hypot(p._u, p._v, p._w);
    const runK = p._input & ControlsFlag.Run ? 1 : 0.8;
    const walk = min(1, speed / 100);
    let base = -0.5 * walk * 0.5 * (1.0 + sin(40 * runK * basePhase));
    const idle_base = (1 - walk) * ((1 + sin(10 * basePhase) ** 2) / 4);
    base = base + idle_base;
    const leg1 = 5 - 4 * walk * 0.5 * (1.0 + sin(40 * runK * basePhase));
    const leg2 = 5 - 4 * walk * 0.5 * (1.0 + sin(40 * runK * basePhase + PI));

    /////

    const wpn = weapons[p._weapon];
    const viewAngle = unpackAngleByte(p._input >> ControlsFlag.LookAngleBit, ControlsFlag.LookAngleMax);
    const weaponBaseAngle = wpn._gfxRot * TO_RAD;
    const weaponBaseScaleX = wpn._gfxSx;
    const weaponBaseScaleY = 1;
    let weaponX = x;
    let weaponY = y;
    const weaponZ = z + PLAYER_HANDS_PX_Z;
    let weaponAngle = atan2(y + 1000 * sin(viewAngle) - weaponY + weaponZ, x + 1000 * cos(viewAngle) - weaponX);
    let weaponSX = weaponBaseScaleX;
    const weaponSY = weaponBaseScaleY;
    let weaponBack = 0;
    if (weaponAngle < -0.2 && weaponAngle > -PI + 0.2) {
        weaponBack = 1;
        //weaponY -= 16 * 4;
    }
    const A = sin(weaponAngle - PI);
    let wd = 6 + 12 * (weaponBack ? A * A : 0);
    let wx = 1;
    if (weaponAngle < -PI * 0.5 || weaponAngle > PI * 0.5) {
        wx = -1;
    }
    if (wpn._handsAnim) {
        // const t = max(0, (p.s - 0.8) * 5);
        // anim := 1 -> 0
        const t = min(
            1,
            wpn._launchTime > 0 ? p._lifetime / wpn._launchTime : max(0, (p._lifetime / wpn._reloadTime - 0.5) * 2),
        );
        wd += sin(t * PI) * wpn._handsAnim;
        weaponAngle -= -wx * PI * 0.25 * sin((1 - (1 - t) ** 2) * PI2);
    }
    weaponX += wd * cos(weaponAngle);
    weaponY += wd * sin(weaponAngle);

    if (wx < 0) {
        weaponSX *= wx;
        weaponAngle -= PI + 2 * weaponBaseAngle;
    }

    weaponAngle += weaponBaseAngle;

    if (p._weapon) {
        drawMeshSpriteUp(
            img[Img.weapon0 + p._weapon],
            weaponX,
            weaponY /* + (weaponBack ? -1 : 1)*/,
            weaponZ,
            weaponAngle,
            weaponSX,
            weaponSY,
        );
    }

    drawMeshSpriteUp(img[Img.box_t], x - 3, y, z + 5, 0, 2, leg1, 1, colorArm, 0, co);
    drawMeshSpriteUp(img[Img.box_t], x + 3, y, z + 5, 0, 2, leg2, 1, colorArm, 0, co);
    drawMeshSpriteUp(img[Img.box], x, y, z + 7 - base, 0, 8, 6, 1, colorBody, 0, co);

    // DRAW HANDS
    const rArmX = x + 4;
    const lArmX = x - 4;
    const armAY = y - z - PLAYER_HANDS_PX_Z + base * 2;
    const weaponAY = weaponY - weaponZ;
    const rArmRot = atan2(-armAY + weaponAY, weaponX - rArmX);
    const lArmRot = atan2(-armAY + weaponAY, weaponX - lArmX);
    const lArmLen = hypot(weaponX - lArmX, weaponAY - armAY) - 1;
    const rArmLen = hypot(weaponX - rArmX, weaponAY - armAY) - 1;

    if (p._weapon) {
        drawMeshSpriteUp(img[Img.box_l], x + 4, y + 0.2, z + 10 - base, rArmRot, rArmLen, 2, 1, colorArm, 0, co);
        drawMeshSpriteUp(img[Img.box_l], x - 4, y + 0.2, z + 10 - base, lArmRot, lArmLen, 2, 1, colorArm, 0, co);
    } else {
        let sw1 = walk * sin(20 * runK * basePhase);
        let sw2 = walk * cos(20 * runK * basePhase);
        let armLen = 5;
        if (!p._client && p._hp < 10 && !p._sp) {
            sw1 -= PI / 2;
            sw2 += PI / 2;
            armLen += 4;
        }
        drawMeshSpriteUp(img[Img.box_l], x + 4, y + 0.2, z + 10 - base, sw1 + PI / 4, armLen, 2, 1, colorArm, 0, co);
        drawMeshSpriteUp(
            img[Img.box_l],
            x - 4,
            y + 0.2,
            z + 10 - base,
            sw2 + PI - PI / 4,
            armLen,
            2,
            1,
            colorArm,
            0,
            co,
        );
    }

    {
        const imgHead = p._client ? Img.avatar0 + (p._anim0 % Img.num_avatars) : Img.npc0 + (p._anim0 % Img.num_npc);
        const s = p._w / 500;
        const a = p._u / 500;
        drawMeshSpriteUp(img[imgHead], x, y + 0.1, z + 16 - base * 2, a, 1 - s, 1 + s, 1, 0xffffff, 0, co);
    }
};

const drawPlayer = (p: PlayerActor): void => {
    const x = p._x / WORLD_SCALE;
    const y = p._y / WORLD_SCALE;

    if (p._client > 0 && p._client !== clientId) {
        let name = getNameByClientId(p._client);
        if (process.env.NODE_ENV === "development") {
            name = (name ?? "") + " #" + p._client;
        }
        if (name) {
            setDrawZ(32 + p._z / WORLD_SCALE);
            drawTextAligned(fnt[0], name, 6, x, y + 2);
        }
    }
};

type ActorDrawFunction = (p: Actor) => void;
const DRAW_BY_TYPE: ActorDrawFunction[] = [drawPlayer, undefined, drawBullet, undefined, undefined];

const DRAW_OPAQUE_BY_TYPE: (ActorDrawFunction | undefined)[] = [
    drawPlayerOpaque,
    drawBarrelOpaque,
    undefined,
    drawItemOpaque,
    drawTreeOpaque,
];

export const drawOpaqueObjects = (drawList: Actor[]) => {
    for (let i = drawList.length - 1; i >= 0; --i) {
        const actor = drawList[i];
        DRAW_OPAQUE_BY_TYPE[actor._type]?.(actor);
    }
};

export const drawObjects = (drawList: Actor[]) => {
    setDrawZ(0.15);
    drawShadows(drawList);
    drawParticleShadows();
    for (const actor of drawList) {
        DRAW_BY_TYPE[actor._type]?.(actor);
    }
};
