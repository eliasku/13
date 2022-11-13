import {GL} from "./gl";
import {cos, sin} from "../utils/math";
import {
    SHADER_FRAGMENT,
    SHADER_A_COLOR_MUL,
    SHADER_A_LOCATION,
    SHADER_U_MVP,
    SHADER_A_COLOR_ADD,
    SHADER_A_ROTATION,
    SHADER_A_SCALE,
    SHADER_A_UVS,
    SHADER_U_TEX,
    SHADER_A_Z,
    SHADER_VERTEX, SHADER_A_ANCHOR, SHADER_A_TRANSLATION
} from "./shader";

export const gl = c.getContext("webgl", {
    antialias: false,
    // defaults:
    // alpha: true, - don't emulate RGB24
    depth: true,
    // stencil: false
});

const instancedArrays = gl.getExtension('ANGLE_instanced_arrays')!;

if (process.env.NODE_ENV === "development") {
    if (!gl || !instancedArrays) {
        alert("WebGL is required");
    }
}

gl.pixelStorei(GL.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);

(onresize = (_?: any,
             w: number = innerWidth,
             h: number = innerHeight,
             s: number = devicePixelRatio) => {
    c.width = w * s;
    c.height = h * s;
    c.style.width = w + "px";
    c.style.height = h + "px";
})();

const maxBatch = 65535;
// const depth = 1e5;
// const depth = 1;
// TODO: move to scope

const floatSize = 2 + 2 + 1 + 1 + 2 + 4 + 1 + 1 + 1;
const byteSize = floatSize * 4;
// maxBatch * byteSize
// const arrayBuffer = new ArrayBuffer(1 << 22/* maxBatch * byteSize */);
const floatView = new Float32Array(1 << 20);
const uintView = new Uint32Array(floatView.buffer);

interface Program {
    program: WebGLProgram;
    u_mvp: WebGLUniformLocation;
    u_tex0: WebGLUniformLocation;
    a_location: GLint,
    a_anchor: GLint,
    a_scale: GLint,
    a_translation: GLint,
    a_uvs: GLint,
    a_z: GLint;
    a_rotation: GLint;
    a_colorMul: GLint;
    a_colorAdd: GLint;
}

