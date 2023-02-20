import {img} from "../assets/gfx.js";
import {beginRender, draw, drawMeshSprite, flush, gl, setDrawZ, setupProjection} from "../graphics/draw2d.js";
import {Actor, ActorType, Pos, Vel} from "./types.js";
import {addRadialVelocity, addVelFrom, collideWithBounds, copyPosFromActorCenter, updateBody} from "./phy.js";
import {atan2, cos, hypot, max, min, PI, sin, sqrt} from "../utils/math.js";
import {_SEEDS, random1, random1i, random1n} from "../utils/rnd.js";
import {GL} from "../graphics/gl.js";
import {mapTexture, mapTexture0} from "../assets/map.js";
import {BOUNDS_SIZE, WORLD_SCALE} from "../assets/params.js";
import {getLumaColor32, parseRGB, rgb_scale} from "../utils/utils.js";
import {cubicOut} from "../utils/easing.js";
import {drawTextAligned, fnt} from "../graphics/font.js";
import {BloodMode, Setting, settings} from "./settings.js";
import {GAME_CFG} from "./config.js";
import {Img} from "../assets/img.js";

export interface Particle extends Pos, Vel {
    // angle
    _a: number;
    // rotation speed
    _r: number;

    // gravity factor
    _gravity: number;

    _scale: number;
    _scaleDelta: number;
    _color: number;

    _lifeTime: number;
    _lifeMax: number;

    _img: Img;
    _splashSizeX: number;
    _splashSizeY: number;
    _splashEachJump: number;
    _splashScaleOnVelocity: number;
    _splashImg: number;
    _followVelocity: number;
    _followScale: number;

    _shadowScale: number;
}

export interface TextParticle extends Pos {
    _text: string;
    _lifetime: number;
    _time: number;
}

export const newParticle = (): Particle => ({
    _x: 0,
    _y: 0,
    _z: 0,
    _u: 0,
    _v: 0,
    _w: 0,
    _a: 0.0,
    _r: 0.0,
    _gravity: 1.0,
    _color: 0xffffff,
    _scale: 1.0,
    _scaleDelta: 0.0,
    _lifeTime: 0,
    _lifeMax: 600,
    _img: Img.particle_flesh0,
    _followVelocity: 0,
    _followScale: 0.0,
    _splashSizeX: 1.0,
    _splashSizeY: 1.0,
    _splashImg: 0,
    _splashEachJump: 0,
    _splashScaleOnVelocity: 0.0,
    _shadowScale: 5.0,
});

const updateParticle = (p: Particle): boolean => {
    p._a += p._r;
    ++p._lifeTime;

    if (updateBody(p, p._gravity * GAME_CFG.world.gravity, 2)) {
        if (p._splashImg) {
            const v = hypot(p._u, p._v, p._w);
            if (v < 4 || p._splashEachJump) {
                const d = 1 + p._splashScaleOnVelocity * v;
                let angle = p._a;
                if (p._followVelocity > 0) {
                    angle += p._followVelocity * atan2(p._v, p._u);
                }
                splats.push(
                    p._splashImg,
                    p._x / WORLD_SCALE,
                    p._y / WORLD_SCALE,
                    angle,
                    p._splashSizeX * d,
                    p._splashSizeY * sqrt(d),
                    p._color,
                );
            }
            if (v < 4) {
                return true;
            }
        }
        p._u /= 2;
        p._v /= 2;
        p._r = -p._r / 2;
    }

    collideWithBounds(p, 4, 2);

    return p._lifeTime > p._lifeMax;
};

const updateParticleList = (list: Particle[], i = 0) => {
    for (; i < list.length; ) {
        if (updateParticle(list[i++])) {
            list.splice(--i, 1);
        }
    }
};

export const updateParticles = () => {
    updateParticleList(opaqueParticles);
    updateTextParticleList(textParticles);
};

let seed0: number;
let opaqueParticles0: Particle[];
export let opaqueParticles: Particle[] = [];
let textParticles0: TextParticle[] = [];
export let textParticles: TextParticle[] = [];
export const splats: number[] = [];

export const saveParticles = () => {
    seed0 = _SEEDS[1];
    opaqueParticles0 = opaqueParticles.map(x => ({...x}));
    textParticles0 = textParticles.map(x => ({...x}));
};

export const resetParticles = () => {
    // particles.length = 0;
    opaqueParticles.length = 0;
    textParticles.length = 0;
    splats.length = 0;
};

export const restoreParticles = () => {
    _SEEDS[1] = seed0;
    // particles = particles0;
    opaqueParticles = opaqueParticles0;
    textParticles = textParticles0;
    splats.length = 0;
};

export const drawSplatsOpaque = (list = splats, i = 0) => {
    setDrawZ(0.1);
    for (; i < list.length; ) {
        drawMeshSprite(img[list[i++]], list[i++], list[i++], list[i++], list[i++], list[i++], 1, list[i++]);
    }
};

