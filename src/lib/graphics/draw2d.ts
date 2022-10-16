import {GL} from "./gl";
import {cos, sin} from "../utils/math";
import {rehash} from "../utils/hasher";

export const gl = rehash(c.getContext("webgl", {
    antialias: false,
}));
const instancedArrays = rehash(gl.getExtension('ANGLE_instanced_arrays')!);

if (process.env.NODE_ENV === "development") {
    if (!gl || !instancedArrays) {
        alert("WebGL is required");
    }
}

gl.pixelStorei(GL.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);

//export let DPR = 1;
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

const floatSize = 2 + 2 + 1 + 2 + 4 + 1 + 1 + 1;
const byteSize = floatSize * 4;
// maxBatch * byteSize
// const arrayBuffer = new ArrayBuffer(1 << 22/* maxBatch * byteSize */);
const floatView = new Float32Array(1 << 20);
const uintView = new Uint32Array(floatView.buffer);
// let program: WebGLProgram | null = gl.createProgram();
let quadCount = 0;
let quadProgram: WebGLProgram;
let quadTexture: WebGLTexture;

const shader = `attribute vec2 g;
attribute vec2 a;
attribute vec2 t;
attribute float r;
attribute vec2 s;
attribute vec4 u;
attribute vec4 c;
attribute vec4 o;
uniform sampler2D x;
uniform mat4 m;
varying vec2 v;
varying vec4 i;
varying vec3 j;

export void vertex() {
  v = u.xy + g * u.zw;
  i = vec4(c.bgr * c.a, (1.0 - o.a) * c.a);
  j = o.bgr;
  vec2 p = (g - a) * s;
  float q = cos(r);
  float w = sin(r);
  p = vec2(p.x * q - p.y * w, p.x * w + p.y * q);
  p += a + t;
  gl_Position = m * vec4(p, 0, 1);
}

export void fragment() {
  vec4 c = i * texture2D(x, v);
  gl_FragColor = c + vec4(j * c.a, 0.0);
}
`;

// shaders minified with https://evanw.github.io/glslx/
const GLSLX_SOURCE_VERTEX = "attribute float b;attribute vec2 e,f,o,j;attribute vec4 k,g,l;uniform mat4 p;varying vec2 c;varying vec4 d;varying vec3 h;void main(){c=k.xy+e*k.zw,d=vec4(g.bgr*g.a,(1.-l.a)*g.a),h=l.bgr;vec2 a=(e-f)*j;float i=cos(b),m=sin(b);a=vec2(a.x*i-a.y*m,a.x*m+a.y*i),a+=f+o,gl_Position=p*vec4(a,0,1);}";
// still need to add `precision mediump float;` manually
const GLSLX_SOURCE_FRAGMENT = "precision mediump float;uniform sampler2D n;varying vec2 c;varying vec4 d;varying vec3 h;void main(){vec4 a=d*texture2D(n,c);gl_FragColor=a+vec4(h*a.a,0.);}";

const GLSLX_NAME_R = "b";
const GLSLX_NAME_G = "e";
const GLSLX_NAME_A = "f";
const GLSLX_NAME_C = "g";
const GLSLX_NAME_S = "j";
const GLSLX_NAME_U = "k";
const GLSLX_NAME_O = "l";
const GLSLX_NAME_X = "n";
const GLSLX_NAME_T = "o";
const GLSLX_NAME_M = "p";

