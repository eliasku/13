import {WORLD_SCALE} from "../../assets/params.js";
import {BulletType} from "./bullets.js";

export interface WeaponConfig {
    _name: string;
    // TODO: rename to reload-tics
    _reloadTime: number;
    _launchTime: number;
    // relaunch speed is steps to advance to launchTime
    _relaunchSpeed: number;

    _spawnCount: number;
    _angleVar: number;
    _angleSpread: number;
    _kickBack: number;
    _offset: number;
    _velocity: number;
    _velocityVar: number;
    _cameraShake: number;
    _detuneSpeed: number;
    _cameraFeedback: number;
    _cameraLookForward: number;
    _cameraScale: number;
    _gfxRot: number;
    _gfxSx: number;
    _handsAnim: number;
    _bulletType: BulletType;
    _bulletDamage: number;
    _bulletLifetime: number;
    _bulletHp: number;
    _bulletShellColor?: number;

    _clipSize: number;
    _clipReload: number;

    _ai_shootDistanceMin: number;
    _ai_shootDistanceMax: number;

    // value affects movement speed, jump velocity
    _moveWeightK: number;
}

const newWeapon = (): WeaponConfig => ({
    _name: "",
    _reloadTime: 60,
    _launchTime: 0,
    _relaunchSpeed: 2,
    _spawnCount: 1,
    _angleVar: 0,
    _angleSpread: 0,
    _kickBack: 0,
    _offset: 0,
    _velocity: 0,
    _velocityVar: 0,
    _cameraShake: 0,
    _detuneSpeed: 1,
    _cameraFeedback: 0,
    _cameraLookForward: 0,
    _cameraScale: 1,
    _gfxRot: 0,
    _gfxSx: 1,
    _handsAnim: 0,
    _bulletType: BulletType.Melee,
    _bulletDamage: 1,
    _bulletLifetime: 0,
    _bulletHp: 1,
    _clipSize: 0,
    _clipReload: 0,
    _ai_shootDistanceMin: 0,
    _ai_shootDistanceMax: 0xFFFFFFFF,
    _moveWeightK: 1.0,
});

const createArmWeapon = (): WeaponConfig => {
    const w = newWeapon();
    w._angleSpread = 0.5;
    w._launchTime = 30;
    w._kickBack = 10;
    w._offset = 6;
    w._velocity = 300;
    w._detuneSpeed = 16;
    w._cameraFeedback = 0.02 / 5;
    w._cameraLookForward = 0.1;
    w._handsAnim = 12;
    w._bulletDamage = 2;
    // w.bulletLifetime_ = 2;
    w._bulletLifetime = 3;
    w._ai_shootDistanceMax = 32 * WORLD_SCALE;
    return w;
};

const createGunWeapon = (): WeaponConfig => {
    const w = newWeapon();
    w._kickBack = 32;
    w._offset = 16;
    w._velocity = 600;
    w._detuneSpeed = 16;
    w._cameraFeedback = 0.02 / 5;
    w._cameraLookForward = 0.2;
    w._bulletType = BulletType.Shell;
    w._bulletShellColor = 0xFFDD22;
    w._clipSize = 30;
    w._clipReload = 60;
    // w.ai_shootDistanceMin_ = 128 * WORLD_SCALE;
    w._ai_shootDistanceMin = 24 * WORLD_SCALE;
    w._ai_shootDistanceMax = 256 * WORLD_SCALE;
    w._moveWeightK = 0.8;
    return w;
};

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
weapons[i]._name = "Knife";
weapons[i]._reloadTime = 10;
weapons[i]._launchTime = 5;
weapons[i]._bulletDamage = 2;
weapons[i]._gfxRot = -45;

// AXE
++i;
weapons[i]._name = "Axe";
weapons[i]._reloadTime = 30;
weapons[i]._launchTime = 15;
weapons[i]._bulletDamage = 8;
weapons[i]._gfxRot = -45;
weapons[i]._moveWeightK = 0.9;

