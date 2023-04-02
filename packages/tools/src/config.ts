import {parseRGB} from "@iioi/client/utils/utils.js";
import {BulletType, GameConfig, WeaponConfig} from "@iioi/client/data/config.js";
import {WORLD_SCALE, BULLET_RADIUS, OBJECT_RADIUS} from "@iioi/client/assets/params.js";
import {Img} from "@iioi/client/assets/img.js";
import {writeFileSync} from "fs";
import {prepareFolders} from "./common.js";

const gameConfig: GameConfig = {
    npc: [
        {
            initWeaponLen: 1,
            period: 12,
            max: 0,
        },
        {
            initWeaponLen: 3,
            period: 11,
            max: 4,
        },
        {
            initWeaponLen: 4,
            period: 10,
            max: 8,
        },
        {
            // allow all weapons?
            // initWeaponLen: 10,
            initWeaponLen: 4,
            period: 8,
            max: 16,
        },
    ],
    items: {
        lifetime: 200,
    },
    barrels: {
        initCount: 32,
        hp: [3, 7],
        dropWeapon: {
            chance: 70,
            min: 4,
        },
    },
    walls: {
        initCount: 64,
    },
    trees: {
        initCount: 64,
    },
    camera: {
        // base resolution
        size: 256,
        listenerRadius: 256,
        baseScale: 1.1,
        inGameMenuScale: 0.5,
    },
    player: {
        // initial values for player's spawn
        hp: 10,
        sp: 0,
        mags: 1,
        jumpVel: 80,
        runVel: 120,
        walkVel: 60,
        startWeapon: [1, 2, 3],
        // startWeapon: [10],
    },
    world: {
        gravity: 5,
        gravityWeak: 3,
    },
    minimap: {
        size: 48,
        markerScale: 1,
        colors: {
            me: parseRGB("#fff"),
            player: parseRGB("#f00"),
            npc: parseRGB("#d06"),
            tree: parseRGB("#888"),
            barrel: parseRGB("#07f"),
            item: parseRGB("#0f0"),
            background: parseRGB("#010"),
            backgroundAlpha: 0.6,
        },
    },
    bodyColor: [
        parseRGB("#F9D"),
        parseRGB("#FC9"),
        parseRGB("#CF9"),
        parseRGB("#222"),
        parseRGB("#85F"),
        parseRGB("#CCC"),
    ],
    voice: {
        killAB: ["{0} CRUSHED {1}", "{0} destroyed {1}", "{0} killed {1}", "{0} took {1} life"],
        killNPC: ["warm-up for {0}", "{0} killed someone", "death by {0}", "{0} sows DEATH"],
    },
    actors: [
        {
            radius: OBJECT_RADIUS,
            height: OBJECT_RADIUS + 4 * WORLD_SCALE,
            groundLoss: 512,
            boundsLoss: 2,
            groundFriction: 0,
            invMass: 1,
            shadowScale: 1,
            shadowAdd: 0,
            shadowColor: 0,
            lightRadiusK: 4,
            light: 1,
        },
        {
            radius: OBJECT_RADIUS,
            height: OBJECT_RADIUS,
            groundLoss: 2,
            boundsLoss: 2,
            groundFriction: 8,
            invMass: 1,
            shadowScale: 1,
            shadowAdd: 0,
            shadowColor: 0,
            lightRadiusK: 0,
            light: 0,
        },
        {
            radius: BULLET_RADIUS,
            height: 0,
            groundLoss: 512,
            boundsLoss: 1,
            groundFriction: 0,
            invMass: 1,
            shadowScale: 2,
            shadowAdd: 1,
            shadowColor: parseRGB("#333"),
            lightRadiusK: 1,
            light: 1,
        },
        {
            radius: OBJECT_RADIUS + 4 * WORLD_SCALE,
            height: BULLET_RADIUS,
            groundLoss: 2,
            boundsLoss: 2,
            groundFriction: 8,
            invMass: 1,
            shadowScale: 1,
            shadowAdd: 0,
            shadowColor: 0,
            lightRadiusK: 1,
            light: 0.5,
        },
        {
            radius: OBJECT_RADIUS + 4 * WORLD_SCALE,
            height: OBJECT_RADIUS + 4 * WORLD_SCALE,
            groundLoss: 512,
            boundsLoss: 0,
            groundFriction: 8,
            invMass: 0,
            shadowScale: 1,
            shadowAdd: 0,
            shadowColor: 0,
            lightRadiusK: 0,
            light: 0,
        },
    ],
    bullets: [
        {
            length: 0.2,
            lightLength: 0.1,
            size: 6,
            pulse: 0,
            color: [parseRGB("#fff")],
            images: [Img.circle_4_60p, Img.circle_4_70p, Img.box],
            rayPenetrations: 0,
        },
        {
            length: 2,
            lightLength: 2,
            size: 3 / 2,
            pulse: 0,
            color: [parseRGB("#ff4")],
            images: [Img.circle_4_60p, Img.circle_4_70p, Img.box],
            rayPenetrations: 0,
        },
        {
            length: 1,
            lightLength: 2,
            size: 2,
            pulse: 1,
            color: [parseRGB("#4ff")],
            images: [Img.circle_4_60p, Img.circle_4_70p, Img.box],
            rayPenetrations: 0,
        },
        {
            length: 8,
            lightLength: 2,
            size: 4,
            pulse: 0,
            color: [parseRGB("#333")],
            images: [Img.box_r, Img.box_r, Img.box_r],
            rayPenetrations: 0,
        },
        {
            length: 512,
            lightLength: 512,
            size: 12,
            pulse: 0,
            color: [
                parseRGB("#f00"),
                parseRGB("#0f0"),
                parseRGB("#0ff"),
                parseRGB("#ff0"),
                parseRGB("#f0f"),
            ],
            images: [Img.box_l, Img.box_l, Img.box_l],
            rayPenetrations: 16,
        },
        {
            length: 512,
            lightLength: 512,
            size: 2,
            pulse: 0,
            color: [parseRGB("#FF0")],
            images: [Img.box_l, Img.box_l, Img.box_l],
            rayPenetrations: 1,
        },
    ],
    weapons: [],
};