const createProgram = (vs: string, fs: string): Program => {
    const compileShader = (source: string, shader: GLenum | WebGLShader): WebGLShader => {
        shader = gl.createShader(shader as GLenum);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (process.env.NODE_ENV === "development") {
            if (!gl.getShaderParameter(shader, GL.COMPILE_STATUS)) {
                const error = gl.getShaderInfoLog(shader);
                gl.deleteShader(shader);
                console.error(error);
            }
        }
        return shader;
    }

    const createBuffer = (type: GLenum, src: ArrayBufferLike, usage: GLenum) => {
        gl.bindBuffer(type, gl.createBuffer());
        gl.bufferData(type, src, usage);
    }

    const bindAttrib = (prg: WebGLProgram, name: GLint, size: number, stride: number, divisor: number, offset: number, type: GLenum, norm: boolean) => {
        gl.enableVertexAttribArray(name);
        gl.vertexAttribPointer(name, size, type, norm, stride, offset);
        if (divisor) {
            instancedArrays.vertexAttribDivisorANGLE(name, divisor);
        }
    }

    const vertShader = compileShader(vs, GL.VERTEX_SHADER);
    const fragShader = compileShader(fs, GL.FRAGMENT_SHADER);
    const program = gl.createProgram();
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    if (process.env.NODE_ENV === "development") {
        if (!gl.getProgramParameter(program, GL.LINK_STATUS)) {
            const error = gl.getProgramInfoLog(program);
            gl.deleteProgram(program);
            console.error(error);
        }
    }

    gl.deleteShader(vertShader);
    gl.deleteShader(fragShader);

    const p:Program = {
        program,
        u_mvp: gl.getUniformLocation(program, SHADER_U_MVP),
        u_tex0: gl.getUniformLocation(program, SHADER_U_TEX),

        a_location: gl.getAttribLocation(program, SHADER_A_LOCATION),
        a_anchor: gl.getAttribLocation(program, SHADER_A_ANCHOR),
        a_rotation: gl.getAttribLocation(program, SHADER_A_ROTATION),
        a_scale: gl.getAttribLocation(program, SHADER_A_SCALE),
        a_translation: gl.getAttribLocation(program, SHADER_A_TRANSLATION),
        a_uvs: gl.getAttribLocation(program, SHADER_A_UVS),
        a_z: gl.getAttribLocation(program, SHADER_A_Z),
        a_colorMul: gl.getAttribLocation(program, SHADER_A_COLOR_MUL),
        a_colorAdd: gl.getAttribLocation(program, SHADER_A_COLOR_ADD),
    };
    // static quad indices and vertices
    createBuffer(GL.ELEMENT_ARRAY_BUFFER, new Uint8Array([0, 1, 2, 2, 1, 3]), GL.STATIC_DRAW);
    createBuffer(GL.ARRAY_BUFFER, new Float32Array([0, 0, 0, 1, 1, 0, 1, 1]), GL.STATIC_DRAW);

    bindAttrib(program, p.a_location, 2, 0, 0, 0, GL.FLOAT, false);

    // dynamic buffer
    createBuffer(GL.ARRAY_BUFFER, floatView, GL.DYNAMIC_DRAW);

    bindAttrib(program, p.a_anchor, 2, byteSize, 1, 0, GL.FLOAT, false);
    bindAttrib(program, p.a_scale, 2, byteSize, 1, 8, GL.FLOAT, false);
    bindAttrib(program, p.a_rotation, 1, byteSize, 1, 16, GL.FLOAT, false);
    bindAttrib(program, p.a_z, 1, byteSize, 1, 20, GL.FLOAT, false);
    bindAttrib(program, p.a_translation, 2, byteSize, 1, 24, GL.FLOAT, false);
    bindAttrib(program, p.a_uvs, 4, byteSize, 1, 32, GL.FLOAT, false);
    bindAttrib(program, p.a_colorMul, 4, byteSize, 1, 48, GL.UNSIGNED_BYTE, true);
    bindAttrib(program, p.a_colorAdd, 4, byteSize, 1, 52, GL.UNSIGNED_BYTE, true);

    return p;
}

let quadCount = 0;
let quadTexture: WebGLTexture;
const program = createProgram(SHADER_VERTEX, SHADER_FRAGMENT);

export interface Texture {
    texture_?: WebGLTexture;
    w_: number;
    h_: number;
    // anchor
    x_: number;
    y_: number;
    // uv rect (stpq)
    u0_: number;
    v0_: number;
    u1_: number;
    v1_: number;
    fbo_?: WebGLFramebuffer;
}

export const getSubTexture = (src: Texture, x: number, y: number, w: number, h: number, ax: number = 0.5, ay: number = 0.5): Texture => ({
    texture_: src.texture_,
    w_: w,
    h_: h,
    x_: ax,
    y_: ay,
    u0_: x / src.w_,
    v0_: y / src.h_,
    u1_: w / src.w_,
    v1_: h / src.h_,
});

export const createTexture = (size: number): Texture => ({
    texture_: gl.createTexture(),
    w_: size,
    h_: size,
    x_: 0,
    y_: 0,
    u0_: 0,
    v0_: 0,
    u1_: 1,
    v1_: 1
});

export const initFramebuffer = (texture: Texture) => {
    texture.fbo_ = gl.createFramebuffer();
    gl.bindFramebuffer(GL.FRAMEBUFFER, texture.fbo_);
    gl.bindTexture(GL.TEXTURE_2D, texture.texture_);
    gl.framebufferTexture2D(GL.FRAMEBUFFER, GL.COLOR_ATTACHMENT0, GL.TEXTURE_2D, texture.texture_, 0);
}

export const uploadTexture = (texture: Texture, source?: TexImageSource, filter: GLint = GL.NEAREST): void => {
    gl.bindTexture(GL.TEXTURE_2D, texture.texture_);
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, filter);
    if (source) {
        gl.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA, GL.RGBA, GL.UNSIGNED_BYTE, source);
    } else {
        gl.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA, texture.w_, texture.h_, 0, GL.RGBA, GL.UNSIGNED_BYTE, null);
    }
}