export const drawOpaqueParticles = () => {
    for (const p of opaqueParticles) {
        drawParticle(p);
    }
};

const drawListShadows = (particles: Particle[]) => {
    const maxH = 128 * WORLD_SCALE;
    const minH = WORLD_SCALE;
    for (const p of particles) {
        if (p._z > minH && p._z < maxH) {
            // if (p.z_ > minH) {//} && p.z_ < maxH) {
            const s = p._shadowScale * (0.5 - p._z / maxH);
            const t = 1 - p._lifeTime / p._lifeMax; // * s;
            drawMeshSprite(img[Img.box], p._x / WORLD_SCALE, p._y / WORLD_SCALE, 0, s, s / 4, 0.4 * t, 0);
        }
    }
};

export const drawParticleShadows = () => {
    drawListShadows(opaqueParticles);
};

export const drawParticle = (p: Particle) => {
    // const velocityScale = max(1, 1 - p.followVelocity_ + p.followScale_ * hypot(p.u_, p.v_, p.w_));
    const velocityScale = max(0, 1 - p._followVelocity + p._followScale * hypot(p._u, p._v, p._w));
    const velocityAngle = p._followVelocity * atan2(p._v - p._w, p._u);
    const lifeRatio = p._lifeTime / p._lifeMax;
    const scale = p._scale + p._scaleDelta * (lifeRatio * lifeRatio * lifeRatio);
    const angle = velocityAngle + p._a;
    setDrawZ(p._z / WORLD_SCALE + 0.1);
    drawMeshSprite(
        img[p._img],
        p._x / WORLD_SCALE,
        p._y / WORLD_SCALE,
        angle,
        scale * velocityScale,
        scale,
        1,
        p._color,
    );
};

//////

const KID_MODE_COLORS = [
    parseRGB("#2fff00"),
    parseRGB("#00fff7"),
    parseRGB("#007eff"),
    parseRGB("#8300ff"),
    parseRGB("#ff00ff"),
    parseRGB("#ff4b00"),
    parseRGB("#fffd00"),
];

const MATURE_BLOOD_COLORS = [parseRGB("#FF0000")];

export const addFleshParticles = (
    amount: number,
    actor: Pos & {_id: number; _type: ActorType},
    explVel: number,
    vel?: Vel,
) => {
    const bloodMode = settings[Setting.Blood];
    if (!bloodMode) return;
    const colors = bloodMode === BloodMode.Paint ? KID_MODE_COLORS : MATURE_BLOOD_COLORS;
    const idx = actor._id ?? random1i(colors.length);
    const color = colors[idx % colors.length];
    amount = (amount * settings[Setting.Particles]) | 0;
    while (amount--) {
        const particle = newParticle();
        copyPosFromActorCenter(particle, actor);
        if (vel) {
            addVelFrom(particle, vel, random1(0.5));
        }
        const v = explVel * sqrt(random1());
        addRadialVelocity(particle, random1n(PI), v, v * cos(random1(PI)));
        particle._v /= 2;
        particle._color = rgb_scale(color, 0.5 + random1(0.2));
        particle._img = Img.particle_shell;
        particle._splashImg = Img.circle_4;
        particle._splashEachJump = 1;
        particle._splashSizeX = 0.5;
        particle._splashSizeY = 0.5 / 2; // / 4;
        particle._splashScaleOnVelocity = (1 + sqrt(random1())) / 100;
        particle._scale = (1 + random1()) / 2;
        particle._followVelocity = 1;
        particle._followScale = 0.02;
        opaqueParticles.push(particle);
    }
};

export const spawnFleshParticles = (
    actor: Pos & {_id: number; _type: ActorType},
    expl: number,
    amount: number,
    vel?: Vel,
) => {
    addFleshParticles(amount, actor, expl, vel);
};

export const addBoneParticles = (amount: number, actor: Actor, vel: Vel) => {
    amount = (amount * settings[Setting.Particles]) | 0;
    while (amount--) {
        const particle = newParticle();
        copyPosFromActorCenter(particle, actor);
        if (vel) {
            addVelFrom(particle, vel, random1(0.5));
        }
        addRadialVelocity(particle, random1n(PI), 64 - 128 * sqrt(random1()), random1(128));
        const i = random1() < 0.3 ? Img.particle_flesh0 : Img.particle_flesh1;
        particle._img = i;
        particle._splashImg = i;
        particle._scale = 0.5 + random1(0.25);
        particle._splashSizeX = particle._scale;
        particle._splashSizeY = particle._scale;
        particle._color = getLumaColor32(200 + random1(50));
        particle._r = random1n(0.1);
        particle._a = random1n(0.5);
        opaqueParticles.push(particle);
    }
};

