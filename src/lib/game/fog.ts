import {Actor} from "./types";
import {Img, img} from "../assets/gfx";
import {beginRender, camera, createTexture, draw, flush, gl} from "../graphics/draw2d";
import {BOUNDS_SIZE} from "../assets/params";
import {GL} from "../graphics/gl";
import {fogFramebuffer} from "../assets/map";
import {PI2} from "../utils/math";
import {clientId} from "../net/messaging";

export const prerenderFog = (...lists: Actor[][]) => {
    gl.bindFramebuffer(GL.FRAMEBUFFER, fogFramebuffer);
    camera.scale_ = camera.toY_ = 1;
    camera.angle_ = camera.toX_ = camera.atX_ = camera.atY_ = 0;
    beginRender(BOUNDS_SIZE, -BOUNDS_SIZE);
    gl.clearColor(1, 1, 1, 1);
    gl.clear(GL.COLOR_BUFFER_BIT);
    gl.blendFunc(GL.ZERO, GL.ONE_MINUS_SRC_ALPHA);

    const SOURCE_RADIUS_BY_TYPE = [64, 0, 32, 32, 0, 0];
    for(const list of lists) {
        for (const a of list) {
            let r = SOURCE_RADIUS_BY_TYPE[a.type_] / (32 * 4);
            if(r) {
                if (!a.type_ && a.client_ == clientId) {
                    r *= 3;
                }
                draw(img[Img.light_circle], (a.x_ + 256) / 4, (a.y_ + 256 - a.z_) / 4, 0,
                    r, r, 1);
                // draw(img[Img.light_circle], (a.x_ + 256) / 4, (a.y_ + 256) / 4, 0,
                //     r, r / 4, 1);
            }
        }
    }

    flush();
}
