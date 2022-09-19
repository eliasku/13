import {Actor} from "./types";
import {Img, img} from "../assets/gfx";
import {beginRenderToTexture, clear, createTexture, draw, gl, initFramebuffer, uploadTexture} from "../graphics/draw2d";
import {BOUNDS_SIZE, WORLD_SCALE} from "../assets/params";
import {GL} from "../graphics/gl";
import {clientId} from "../net/messaging";
import {sin} from "../utils/math";

const FOG_DOWNSCALE = 4;
const FOG_SIZE = BOUNDS_SIZE / FOG_DOWNSCALE;
const fogTexture = createTexture(FOG_SIZE);
uploadTexture(fogTexture);
initFramebuffer(fogTexture);

export const beginFogRender = () => {
    beginRenderToTexture(fogTexture);
    clear(1, 1, 1, 1);
    gl.blendFunc(GL.ZERO, GL.ONE_MINUS_SRC_ALPHA);
}

export const renderFogObjects = (list: Actor[]) => {
    const SOURCE_RADIUS_BY_TYPE = [2, 0, 1, 1, 0, 0];
    const world2camera = WORLD_SCALE * FOG_DOWNSCALE;
    for (const a of list) {
        let r = SOURCE_RADIUS_BY_TYPE[a.type_] / FOG_DOWNSCALE;
        if (!a.type_ && a.client_ == clientId) {
            r *= 2;
        }
        draw(img[Img.light_circle], (a.x_) / world2camera, (a.y_ - a.z_) / world2camera, 0, r, r);
    }
}

export const renderFog = (t: number, add: number) =>
    draw(fogTexture, 0, 0, 0, FOG_DOWNSCALE, FOG_DOWNSCALE, 0.7, (0x40 + 0x20 * sin(t)) << 16 | 0x1133, 0, add & 0x990000);