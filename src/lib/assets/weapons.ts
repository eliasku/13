import {toRad} from "../utils/math";
import {Const} from "../game/config";

export const enum BulletType {
    Melee = 0,
    Shell = 1,
    Arrow = 2,
    Plasma = 3,
    Ray = 4,
}

export interface WeaponConfig {
    rate_: number;
    spawnCount_: number;
    angleVar_: number;
    angleSpread_: number;
    kickBack_: number;
    jumpBack_: number;
    offset_: number;
    offsetZ_: number;
    velocity_: number;
    velocityVar_: number;
    cameraShake_: number;
    detuneSpeed_: number;
    cameraFeedback_: number;
    cameraLookForward_: number;
    gfxRot_: number;
    gfxSx_: number;
    handsAnim_: number;
    bulletType_: BulletType;
    bulletDamage_: number;
    bulletLifetime_: number;
    bulletHp_: number;
}

function newWeapon(): WeaponConfig {
    return {
        rate_: 1,
        spawnCount_: 1,
        angleVar_: 0,
        angleSpread_: 0,
        kickBack_: 0,
        jumpBack_: 0,
        offset_: 0,
        offsetZ_: 0,
        velocity_: 0,
        velocityVar_: 0,
        cameraShake_: 0,
        detuneSpeed_: 0,
        cameraFeedback_: 0,
        cameraLookForward_: 0,
        gfxRot_: 0,
        gfxSx_: 1,
        handsAnim_: 0,
        bulletType_: BulletType.Melee,
        bulletDamage_: 1,
        bulletLifetime_: 0,
        bulletHp_: 1,
    };
}

function createArmWeapon(): WeaponConfig {
    const w = newWeapon();
    w.angleSpread_ = 0.5;
    w.kickBack_ = 40;
    w.jumpBack_ = 8;
    w.offset_ = 0;
    w.offsetZ_ = 0;
    w.velocity_ = 120;
    w.detuneSpeed_ = 16;
    w.cameraFeedback_ = 0.02;
    w.cameraLookForward_ = 0.1;
    w.handsAnim_ = 12;
    w.bulletDamage_ = 2;
    w.bulletLifetime_ = 10 / Const.NetFq;
    return w;
}

function createGunWeapon(): WeaponConfig {
    const w = newWeapon();
    w.kickBack_ = 32;
    w.jumpBack_ = 8;
    w.offset_ = 16;
    w.velocity_ = 600;
    w.detuneSpeed_ = 16;
    w.cameraFeedback_ = 0.02;
    w.cameraLookForward_ = 0.2;
    w.bulletType_ = BulletType.Shell;
    return w;
}

export const weapons: WeaponConfig[] = [
    // HANDS FREE
    createArmWeapon(),
    // MELEE
    createArmWeapon(),
    createArmWeapon(),
    createArmWeapon(),
    // PISTOL
    createGunWeapon(),
    createGunWeapon(),
    createGunWeapon(),
    createGunWeapon(),
    createGunWeapon(),
    createGunWeapon(),
    createGunWeapon(),
];

weapons[0].rate_ = 2;

// 🔪
weapons[1].gfxRot_ = toRad(-45);
weapons[1].rate_ = 4;
// 🔨
//weapons[2].gfxRot_ = toRad(-45);

// AXE
weapons[2].gfxRot_ = toRad(-45);
// 🗡
weapons[3].gfxRot_ = toRad(-45);

// 🔫
weapons[4].angleSpread_ = 0.1;
weapons[4].velocity_ /= 2;
weapons[4].detuneSpeed_ = 16;
weapons[4].cameraFeedback_ = 0.1;

// 🖊 light auto gun
weapons[5].rate_ = 12;
weapons[5].angleSpread_ = 0.25;
weapons[5].kickBack_ = 20;
weapons[5].jumpBack_ = 4;
weapons[5].offset_ = 20;
weapons[5].detuneSpeed_ = 16;
weapons[5].cameraFeedback_ = 0.01;

// ✏️ hard machine-gun?
weapons[6].rate_ = 8;
weapons[6].angleSpread_ = 0.25;
weapons[6].kickBack_ = 20;
weapons[6].jumpBack_ = 4;
weapons[6].velocity_ /= 2;
weapons[6].detuneSpeed_ = 16;
weapons[6].cameraFeedback_ = 0.05;
weapons[6].cameraLookForward_ = 0.3;
weapons[6].bulletDamage_ = 2;

// 🪥 SHOT GUN
weapons[7].spawnCount_ = 5;
weapons[7].angleSpread_ = 0.5;
weapons[7].detuneSpeed_ = 32;
weapons[7].cameraFeedback_ = 0.1;
weapons[7].velocity_ = 300;
weapons[7].velocityVar_ = 200;
weapons[7].handsAnim_ = 1;
weapons[7].angleVar_ = 0.5;
weapons[7].bulletHp_ = 2;

// CROSS BOW ⛏
weapons[8].detuneSpeed_ = 32;
weapons[8].cameraFeedback_ = 0.1;
weapons[8].cameraLookForward_ = 0.3;
weapons[8].velocity_ = 600 + 180;
weapons[8].handsAnim_ = 1;
weapons[8].bulletDamage_ = 3;
weapons[8].bulletType_ = BulletType.Arrow;

// 🔌 plasma shock
weapons[9].angleSpread_ = 0.5;
weapons[9].detuneSpeed_ = 10;
weapons[9].rate_ = 8;
//weapons[9].cameraFeedback_ = 0.02;
weapons[9].cameraLookForward_ = 0.3;
weapons[9].velocity_ = 300;
weapons[9].bulletDamage_ = 1;
weapons[9].bulletHp_ = 2;
weapons[9].bulletType_ = BulletType.Plasma;

// 🧵 RAIL GUN
weapons[10].rate_ = 0.5;
weapons[10].detuneSpeed_ = 0;
weapons[10].cameraShake_ = 0.5;
weapons[10].velocity_ = 1;
weapons[10].cameraFeedback_ = 0.1;
weapons[10].cameraLookForward_ = 0.1;
weapons[10].bulletType_ = BulletType.Ray;
weapons[10].bulletLifetime_ = 10 / Const.NetFq;