export const addShellParticle = (player: Actor, offsetZ: number, color: number) => {
    const particle = newParticle();
    particle._x = player._x;
    particle._y = player._y;
    particle._z = player._z + offsetZ;
    particle._img = Img.particle_shell;
    particle._splashImg = Img.particle_shell;
    particle._color = color;
    particle._r = random1n(0.25);
    particle._a = random1n(PI);
    addRadialVelocity(particle, random1n(PI), 16 + random1(32), 32);
    opaqueParticles.push(particle);
};

export const addStepSplat = (player: Actor, dx: number) => {
    splats.push(
        Img.box,
        (player._x + dx) / WORLD_SCALE + random1n(1),
        player._y / WORLD_SCALE + random1n(1),
        0,
        1 + random1(),
        1,
        getLumaColor32(0x44 + random1(0x10)),
    );
};

export const addLandParticles = (player: Actor, r: number, n: number) => {
    while (n--) {
        const particle = newParticle();
        const R = r * sqrt(random1());
        const a = random1n(PI);
        particle._x = player._x + R * cos(a);
        particle._y = player._y + R * sin(a);
        particle._z = 10;
        particle._img = Img.box;
        particle._color = getLumaColor32(0x66 + random1(0x22));
        particle._r = random1n(0.25);
        particle._a = random1n(PI);
        particle._lifeMax = 10 + random1i(40);
        particle._gravity = -random1(0.1);
        particle._scale = 8 * (0.4 + random1(0.5));
        particle._scaleDelta = -particle._scale;
        addRadialVelocity(particle, random1n(PI), 16 + random1(16), 8);
        // particles.push(particle);
        opaqueParticles.push(particle);
    }
};

let mapFadeTime0 = 0;
// draw particles splats and fade map
export const updateMapTexture = (time: number) => {
    const deltaFadeTime = time - mapFadeTime0;
    const MAP_FADE_TIME = 60;
    const MAP_FADE_MIN = 0.1;
    const MAP_FADE_TIME_STEP = MAP_FADE_TIME * MAP_FADE_MIN;
    if (splats.length || deltaFadeTime >= MAP_FADE_TIME_STEP) {
        gl.bindFramebuffer(GL.FRAMEBUFFER, mapTexture._fbo);
        beginRender();
        setupProjection(0, 0, 0, 1, 0, 1, BOUNDS_SIZE, -BOUNDS_SIZE);
        gl.viewport(0, 0, BOUNDS_SIZE, BOUNDS_SIZE);
        gl.scissor(0, 0, BOUNDS_SIZE, BOUNDS_SIZE);
        gl.disable(GL.DEPTH_TEST);
        gl.depthMask(false);
        if (splats.length) {
            drawSplatsOpaque();
            splats.length = 0;
        }
        if (deltaFadeTime >= MAP_FADE_TIME_STEP) {
            draw(mapTexture0, 0, 0, 0, 1, 1, min(1, deltaFadeTime / MAP_FADE_TIME));
            mapFadeTime0 = time;
        }
        flush();
    }
};

export const addImpactParticles = (amount: number, actor: Pos & {_type: ActorType}, vel: Vel, colors: number[]) => {
    amount = (amount * settings[Setting.Particles]) | 0;
    while (amount--) {
        const particle = newParticle();
        copyPosFromActorCenter(particle, actor);
        addVelFrom(particle, vel, -random1(0.2));
        addRadialVelocity(particle, random1n(PI), 32 * sqrt(random1()), 0);
        particle._color = colors[random1i(colors.length)];
        particle._img = Img.box_l;
        particle._scale = 1 + random1(1);
        particle._scaleDelta = -particle._scale;
        particle._followVelocity = 1;
        particle._followScale = 0.02;
        particle._lifeMax = 16 + random1(16);
        particle._shadowScale = 0.0;
        opaqueParticles.push(particle);
    }
};

// Text particles

export const newTextParticle = (source: Actor, text: string): TextParticle => ({
    _x: source._x,
    _y: source._y,
    _z: source._z,
    _text: text,
    _lifetime: 3 * 60,
    _time: 0,
});

const updateTextParticle = (p: TextParticle): boolean => {
    ++p._time;
    const t = p._time / p._lifetime;
    return t >= 1;
};

const updateTextParticleList = (list: TextParticle[], i = 0) => {
    for (; i < list.length; ) {
        if (updateTextParticle(list[i++])) {
            list.splice(--i, 1);
        }
    }
};

export const addTextParticle = (source: Actor, text: string) => {
    textParticles.push(newTextParticle(source, text));
};

export const drawTextParticles = () => {
    for (const p of textParticles) {
        const t = p._time / p._lifetime;
        if (t > 0.5 && sin(t * 64) > 0.5) {
            continue;
        }
        const x = p._x / WORLD_SCALE;
        const offZ = (cubicOut(t) * 60 * WORLD_SCALE) | 0;
        const y = (p._y - p._z - offZ) / WORLD_SCALE;
        drawTextAligned(fnt[0], p._text, 8, x, y);
    }
};
