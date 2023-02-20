import {ActorType} from "../game/types.js";
import {Img} from "../assets/img.js";

export interface NPCLevelConfig {
    initWeaponLen: number;
    period: number;
    max: number;
}

export interface ItemsConfig {
    // should be < (2 ** 8)
    // div by 3
    // (10 * Const.NetFq) / 3 => 200
    lifetime: number;
}

export interface DropWeaponConfig {
    chance: number;
    min: number;
}

export interface BarrelsConfig {
    initCount: number;
    hp: number[];
    dropWeapon: DropWeaponConfig;
}

export interface WallsConfig {
    initCount: number;
}

export interface TreesConfig {
    initCount: number;
}

export interface CameraConfig {
    // base resolution
    size: number;
    listenerRadius: number;
    baseScale: number;
    inGameMenuScale: number;
}

export interface PlayerConfig {
    // initial values for player's spawn
    hp: number;
    sp: number;
    mags: number;
    jumpVel: number;
    runVel: number;
    walkVel: number;
    // [weapon0, weapon1, weapon2, ...]
    startWeapon: number[];
}

export interface WorldConfig {
    gravity: number;
    gravityWeak: number;
}

export interface MiniMapColors {
    me: number;
    player: number;
    npc: number;
    tree: number;
    barrel: number;
    item: number;
    background: number;
    backgroundAlpha: number;
}

export interface MiniMapConfig {
    size: number;
    markerScale: number;
    colors: MiniMapColors;
}

export interface VoiceConfig {
    killAB: string[];
    killNPC: string[];
}

export interface ActorProp {
    radius: number;
    height: number;
    groundLoss: number;
    boundsLoss: number;
    groundFriction: number;
    invMass: number;
    shadowScale: number;
    shadowAdd: number;
    shadowColor: number;
    lightRadiusK: number;
    light: number;
}

export const BulletType = {
    Melee: 0,
    Shell: 1,
    Plasma: 2,
    Arrow: 3,
    Ray: 4,
    Tracing: 5,
} as const;
export type BulletType = (typeof BulletType)[keyof typeof BulletType];

export interface BulletData {
    readonly length: number;
    readonly lightLength: number;
    readonly size: number;
    readonly pulse: number;
    readonly color: number[];
    readonly images: [Img, Img, Img];
    readonly rayPenetrations: number;
}

export interface WeaponConfig {
    name: string;
    // TODO: rename to reload-tics
    reloadTime: number;
    launchTime: number;
    // relaunch speed is steps to advance to launchTime
    relaunchSpeed: number;

    spawnCount: number;
    angleVar: number;
    angleSpread: number;
    kickBack: number;
    offset: number;
    velocity: number;
    velocityVar: number;
    cameraShake: number;
    detuneSpeed: number;
    cameraFeedback: number;
    cameraLookForward: number;
    cameraScale: number;
    gfxRot: number;
    gfxSx: number;
    gfxColor: number;
    handsAnim: number;
    bulletType: BulletType;
    bulletDamage: number;
    bulletLifetime: number;
    bulletHp: number;
    bulletShellColor?: number;

    clipSize: number;
    clipReload: number;

    ai_shootDistanceMin: number;
    ai_shootDistanceMax: number;

    // value affects movement speed, jump velocity
    moveWeightK: number;
    laserSightColor: number;
    laserSightSize: number;
}

export interface GameConfig {
    npc: NPCLevelConfig[];
    items: ItemsConfig;
    barrels: BarrelsConfig;
    walls: WallsConfig;
    trees: TreesConfig;
    camera: CameraConfig;
    player: PlayerConfig;
    world: WorldConfig;
    minimap: MiniMapConfig;
    bodyColor: number[];
    voice: VoiceConfig;
    actors: Record<ActorType, ActorProp>;
    bullets: Record<BulletType, BulletData>;
    weapons: WeaponConfig[];
}
