import {Actor} from "./types";
import {Img, img} from "../assets/gfx";
import {beginRenderToTexture, clear, createTexture, draw, gl, initFramebuffer, uploadTexture} from "../graphics/draw2d";
import {BOUNDS_SIZE} from "../assets/params";
import {GL} from "../graphics/gl";
import {clientId} from "../net/messaging";
import {M} from "../utils/math";

const fogTexture = createTexture(BOUNDS_SIZE);
uploadTexture(fogTexture);
initFramebuffer(fogTexture);

export const beginFogRender = () => {
    beginRenderToTexture(fogTexture);
    clear(1, 1, 1, 1);
    gl.blendFunc(GL.ZERO, GL.ONE_MINUS_SRC_ALPHA);
}

export const renderFogObjects = (list: Actor[]) => {
    const SOURCE_RADIUS_BY_TYPE = [64, 0, 32, 32, 0, 0];
    for (const a of list) {
        let r = SOURCE_RADIUS_BY_TYPE[a.type_] / (32 * 4);
        if (r) {
            if (!a.type_ && a.client_ == clientId) {
                r *= 2;
            }
            draw(img[Img.light_circle], (a.x_ + 256) / 4, (a.y_ + 256 - a.z_) / 4, 0,
                r, r, 1);
            // draw(img[Img.light_circle], (a.x_ + 256) / 4, (a.y_ + 256) / 4, 0,
            //     r, r / 4, 1);
        }
    }
}

export const renderFog = (t: number, add: number) =>
    draw(fogTexture, -256, -256, 0, 4, 4, 0.7, (0x40 + 0x20 * M.sin(t)) << 16 | 0x1133, 0, add & 0x990000);