{
    const newWeapon = (): WeaponConfig => ({
        name: "",
        reloadTime: 60,
        launchTime: 0,
        relaunchSpeed: 2,
        spawnCount: 1,
        angleVar: 0,
        angleSpread: 0,
        kickBack: 0,
        offset: 0,
        velocity: 0,
        velocityVar: 0,
        cameraShake: 0,
        detuneSpeed: 1,
        cameraFeedback: 0,
        cameraLookForward: 0,
        cameraScale: 1,
        gfxRot: 0,
        gfxSx: 1,
        gfxColor: parseRGB("#fff"),
        handsAnim: 0,
        bulletType: BulletType.Melee,
        bulletDamage: 1,
        bulletLifetime: 0,
        bulletHp: 1,
        clipSize: 0,
        clipReload: 0,
        ai_shootDistanceMin: 0,
        ai_shootDistanceMax: 0xffffffff,
        moveWeightK: 1.0,
        laserSightColor: 0,
        laserSightSize: 0,
    });

    const createArmWeapon = (): WeaponConfig => {
        const w = newWeapon();
        w.angleSpread = 0.5;
        w.launchTime = 30;
        w.kickBack = 10;
        w.offset = 6;
        w.velocity = 300;
        w.detuneSpeed = 16;
        w.cameraFeedback = 0.02 / 5;
        w.cameraLookForward = 0.1;
        w.handsAnim = 12;
        w.bulletDamage = 2;
        // w.bulletLifetime_ = 2;
        w.bulletLifetime = 3;
        w.ai_shootDistanceMax = 32 * WORLD_SCALE;
        return w;
    };

    const createGunWeapon = (): WeaponConfig => {
        const w = newWeapon();
        w.kickBack = 32;
        w.offset = 16;
        w.velocity = 600;
        w.detuneSpeed = 16;
        w.cameraFeedback = 0.02 / 5;
        w.cameraLookForward = 0.2;
        w.bulletType = BulletType.Shell;
        w.bulletShellColor = 0xffdd22;
        w.clipSize = 30;
        w.clipReload = 60;
        // w.ai_shootDistanceMin_ = 128 * WORLD_SCALE;
        w.ai_shootDistanceMin = 24 * WORLD_SCALE;
        w.ai_shootDistanceMax = 256 * WORLD_SCALE;
        w.moveWeightK = 0.8;
        w.laserSightColor = 0xff0000;
        w.laserSightSize = 2;
        return w;
    };

    const weapons: WeaponConfig[] = [
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
        // 10: uzi
        createGunWeapon(),

        //11, 12, 13
    ];

    let i = 1;

// 🔪
    weapons[i].name = "Knife";
    weapons[i].reloadTime = 10;
    weapons[i].launchTime = 5;
    weapons[i].bulletDamage = 2;
    weapons[i].gfxRot = -45;

// AXE
    ++i;
    weapons[i].name = "Axe";
    weapons[i].reloadTime = 30;
    weapons[i].launchTime = 15;
    weapons[i].bulletDamage = 8;
    weapons[i].gfxRot = -45;
    weapons[i].moveWeightK = 0.9;

// 🔫
    ++i;
    weapons[i].name = "Pistol";
    weapons[i].bulletDamage = 3;
    weapons[i].angleSpread = 0.1;
    weapons[i].velocity /= 2;
    weapons[i].relaunchSpeed = 16;
    weapons[i].detuneSpeed = 16;
    weapons[i].cameraFeedback = 0.02;
    weapons[i].clipSize = 9 * 3;
    weapons[i].moveWeightK = 1.0;

// 🖊 light auto gun
    ++i;
    weapons[i].name = "Automatic Gun";
    weapons[i].reloadTime = 5;
    weapons[i].angleSpread = 0.25;
    weapons[i].kickBack = 20;
    weapons[i].detuneSpeed = 16;
    weapons[i].cameraFeedback = 0.02;

// ✏️ hard machine-gun?
    ++i;
    weapons[i].name = "Machine Gun";
    weapons[i].reloadTime = 8;
    weapons[i].angleSpread = 0.25;
    weapons[i].kickBack = 20;
    weapons[i].velocity /= 2;
    weapons[i].detuneSpeed = 16;
    weapons[i].cameraFeedback = 0.05;
    weapons[i].cameraLookForward = 0.3;
    weapons[i].bulletDamage = 2;

// 🪥 SHOT GUN
    ++i;
    weapons[i].name = "Shotgun";
    weapons[i].spawnCount = 5;
    weapons[i].angleSpread = 0.5;
    weapons[i].detuneSpeed = 32;
    weapons[i].cameraFeedback = 0.1;
    weapons[i].velocity = 300;
    weapons[i].velocityVar = 200;
    weapons[i].handsAnim = 1;
    weapons[i].angleVar = 0.5;
    weapons[i].bulletHp = 2;
    weapons[i].bulletDamage = 2;
    weapons[i].bulletShellColor = parseRGB("#a00");
    weapons[i].clipSize = 7;
    weapons[i].moveWeightK = 0.9;

// CROSS BOW ⛏
    ++i;
    weapons[i].name = "Crossbow";
    weapons[i].detuneSpeed = 1;
    weapons[i].cameraFeedback = 0.2;
    weapons[i].cameraLookForward = 0.4;
    weapons[i].cameraScale = 1.5;
    weapons[i].velocity = 960;
    weapons[i].handsAnim = 1;
    weapons[i].bulletDamage = 5;
    weapons[i].bulletType = BulletType.Arrow;
    weapons[i].bulletShellColor = parseRGB("#0f0");
    weapons[i].clipSize = 7;
    weapons[i].moveWeightK = 0.9;

// 🔌 plasma shock
    ++i;
    weapons[i].name = "Plasma Gun";
    weapons[i].angleSpread = 0.5;
    weapons[i].detuneSpeed = 10;
    weapons[i].reloadTime = 10;
    weapons[i].cameraLookForward = 0.3;
    weapons[i].cameraFeedback = 0.05;
    weapons[i].velocity = 420;
    weapons[i].bulletDamage = 1;
    weapons[i].bulletHp = 2;
    weapons[i].bulletType = BulletType.Plasma;
    weapons[i].bulletShellColor = parseRGB("#0ff");
    weapons[i].clipSize = 35;

// 🧵 RAIL GUN
    ++i;
    weapons[i].name = "Railgun";
    weapons[i].reloadTime = 120;
    weapons[i].cameraShake = 25;
    // weapons[i].velocity = 1000;
    weapons[i].velocity = 600;
    weapons[i].cameraFeedback = 0.1;
    weapons[i].cameraLookForward = 0.4;
    weapons[i].cameraScale = 1.4;
    weapons[i].bulletDamage = 5;
    weapons[i].bulletHp = 15;
    weapons[i].bulletType = BulletType.Ray;
    weapons[i].bulletLifetime = 10;
    weapons[i].bulletShellColor = parseRGB("#909");
    weapons[i].clipSize = 5;

    // uzi: 🧣
    ++i;
    weapons[i].name = "Uzi";
    weapons[i].reloadTime = 4;
    weapons[i].angleSpread = 0.1;
    weapons[i].kickBack = 20;
    weapons[i].detuneSpeed = 4;
    weapons[i].velocity = 300;
    weapons[i].cameraFeedback = 0.04;
    weapons[i].clipSize = 20;
    weapons[i].gfxColor = parseRGB("#399");
    weapons[i].bulletType = BulletType.Tracing;
    weapons[i].bulletLifetime = 8;
    weapons[i].bulletShellColor = parseRGB("#f60");
    weapons[i].laserSightColor = parseRGB("#080");
    weapons[i].laserSightSize = 1;

    gameConfig.weapons = weapons;
}

const configJson = JSON.stringify(gameConfig);
writeFileSync("packages/client/assets/config.json", configJson, "utf-8");
prepareFolders("public");
writeFileSync("public/config.json", configJson, "utf-8");
