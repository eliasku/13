import {toRad} from "../../utils/math";
import {Const} from "../config";

export const enum BulletType {
    Melee = 0,
    Shell = 1,
    Plasma = 2,
    Arrow = 3,
    Ray = 4,
}

export interface WeaponConfig {
    rate_: number;
    launchTime_: number;
    relaunchSpeed_: number;
    spawnCount_: number;
    angleVar_: number;
    angleSpread_: number;
    kickBack_: number;
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
    bulletShellColor_?: number;
}

function newWeapon(): WeaponConfig {
    return {
        rate_: 1,
        launchTime_: 0,
        relaunchSpeed_: 2,
        spawnCount_: 1,
        angleVar_: 0,
        angleSpread_: 0,
        kickBack_: 0,
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
        bulletHp_: 1
    };
}

function createArmWeapon(): WeaponConfig {
    const w = newWeapon();
    w.angleSpread_ = 0.5;
    w.launchTime_ = 0.5;
    w.kickBack_ = 40;
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
    w.offset_ = 16;
    w.velocity_ = 600;
    w.detuneSpeed_ = 16;
    w.cameraFeedback_ = 0.02;
    w.cameraLookForward_ = 0.2;
    w.bulletType_ = BulletType.Shell;
    w.bulletShellColor_ = 0xFFDD22;
    return w;
}

export const weapons: WeaponConfig[] = [
    // HANDS FREE
    createArmWeapon(),
    // MELEE
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

    // 10, 11, 12, 13
];

let i = 1;

// 🔪
weapons[i].rate_ = 8;
weapons[i].bulletDamage_ = 4;
weapons[i].gfxRot_ = toRad(-45);

// AXE
++i;
weapons[i].rate_ = 2;
weapons[i].bulletDamage_ = 8;
weapons[i].gfxRot_ = toRad(-45);

// 🔫
++i;
weapons[i].bulletDamage_ = 2;
weapons[i].angleSpread_ = 0.1;
weapons[i].velocity_ /= 2;
weapons[i].relaunchSpeed_ = 16;
weapons[i].detuneSpeed_ = 16;
weapons[i].cameraFeedback_ = 0.1;

// 🖊 light auto gun
++i;
weapons[i].rate_ = 12;
weapons[i].angleSpread_ = 0.25;
weapons[i].kickBack_ = 20;
weapons[i].offset_ = 20;
weapons[i].detuneSpeed_ = 16;
weapons[i].cameraFeedback_ = 0.01;

// ✏️ hard machine-gun?
++i;
weapons[i].rate_ = 8;
weapons[i].angleSpread_ = 0.25;
weapons[i].kickBack_ = 20;
weapons[i].velocity_ /= 2;
weapons[i].detuneSpeed_ = 16;
weapons[i].cameraFeedback_ = 0.05;
weapons[i].cameraLookForward_ = 0.3;
weapons[i].bulletDamage_ = 2;

// 🪥 SHOT GUN
++i;
weapons[i].spawnCount_ = 5;
weapons[i].angleSpread_ = 0.5;
weapons[i].detuneSpeed_ = 32;
weapons[i].cameraFeedback_ = 0.1;
weapons[i].velocity_ = 300;
weapons[i].velocityVar_ = 200;
weapons[i].handsAnim_ = 1;
weapons[i].angleVar_ = 0.5;
weapons[i].bulletHp_ = 2;
weapons[i].bulletDamage_ = 2;
weapons[i].bulletShellColor_ = 0xAA0000;

// CROSS BOW ⛏
++i;
weapons[i].detuneSpeed_ = 4;
weapons[i].cameraFeedback_ = 0.1;
weapons[i].cameraLookForward_ = 0.4;
weapons[i].velocity_ = 960;
weapons[i].handsAnim_ = 1;
weapons[i].bulletDamage_ = 5;
weapons[i].bulletType_ = BulletType.Arrow;
weapons[i].bulletShellColor_ = 0x00FF00;

// 🔌 plasma shock
++i;
weapons[i].angleSpread_ = 0.5;
weapons[i].detuneSpeed_ = 10;
weapons[i].rate_ = 6;
weapons[i].cameraLookForward_ = 0.3;
weapons[i].velocity_ = 420;
weapons[i].bulletDamage_ = 1;
weapons[i].bulletHp_ = 2;
weapons[i].bulletType_ = BulletType.Plasma;
weapons[i].bulletShellColor_ = 0x00FFFF;

// 🧵 RAIL GUN
++i;
weapons[i].rate_ = 0.5;
weapons[i].detuneSpeed_ = 0;
weapons[i].cameraShake_ = 0.5;
weapons[i].velocity_ = 1;
weapons[i].cameraFeedback_ = 0.1;
weapons[i].cameraLookForward_ = 0.4;
weapons[i].bulletDamage_ = 5;
weapons[i].bulletType_ = BulletType.Ray;
weapons[i].bulletLifetime_ = 10 / Const.NetFq;
weapons[i].bulletShellColor_ = 0x990099;