// set projection and activate 0 texture level
export const setupProjection = (
    posX: number, posY: number,
    pivotX: number, pivotY: number,
    angle: number, scale: number,
    width: number, height: number
) => {
    const x = posX - width * pivotX;
    const y = posY - height * pivotY;

    const c = scale * cos(angle);
    const s = scale * sin(angle);

    const w = 2 / width;
    const h = -2 / height;

    /*
    |   1 |    0| 0| 0|
    |   0 |    1| 0| 0|
    |   0 |    0| 1| 0|
    | at.x| at.y| 0| 1|
    x
    |  c| s| 0| 0|
    | -s| c| 0| 0|
    |  0| 0| 1| 0|
    |  0| 0| 0| 1|
    x
    |     1|     0| 0| 0|
    |     0|     1| 0| 0|
    |     0|     0| 1| 0|
    | -at.x| -at.y| 0| 1|
    x
    |     2/width|           0|        0| 0|
    |           0|   -2/height|        0| 0|
    |           0|           0| -1/depth| 0|
    | -2x/width-1| 2y/height+1|        0| 1|
    */
    const depth = 1e5;
    gl.uniformMatrix4fv(program.u_mvp, false, [
        c * w, s * h, 0, 0,
        -s * w, c * h, 0, 0,
        0, 0, -1 / depth, 0,
        (posX * (1 - c) + posY * s) * w - 2 * x / width - 1,
        (posY * (1 - c) - posX * s) * h + 2 * y / height + 1,
        0, 1,
    ]);

    gl.uniform1i(program.u_tex0, 0);
}

export const beginRender = () => {
    gl.enable(GL.BLEND);
    gl.blendFunc(GL.ONE, GL.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(program.program);
}

export const clear = (r: number, g: number, b: number, a: number) => {
    gl.clearColor(r, g, b, a);
    gl.clear(GL.COLOR_BUFFER_BIT);
}

export const beginRenderToTexture = (texture: Texture) => {
    beginRender();
    const w = texture.w_;
    const h = texture.h_;
    setupProjection(0, 0, 0, 1, 0, 1, w, -h);
    gl.bindFramebuffer(GL.FRAMEBUFFER, texture.fbo_);
    gl.viewport(0, 0, w, h);
    gl.scissor(0, 0, w, h);
}

export const beginRenderToMain = (x: number, y: number, px: number, py: number, angle: number, scale: number,
                                  w = gl.drawingBufferWidth,
                                  h = gl.drawingBufferHeight) => {
    beginRender();
    setupProjection(x, y, px, py, angle, scale, w, h);
    gl.bindFramebuffer(GL.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.enable(GL.SCISSOR_TEST);
    gl.scissor(0, 0, w, h);
}

export const flush = (_count = quadCount) => {
    if (_count) {
        gl.bindTexture(GL.TEXTURE_2D, quadTexture);
        gl.bufferSubData(GL.ARRAY_BUFFER, 0, floatView.subarray(0, _count * floatSize));
        instancedArrays.drawElementsInstancedANGLE(GL.TRIANGLES, 6, GL.UNSIGNED_BYTE, 0, _count);
        quadCount = 0;
    }
}

let drawZ = 0;
export const setDrawZ = (z: number) => drawZ = z;

export const draw = (texture: Texture, x: number, y: number, r: number = 0, sx: number = 1, sy: number = 1, alpha: number = 1, color: number = 0xFFFFFF, additive: number = 0, offset: number = 0) => {
    if (quadTexture != texture.texture_ || quadCount == maxBatch) {
        flush();
        quadTexture = texture.texture_;
    }
    let i = quadCount++ * floatSize;
    floatView[i++] = texture.x_;
    floatView[i++] = texture.y_;
    floatView[i++] = sx * texture.w_;
    floatView[i++] = sy * texture.h_;
    floatView[i++] = r;
    floatView[i++] = drawZ;
    floatView[i++] = x;
    floatView[i++] = y;
    floatView[i++] = texture.u0_;
    floatView[i++] = texture.v0_;
    floatView[i++] = texture.u1_;
    floatView[i++] = texture.v1_;
    uintView[i++] = (((alpha * 0xFF) << 24) | color) >>> 0;
    uintView[i++] = (((additive * 0xFF) << 24) | offset) >>> 0;
}
