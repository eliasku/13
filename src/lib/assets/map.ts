import {rand} from "../utils/rnd";
import {createCanvas} from "./gfx";
import {createTexture, uploadTexture} from "../graphics/draw2d";
import {BOUNDS_SIZE} from "./params";
import {GL, gl} from "../graphics/gl";
import {PI2} from "../utils/math";

export const mapTexture = createTexture(BOUNDS_SIZE);
export let mapFramebuffer = gl.createFramebuffer();
gl.bindFramebuffer(GL.FRAMEBUFFER, mapFramebuffer);
gl.bindTexture(GL.TEXTURE_2D, mapTexture.texture_);
gl.framebufferTexture2D(GL.FRAMEBUFFER, GL.COLOR_ATTACHMENT0, GL.TEXTURE_2D, mapTexture.texture_, 0);
gl.bindFramebuffer(GL.FRAMEBUFFER, null);

export const generateMapBackground = (): void => {
    const map = createCanvas(BOUNDS_SIZE, false);
    const detailsColor = ["#080", "#572"];
    map.fillStyle = "#060";
    map.fillRect(0, 0, BOUNDS_SIZE, BOUNDS_SIZE);
    const sc = 4;
    map.scale(1,1/sc);
    for (let i = 0; i < BOUNDS_SIZE; ++i) {
        map.fillStyle = detailsColor[rand(2)];
        map.beginPath()
        map.arc(rand(BOUNDS_SIZE), rand(BOUNDS_SIZE) * sc, 1 + rand(16), 0, PI2);
        map.closePath();
        map.fill();
        map.fillRect(rand(BOUNDS_SIZE), rand(BOUNDS_SIZE) * sc, 1, 4 + rand(8));
        // map.fillText("🌼,🌸,🌺,🍀".split(",")[rand(4)], rand(BOUNDS_SIZE), rand(BOUNDS_SIZE) * sc);
        // map.fillText("🌷,🌻,🥀,🌿".split(",")[rand(4)], rand(BOUNDS_SIZE), rand(BOUNDS_SIZE) * sc);
    }

    ///// LZMA: ~111

    // ctx.resetTransform();
    // ctx.fillStyle = "#AAA";
    // for (let i = 0; i < 32; ++i) {
    //     ctx.beginPath()
    //     ctx.arc(rand(size), rand(size), 2, 0, PI, true);
    //     ctx.closePath();
    //     ctx.fill();
    // }

    ///// LZMA: ~64

    // ctx.font = "5px e";
    // ctx.fillStyle = "#FFF";
    // ctx.scale(1, 0.5);
    // for (let i = 0; i < 128; ++i) {
    //     ctx.fillText("🌼,🌸,🌺,🍀".split(",")[rand(4)], rand(size), rand(size * 2));
    // }
    // ctx.resetTransform();
    //
    // ctx.font = "8px e";
    // for (let i = 0; i < 32; ++i) {
    //     ctx.fillText("🌷,🌻,🥀,🌿".split(",")[rand(4)], rand(size), rand(size));
    // }

    uploadTexture(mapTexture.texture_, map.canvas);

    ///// LZMA: ~22
    // ctx.canvas.width = ctx.canvas.height = 0;


}