{
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

    const bindAttrib = (name: string | GLint, size: number, stride: number, divisor: number, offset: number, type: GLenum, norm: boolean) => {
        name = gl.getAttribLocation(quadProgram, name as string);
        gl.enableVertexAttribArray(name);
        gl.vertexAttribPointer(name, size, type, norm, stride, offset);
        if (divisor) {
            instancedArrays.vertexAttribDivisorANGLE(name, divisor);
        }
    }

    quadProgram = gl.createProgram();
    gl.attachShader(quadProgram, compileShader(GLSLX_SOURCE_VERTEX, GL.VERTEX_SHADER));
    gl.attachShader(quadProgram, compileShader(GLSLX_SOURCE_FRAGMENT, GL.FRAGMENT_SHADER));
    gl.linkProgram(quadProgram);

    if (process.env.NODE_ENV === "development") {
        if (!gl.getProgramParameter(quadProgram, GL.LINK_STATUS)) {
            const error = gl.getProgramInfoLog(quadProgram);
            gl.deleteProgram(quadProgram);
            console.error(error);
        }
    }

// indicesBuffer
    createBuffer(GL.ELEMENT_ARRAY_BUFFER, new Uint8Array([0, 1, 2, 2, 1, 3]), GL.STATIC_DRAW);

// vertexBuffer
    createBuffer(GL.ARRAY_BUFFER, new Float32Array([0, 0, 0, 1, 1, 0, 1, 1]), GL.STATIC_DRAW);

// vertexLocation
    bindAttrib(GLSLX_NAME_G, 2, 0, 0, 0, GL.FLOAT, false);

// dynamicBuffer
    createBuffer(GL.ARRAY_BUFFER, floatView, GL.DYNAMIC_DRAW);

// anchorLocation
    bindAttrib(GLSLX_NAME_A, 2, byteSize, 1, 0, GL.FLOAT, false);
// scaleLocation
    bindAttrib(GLSLX_NAME_S, 2, byteSize, 1, 8, GL.FLOAT, false);
// rotationLocation
    bindAttrib(GLSLX_NAME_R, 1, byteSize, 1, 16, GL.FLOAT, false);
// translationLocation
    bindAttrib(GLSLX_NAME_T, 2, byteSize, 1, 20, GL.FLOAT, false);
// uvsLocation
    bindAttrib(GLSLX_NAME_U, 4, byteSize, 1, 28, GL.FLOAT, false);
// colorLocation
    bindAttrib(GLSLX_NAME_C, 4, byteSize, 1, 44, GL.UNSIGNED_BYTE, true);
// colorOffsetLocation
    bindAttrib(GLSLX_NAME_O, 4, byteSize, 1, 48, GL.UNSIGNED_BYTE, true);
}

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
    gl.uniformMatrix4fv(gl.getUniformLocation(quadProgram, GLSLX_NAME_M), false, [
        c * w, s * h, 0, 0,
        -s * w, c * h, 0, 0,
        0, 0, -1, 0,
        (posX * (1 - c) + posY * s) * w - 2 * x / width - 1,
        (posY * (1 - c) - posX * s) * h + 2 * y / height + 1,
        0, 1,
    ]);

    gl.uniform1i(gl.getUniformLocation(quadProgram, GLSLX_NAME_X), 0);
}

export const beginRender = () => {
    gl.enable(GL.BLEND);
    gl.blendFunc(GL.ONE, GL.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(quadProgram);
}

export const clear = (r: number, g: number, b: number, a: number) => {
    gl.clearColor(r, g, b, a);
    gl.clear(GL.COLOR_BUFFER_BIT);
}

export const beginRenderToTexture = (texture: Texture) => {
    beginRender();
    setupProjection(0, 0, 0, 1, 0, 1, texture.w_, -texture.h_);
    gl.bindFramebuffer(GL.FRAMEBUFFER, texture.fbo_);
    gl.viewport(0, 0, texture.w_, texture.h_);
}

export const beginRenderToMain = (x: number, y: number, px: number, py: number, angle: number, scale: number,
                                  w = gl.drawingBufferWidth,
                                  h = gl.drawingBufferHeight) => {
    beginRender();
    setupProjection(x, y, px, py, angle, scale, w, h);
    gl.bindFramebuffer(GL.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
}

export const flush = (_count = quadCount) => {
    if (_count) {
        gl.bindTexture(GL.TEXTURE_2D, quadTexture);
        gl.bufferSubData(GL.ARRAY_BUFFER, 0, floatView.subarray(0, _count * floatSize));
        instancedArrays.drawElementsInstancedANGLE(GL.TRIANGLES, 6, GL.UNSIGNED_BYTE, 0, _count);
        quadCount = 0;
    }
}

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
    floatView[i++] = x;
    floatView[i++] = y;
    floatView[i++] = texture.u0_;
    floatView[i++] = texture.v0_;
    floatView[i++] = texture.u1_;
    floatView[i++] = texture.v1_;
    uintView[i++] = (((alpha * 0xFF) << 24) | color) >>> 0;
    uintView[i++] = (((additive * 0xFF) << 24) | offset) >>> 0;
}
