import {Actor} from "./types";
import {imgSpotLight} from "../assets/gfx";
import {beginRenderToTexture, clear, createTexture, draw, gl, initFramebuffer, uploadTexture} from "../graphics/draw2d";
import {BOUNDS_SIZE, WORLD_SCALE} from "../assets/params";
import {GL} from "../graphics/gl";
import {clientId} from "../net/messaging";
import {sin} from "../utils/math";
import {RGB} from "../utils/utils";

const FOG_DOWNSCALE = 4;
const FOG_SIZE = BOUNDS_SIZE / FOG_DOWNSCALE;
const fogTexture = createTexture(FOG_SIZE);
uploadTexture(fogTexture);
initFramebuffer(fogTexture);

export const beginFogRender = () => {
    beginRenderToTexture(fogTexture);
    clear(1, 1, 1, 1);
    gl.disable(GL.DEPTH_TEST);
    gl.depthMask(false);
    gl.blendFunc(GL.ZERO, GL.ONE_MINUS_SRC_ALPHA);
}


export const drawFogPoint = (x: number, y: number, r: number) => {
    r /= FOG_DOWNSCALE;
    x /= FOG_DOWNSCALE;
    y /= FOG_DOWNSCALE;
    draw(imgSpotLight, x, y, 0, r, r);
}

export const drawFogObjects = (...lists: Actor[][]) => {
    const SOURCE_RADIUS_BY_TYPE = [2, 0, 1, 1, 0, 0];
    for (const list of lists) {
        for (const a of list) {
            let r = SOURCE_RADIUS_BY_TYPE[a.type_];
            // isMyPlayer
            if (!a.type_ && clientId && a.client_ === clientId) {
                r *= 2;
            }
            drawFogPoint(a.x_ / WORLD_SCALE, (a.y_ - a.z_) / WORLD_SCALE, r);
        }
    }
}

export const renderFog = (t: number, add: number) =>
    draw(fogTexture, 0, 0, 0, FOG_DOWNSCALE, FOG_DOWNSCALE, 0.7, RGB(0x40 + 0x20 * sin(t), 0x11, 0x33), 0, add & 0x990000);