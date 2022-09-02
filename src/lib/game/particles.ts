import {img, Img} from "../assets/gfx";
import {draw} from "../graphics/draw2d";
import {Actor, Particle, Vel} from "./types";
import {addRadialVelocity, collideWithBounds, updateBody} from "./phy";
import {getLumaColor32} from "../utils/math";
import {GRAVITY, OBJECT_HEIGHT} from "./data/world";
import {_SEED2, nextFloat2, setSeed2} from "../utils/rnd";

export function newParticle(): Particle {
    return {
        x: 0,
        y: 0,
        z: 0,
        u: 0,
        v: 0,
        w: 0,
        a: 0,
        r: 0,
        color_: 0xFFFFFF,
        scale_: 1,
        lifeTime_: 0,
        lifeMax_: 10,
        img_: Img.particle_flesh0,
        followVelocity_: 0,
        followScale_: 0,
        splashSizeX_: 1,
        splashSizeY_: 1,
        splashImg_: 0,
        splashEachJump_: 0,
        splashScaleOnVelocity_: 0,
    };
}

export function updateParticle(p: Particle, dt: number): boolean {
    p.a += p.r * dt;
    p.lifeTime_ += dt;

    if (updateBody(p, dt, GRAVITY, 2)) {
        if (p.splashImg_) {
            const v = Math.hypot(p.u, p.v, p.w);
            if (v < 4 || p.splashEachJump_) {
                const d = 1 + p.splashScaleOnVelocity_ * v;
                splats.push(p.splashImg_, p.x, p.y, p.a, p.splashSizeX_ * d, p.splashSizeY_ * d, p.color_);
            }
            if (v < 4) {
                return false;
            }
        }
        p.u /= 2;
        p.v /= 2;
        p.r = -p.r / 2;
    }

    collideWithBounds(p, 4, 2);

    return p.lifeTime_ < p.lifeMax_;
}

export function updateParticles(dt: number) {
    for (let i = 0; i < particles.length;) {
        const p = particles[i];
        if (updateParticle(p, dt)) {
            ++i;
        } else {
            particles.splice(i, 1);
        }
    }
}

let seed0: number;
let particles0: Particle[];
let particles: Particle[] = [];
let splats0: number[];
let splats: number[] = [];

export function saveParticles() {
    seed0 = _SEED2;
    splats0 = splats.concat();
    particles0 = particles.map(x => {
        return {...x};
    });
}

export function restoreParticles() {
    setSeed2(seed0);
    splats = splats0;
    particles = particles0;
}

export function drawSplats() {
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

export function drawParticles() {
    for (const p of particles) {
        drawParticle(p);
    }
}

export function drawParticle(p: Particle) {
    const velocityScale = 1 - p.followVelocity_ + p.followScale_ * Math.hypot(p.u, p.v, p.w);
    const velocityAngle = p.followVelocity_ * Math.atan2(p.v, p.u - p.w);
    const scale = p.scale_;
    const angle = velocityAngle + p.a;
    if (p.z > 1) {
        const s = 0.5 - p.z / 256;
        draw(img[Img.circle_4], p.x, p.y, 0, s, s / 4, 0.4, 0);
    }
    draw(img[p.img_], p.x, p.y - p.z, angle, scale * velocityScale, scale, 1, p.color_);
}

//////

export function addFleshParticles(amount: number, actor: Actor, explVel: number, vel?: Vel) {
    while (amount--) {
        const particle = newParticle();
        particle.x = actor.x;
        particle.y = actor.y;
        particle.z = actor.z + OBJECT_HEIGHT[actor.type_];
        if (vel) {
            const d = nextFloat2() / 2;
            particle.u = vel.u * d;
            particle.v = vel.v * d;
            particle.w = vel.w * d;
        }
        particle.color_ = (0x60 + 0x30 * nextFloat2()) << 16;
        addRadialVelocity(particle, (0.5 - nextFloat2()) * explVel, 0);
        // particle.a = Math.random() * Math.PI * 2;
        // particle.r = (0.5 - Math.random()) * Math.PI * 2 * 4;
        // particle.img_ = Img.particle_flesh0 + fxRand(3);
        particle.img_ = Img.particle_shell;
        particle.splashImg_ = Img.circle_4;
        particle.splashEachJump_ = 1;
        particle.splashSizeX_ = 0.5;
        particle.splashSizeY_ = 0.5 / 4;
        particle.splashScaleOnVelocity_ = 0.01 + 0.01 * nextFloat2();
        particle.scale_ = 0.5 + nextFloat2() * 0.5;
        particle.followVelocity_ = 1;
        particle.followScale_ = 0.02;
        particles.push(particle);
    }
}

export function addBoneParticles(amount: number, actor: Actor, vel: Vel) {
    while (amount--) {
        const particle = newParticle();
        particle.x = actor.x;
        particle.y = actor.y;
        particle.z = actor.z + OBJECT_HEIGHT[actor.type_];
        if (vel) {
            const d = nextFloat2() / 2;
            particle.u = vel.u * d;
            particle.v = vel.v * d;
            particle.w = vel.w * d;
        }
        addRadialVelocity(particle, 64 - 128 * nextFloat2(), 128 * nextFloat2());
        const i = nextFloat2() < 0.3 ? Img.particle_flesh0 : Img.particle_flesh1;
        particle.img_ = i;
        particle.splashImg_ = i;
        particle.splashImg_ = i;
        particle.scale_ = 0.5 + 0.25 * nextFloat2();
        particle.splashSizeX_ = particle.scale_;
        particle.splashSizeY_ = particle.scale_;
        particle.color_ = getLumaColor32(0x80 + 0x20 * nextFloat2());
        particle.r = (-0.5 + nextFloat2()) * Math.PI * 2;
        particle.a = -0.5 + nextFloat2();
        particles.push(particle);
    }
}

export function addShellParticle(player: Actor, offsetZ: number, color: number) {
    const particle = newParticle();
    particle.x = player.x;
    particle.y = player.y;
    particle.z = player.z + offsetZ;
    particle.img_ = Img.particle_shell;
    particle.splashImg_ = Img.particle_shell;
    particle.color_ = color;
    particle.r = (0.5 - nextFloat2()) * Math.PI * 8;
    particle.a = nextFloat2() * Math.PI * 2;
    addRadialVelocity(particle, 16 + 32 * nextFloat2(), 32);
    particles.push(particle);
}