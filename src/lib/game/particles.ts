import {img, Img} from "../assets/gfx";
import {beginRender, draw, flush, gl, setupProjection} from "../graphics/draw2d";
import {Actor, Particle, Vel} from "./types";
import {addRadialVelocity, addVelFrom, collideWithBounds, copyPosFromActorCenter, updateBody} from "./phy";
import {getLumaColor32, PI2} from "../utils/math";
import {GRAVITY} from "./data/world";
import {_SEED2, nextFloat2, setSeed2} from "../utils/rnd";
import {GL} from "../graphics/gl";
import {mapTexture} from "../assets/map";
import {BOUNDS_SIZE} from "../assets/params";

export const newParticle = (): Particle => ({
    x_: 0,
    y_: 0,
    z_: 0,
    u_: 0,
    v_: 0,
    w_: 0,
    a_: 0,
    r_: 0,
    color_: 0xFFFFFF,
    scale_: 1,
    lifeTime_: 0,
    lifeMax_: 600,
    img_: Img.particle_flesh0,
    followVelocity_: 0,
    followScale_: 0,
    splashSizeX_: 1,
    splashSizeY_: 1,
    splashImg_: 0,
    splashEachJump_: 0,
    splashScaleOnVelocity_: 0,
});

export const updateParticle = (p: Particle): boolean => {
    p.a_ += p.r_;
    ++p.lifeTime_;

    if (updateBody(p, GRAVITY, 2)) {
        if (p.splashImg_) {
            const v = Math.hypot(p.u_, p.v_, p.w_);
            if (v < 4 || p.splashEachJump_) {
                const d = 1 + p.splashScaleOnVelocity_ * v;
                splats.push(p.splashImg_, p.x_, p.y_, p.a_, p.splashSizeX_ * d, p.splashSizeY_ * d, p.color_);
            }
            if (v < 4) {
                return false;
            }
        }
        p.u_ /= 2;
        p.v_ /= 2;
        p.r_ = -p.r_ / 2;
    }

    collideWithBounds(p, 4, 2);

    return p.lifeTime_ < p.lifeMax_;
}

export const updateParticles = () => {
    for (let i = 0; i < particles.length;) {
        const p = particles[i];
        if (updateParticle(p)) {
            ++i;
        } else {
            particles.splice(i, 1);
        }
    }
}

let seed0: number;
let particles0: Particle[];
let particles: Particle[] = [];
let splats: number[] = [];

export const saveParticles = () => {
    seed0 = _SEED2;
    particles0 = particles.map(x => ({...x}));
}

export const restoreParticles = () => {
    setSeed2(seed0);
    particles = particles0;
    splats.length = 0;
}

export const drawSplats = () => {
    let i = 0;
    while (i < splats.length) {
        draw(
            img[splats[i++]],
            splats[i++],
            splats[i++],
            splats[i++],
            splats[i++],
            splats[i++],
            1,
            splats[i++]
        );
    }
}

export const drawParticles = () => {
    for (const p of particles) {
        drawParticle(p);
    }
}

export const drawParticle = (p: Particle) => {
    const velocityScale = 1 - p.followVelocity_ + p.followScale_ * Math.hypot(p.u_, p.v_, p.w_);
    const velocityAngle = p.followVelocity_ * Math.atan2(p.v_ - p.w_, p.u_);
    const scale = p.scale_;
    const angle = velocityAngle + p.a_;
    if (p.z_ > 1) {
        const s = 0.5 - p.z_ / 256;
        draw(img[Img.circle_4], p.x_, p.y_, 0, s, s / 4, 0.4, 0);
    }
    draw(img[p.img_], p.x_, p.y_ - p.z_, angle, scale * velocityScale, scale, 1, p.color_);
}

//////

export const addFleshParticles = (amount: number, actor: Actor, explVel: number, vel?: Vel) => {
    while (amount--) {
        const particle = newParticle();
        copyPosFromActorCenter(particle, actor);
        if (vel) {
            addVelFrom(particle, vel, nextFloat2() / 2);
        }
        addRadialVelocity(particle, nextFloat2() * PI2, (0.5 - nextFloat2()) * explVel, 0);
        particle.color_ = (0x60 + 0x30 * nextFloat2()) << 16;
        particle.img_ = Img.particle_shell;
        particle.splashImg_ = Img.circle_4;
        particle.splashEachJump_ = 1;
        particle.splashSizeX_ = 0.5;
        particle.splashSizeY_ = 0.5 / 4;
        particle.splashScaleOnVelocity_ = (1 + nextFloat2()) / 100;
        particle.scale_ = (1 + nextFloat2()) / 2;
        particle.followVelocity_ = 1;
        particle.followScale_ = 0.02;
        particles.push(particle);
    }
}

export const addBoneParticles = (amount: number, actor: Actor, vel: Vel) => {
    while (amount--) {
        const particle = newParticle();
        copyPosFromActorCenter(particle, actor);
        if (vel) {
            addVelFrom(particle, vel, nextFloat2() / 2);
        }
        addRadialVelocity(particle, nextFloat2() * PI2, (0.5 - nextFloat2()) * 128, nextFloat2() * 128);
        const i = nextFloat2() < 0.3 ? Img.particle_flesh0 : Img.particle_flesh1;
        particle.img_ = i;
        particle.splashImg_ = i;
        particle.splashImg_ = i;
        particle.scale_ = 0.5 + 0.25 * nextFloat2();
        particle.splashSizeX_ = particle.scale_;
        particle.splashSizeY_ = particle.scale_;
        particle.color_ = getLumaColor32(0x80 + 0x20 * nextFloat2());
        particle.r_ = (0.5 - nextFloat2()) * 0.1;
        particle.a_ = 0.5 - nextFloat2();
        particles.push(particle);
    }
}

export const addShellParticle = (player: Actor, offsetZ: number, color: number) => {
    const particle = newParticle();
    particle.x_ = player.x_;
    particle.y_ = player.y_;
    particle.z_ = player.z_ + offsetZ;
    particle.img_ = Img.particle_shell;
    particle.splashImg_ = Img.particle_shell;
    particle.color_ = color;
    particle.r_ = (0.5 - nextFloat2()) * 0.5;
    particle.a_ = nextFloat2() * PI2;
    addRadialVelocity(particle, nextFloat2() * PI2, 16 + 32 * nextFloat2(), 32);
    particles.push(particle);
}

export const flushSplatsToMap = () => {
    if (splats.length) {
        gl.bindFramebuffer(GL.FRAMEBUFFER, mapTexture.fbo_);
        beginRender();
        setupProjection(
            0, 0,
            0, 1,
            0, 1,
            BOUNDS_SIZE, -BOUNDS_SIZE
        );
        gl.viewport(0, 0, BOUNDS_SIZE, BOUNDS_SIZE);
        drawSplats();
        splats.length = 0;
        flush();
    }
}