// 🔫
++i;
weapons[i]._name = "Pistol";
weapons[i]._bulletDamage = 3;
weapons[i]._angleSpread = 0.1;
weapons[i]._velocity /= 2;
weapons[i]._relaunchSpeed = 16;
weapons[i]._detuneSpeed = 16;
weapons[i]._cameraFeedback = 0.02;
weapons[i]._clipSize = 9 * 3;
weapons[i]._moveWeightK = 1.0;

// 🖊 light auto gun
++i;
weapons[i]._name = "Automatic Gun";
weapons[i]._reloadTime = 5;
weapons[i]._angleSpread = 0.25;
weapons[i]._kickBack = 20;
weapons[i]._offset = 20;
weapons[i]._detuneSpeed = 16;
weapons[i]._cameraFeedback = 0.02;

// ✏️ hard machine-gun?
++i;
weapons[i]._name = "Machine Gun";
weapons[i]._reloadTime = 8;
weapons[i]._angleSpread = 0.25;
weapons[i]._kickBack = 20;
weapons[i]._velocity /= 2;
weapons[i]._detuneSpeed = 16;
weapons[i]._cameraFeedback = 0.05;
weapons[i]._cameraLookForward = 0.3;
weapons[i]._bulletDamage = 2;

// 🪥 SHOT GUN
++i;
weapons[i]._name = "Shotgun";
weapons[i]._spawnCount = 5;
weapons[i]._angleSpread = 0.5;
weapons[i]._detuneSpeed = 32;
weapons[i]._cameraFeedback = 0.1;
weapons[i]._velocity = 300;
weapons[i]._velocityVar = 200;
weapons[i]._handsAnim = 1;
weapons[i]._angleVar = 0.5;
weapons[i]._bulletHp = 2;
weapons[i]._bulletDamage = 2;
weapons[i]._bulletShellColor = 0xAA0000;
weapons[i]._clipSize = 7;
weapons[i]._moveWeightK = 0.9;

// CROSS BOW ⛏
++i;
weapons[i]._name = "Crossbow";
weapons[i]._detuneSpeed = 1;
weapons[i]._cameraFeedback = 0.2;
weapons[i]._cameraLookForward = 0.4;
weapons[i]._cameraScale = 1.5;
weapons[i]._velocity = 960;
weapons[i]._handsAnim = 1;
weapons[i]._bulletDamage = 5;
weapons[i]._bulletType = BulletType.Arrow;
weapons[i]._bulletShellColor = 0x00FF00;
weapons[i]._clipSize = 7;
weapons[i]._moveWeightK = 0.9;

// 🔌 plasma shock
++i;
weapons[i]._name = "Plasma Gun";
weapons[i]._angleSpread = 0.5;
weapons[i]._detuneSpeed = 10;
weapons[i]._reloadTime = 10;
weapons[i]._cameraLookForward = 0.3;
weapons[i]._cameraFeedback = 0.05;
weapons[i]._velocity = 420;
weapons[i]._bulletDamage = 1;
weapons[i]._bulletHp = 2;
weapons[i]._bulletType = BulletType.Plasma;
weapons[i]._bulletShellColor = 0x00FFFF;
weapons[i]._clipSize = 35;

// 🧵 RAIL GUN
++i;
weapons[i]._name = "Railgun";
weapons[i]._reloadTime = 120;
weapons[i]._cameraShake = 25;
weapons[i]._velocity = 1000;
weapons[i]._cameraFeedback = 0.1;
weapons[i]._cameraLookForward = 0.4;
weapons[i]._cameraScale = 1.4;
weapons[i]._bulletDamage = 5;
weapons[i]._bulletHp = 15;
weapons[i]._bulletType = BulletType.Ray;
weapons[i]._bulletLifetime = 10;
weapons[i]._bulletShellColor = 0x990099;
weapons[i]._clipSize = 5;
