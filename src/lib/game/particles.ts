import {img, Img} from "../assets/gfx";
import {draw} from "../graphics/draw2d";
import {Actor, Vel} from "./types";
import {addRadialVelocity, collideWithBounds, updateBody} from "./phy";
import {getLumaColor32} from "../utils/math";
import {GRAVITY, OBJECT_HEIGHT_BY_TYPE} from "./data/world";

export interface Particle {
    x: number;
    y: number;
    z: number;
    u: number;
    v: number;
    w: number;
    // angle
    a: number;
    // rotation speed
    r: number;

    scale_: number;
    color_: number;

    lifeTime_: number;
    lifeMax_: number;

    img_: Img;
    splashSizeX_: number;
    splashSizeY_: number;
    splashEachJump_: number;
    splashScaleOnVelocity_: number;
    splashImg_: number;
    followVelocity_: number;
    followScale_: number;
}

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

    if (updateBody(p, dt, GRAVITY, -0.5)) {
        if (p.splashImg_) {
            const v = Math.hypot(p.u, p.v, p.w);
            if (v < 4 || p.splashEachJump_) {
                const d = 1 + p.splashScaleOnVelocity_ * v;
                points.push(p.splashImg_, p.x, p.y, p.a, p.splashSizeX_ * d, p.splashSizeY_ * d, p.color_);
            }
            if (v < 4) {
                return false;
            }
        }
        p.u /= 2;
        p.v /= 2;
        p.r = -p.r / 2;
    }

    collideWithBounds(p, 4, 0.5);

    return p.lifeTime_ < p.lifeMax_;
}

export function updateParticles(list: Particle[], dt: number) {
    for (let i = 0; i < list.length;) {
        const p = list[i];
        if (updateParticle(p, dt)) {
            ++i;
        } else {
            // if(p.splashImg_) {
            //     points.push(p.splashImg_, p.x, p.y, p.a, p.splashSizeX_, p.splashSizeY_, p.color_);
            // }
            list.splice(i, 1);
        }
    }
}

export function drawParticles(list: Particle[]) {
    for (let i = 0; i < points.length;) {
        const res = points[i++];
        const x = points[i++];
        const y = points[i++];
        const r = points[i++];
        const scaleX = points[i++];
        const scaleY = points[i++];
        const color = points[i++];
        draw(img[res],
            x, y, r, scaleX, scaleY, 1, color, 0);
    }

    for (const p of list) {
        drawParticle(p);
    }
}

let points: number[] = [];

export function drawParticle(p: Particle) {
    const velocityScale = 1 - p.followVelocity_ + p.followScale_ * Math.hypot(p.u, p.v, p.w);
    const velocityAngle = p.followVelocity_ * Math.atan2(p.v, p.u - p.w);
    const scale = p.scale_;
    const angle = velocityAngle + p.a;
    draw(img[p.img_], p.x, p.y - p.z, angle, scale * velocityScale, scale, 1, p.color_);
}

//////

export function newFleshParticle(actor: Actor, explVel: number, vel?: Vel) {
    const particle = newParticle();
    particle.x = actor.x;
    particle.y = actor.y;
    particle.z = actor.z + OBJECT_HEIGHT_BY_TYPE[actor.type_];
    if (vel) {
        const d = Math.random() / 2;
        particle.u = vel.u * d;
        particle.v = vel.v * d;
        particle.w = vel.w * d;
    }
    particle.color_ = (0x60 + 0x30 * Math.random()) << 16;
    addRadialVelocity(particle, (0.5 - Math.random()) * explVel, 0);
    // particle.a = Math.random() * Math.PI * 2;
    // particle.r = (0.5 - Math.random()) * Math.PI * 2 * 4;
    // particle.img_ = Img.particle_flesh0 + fxRand(3);
    particle.img_ = Img.particle_shell;
    particle.splashImg_ = Img.circle_4;
    particle.splashEachJump_ = 1;
    particle.splashSizeX_ = 0.5;
    particle.splashSizeY_ = 0.5 / 4;
    particle.splashScaleOnVelocity_ = 0.01 + 0.01 * Math.random();
    particle.scale_ = 0.5 + 0.5 * Math.random();
    particle.followVelocity_ = 1;
    particle.followScale_ = 0.02;
    return particle;
}

export function newBoneParticle(actor: Actor, vel: Vel) {
    const particle = newParticle();
    particle.x = actor.x;
    particle.y = actor.y;
    particle.z = actor.z + OBJECT_HEIGHT_BY_TYPE[actor.type_];
    if (vel) {
        const d = Math.random() / 2;
        particle.u = vel.u * d;
        particle.v = vel.v * d;
        particle.w = vel.w * d;
    }
    addRadialVelocity(particle, 64 - 128 * Math.random(), 128 * Math.random());
    const i = Math.random() < 0.3 ? Img.particle_flesh0 : Img.particle_flesh1;
    particle.img_ = i;
    particle.splashImg_ = i;
    particle.splashImg_ = i;
    particle.scale_ = 0.5 + 0.25 * Math.random();
    particle.splashSizeX_ = particle.scale_;
    particle.splashSizeY_ = particle.scale_;
    particle.color_ = getLumaColor32(0x80 + 0x20 * Math.random());
    particle.r = (-0.5 + Math.random()) * Math.PI * 2;
    particle.a = -0.5 + Math.random();
    return particle;
}

export function newShellParticle(player: Actor, offsetZ: number,) {
    const particle = newParticle();
    particle.x = player.x;
    particle.y = player.y;
    particle.z = player.z + offsetZ;
    particle.img_ = Img.particle_shell;
    particle.splashImg_ = Img.particle_shell;
    particle.r = (0.5 - Math.random()) * Math.PI * 8;
    particle.a = Math.random() * Math.PI * 2;
    addRadialVelocity(particle, 16 + 32 * Math.random(), 32);
    return particle;
}