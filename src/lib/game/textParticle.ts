import {Actor, TextParticle} from "./types";
import {cubicOut} from "../utils/easing";
import {drawTextShadowCenter, fnt} from "../graphics/font";
import {WORLD_SCALE} from "../assets/params";
import {sin} from "../utils/math";

export const newTextParticle = (source: Actor, text: string): TextParticle => ({
    x_: source.x_,
    y_: source.y_,
    z_: source.z_,
    text_: text,
    lifetime_: 3 * 60,
    time_: 0
});

const updateTextParticle = (p: TextParticle): boolean => {
    ++p.time_;
    const t = p.time_ / p.lifetime_;
    return t >= 1;
}

const updateTextParticleList = (list: TextParticle[], i = 0) => {
    for (; i < list.length;) {
        if (updateTextParticle(list[i++])) {
            list.splice(--i, 1);
        }
    }
}

const textParticles: TextParticle[] = [];

export const updateTextParticles = () => updateTextParticleList(textParticles);

export const addTextParticle = (source: Actor, text: string) => {
    textParticles.push(newTextParticle(source, text));
};

export const drawTextParticles = () => {
    for (const p of textParticles) {
        const t = p.time_ / p.lifetime_;
        if (t > 0.5 && sin(t * 64) > 0.5) {
            continue;
        }
        const x = p.x_ / WORLD_SCALE;
        const offZ = (cubicOut(t) * 60 * WORLD_SCALE) | 0;
        const y = (p.y_ - p.z_ - offZ) / WORLD_SCALE;
        drawTextShadowCenter(fnt[0], p.text_, 8, x, y);
    }
}