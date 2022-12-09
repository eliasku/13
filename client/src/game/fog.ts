import {Actor} from "./types";
import {imgSpotLight} from "../assets/gfx";
import {
    beginRenderToTexture,
    createTexture,
    draw,
    emptyTexture,
    gl,
    initFramebuffer,
    setLightMapTexture,
    uploadTexture
} from "../graphics/draw2d";
import {BOUNDS_SIZE, WORLD_SCALE} from "../assets/params";
import {GL} from "../graphics/gl";
import {clientId} from "../net/messaging";
import {actorsConfig} from "./data/world";

const FOG_DOWNSCALE = 4;
const FOG_SIZE = BOUNDS_SIZE / FOG_DOWNSCALE;
export const fogTexture = createTexture(FOG_SIZE);
uploadTexture(fogTexture, undefined, GL.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
initFramebuffer(fogTexture);

export const beginFogRender = () => {
    setLightMapTexture(emptyTexture.texture_);
    beginRenderToTexture(fogTexture, FOG_DOWNSCALE);

    gl.clearColor(0, 0, 0, 1);
    gl.clear(GL.COLOR_BUFFER_BIT);

    gl.disable(GL.DEPTH_TEST);
    gl.depthMask(false);
    gl.blendFunc(GL.ONE, GL.ONE_MINUS_SRC_ALPHA);
}

export const drawFogPoint = (x: number, y: number, r: number, alpha: number) => {
    draw(imgSpotLight, x, y, 0, r, r, alpha);
}

export const drawFogObjects = (...lists: Actor[][]) => {
    for (const list of lists) {
        for (const a of list) {
            let type = actorsConfig[a.type_];
            let r = type.lightRadiusK;
            let alpha = type.light;
            if(r > 0 && alpha > 0) {
                // isMyPlayer
                if (!a.type_) {
                    if(clientId && a.client_ === clientId) {
                        //r *= 2;
                    }
                    else {
                        r /= 4;
                        // alpha /= 2;
                    }
                }
                draw(imgSpotLight, a.x_ / WORLD_SCALE, (a.y_ - a.z_) / WORLD_SCALE, 0, r, r, alpha);
            }
        }
    }
}
