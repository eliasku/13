import {GL, gl, gl_instanced_arrays} from "./gl";

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
export const GLSLX_SOURCE_VERTEX = "attribute float b;attribute vec2 e,f,o,j;attribute vec4 k,g,l;uniform mat4 p;varying vec2 c;varying vec4 d;varying vec3 h;void main(){c=k.xy+e*k.zw,d=vec4(g.bgr*g.a,(1.-l.a)*g.a),h=l.bgr;vec2 a=(e-f)*j;float i=cos(b),m=sin(b);a=vec2(a.x*i-a.y*m,a.x*m+a.y*i),a+=f+o,gl_Position=p*vec4(a,0,1);}"
// still need to add `precision mediump float;` manually
export const GLSLX_SOURCE_FRAGMENT = "precision mediump float;uniform sampler2D n;varying vec2 c;varying vec4 d;varying vec3 h;void main(){vec4 a=d*texture2D(n,c);gl_FragColor=a+vec4(h*a.a,0.);}"

export const GLSLX_NAME_R = "b"
export const GLSLX_NAME_G = "e"
export const GLSLX_NAME_A = "f"
export const GLSLX_NAME_C = "g"
export const GLSLX_NAME_S = "j"
export const GLSLX_NAME_U = "k"
export const GLSLX_NAME_O = "l"
export const GLSLX_NAME_X = "n"
export const GLSLX_NAME_T = "o"
export const GLSLX_NAME_M = "p"

const maxBatch = 65535;
// const depth = 1e5;
// const depth = 1;
let count = 0;
let currentTexture: WebGLTexture = null;

const compileShader = (source: string, type: GLenum): WebGLShader => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (process.env.NODE_ENV === "development") {
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
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

const bindAttrib = (name: string, size: number, stride: number, divisor: number, offset: number, type: GLenum, norm: boolean) => {
    const location = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, type, norm, stride, offset);
    if (divisor) {
        gl_instanced_arrays.vertexAttribDivisorANGLE(location, divisor);
    }
}

const floatSize = 2 + 2 + 1 + 2 + 4 + 1 + 1 + 1;
const byteSize = floatSize * 4;
// maxBatch * byteSize
// const arrayBuffer = new ArrayBuffer(1 << 22/* maxBatch * byteSize */);
const floatView = new Float32Array(1 << 20);
const uintView = new Uint32Array(floatView.buffer);
let program: WebGLProgram | null = null;
let matrixLocation: WebGLUniformLocation = null;
let textureLocation: WebGLUniformLocation = null;

const getUniformLocation = (name: string): WebGLUniformLocation | null => {
    return gl.getUniformLocation(program, name);
}

// export const initDraw2d = () => {
    program = gl.createProgram();

    gl.attachShader(program, compileShader(GLSLX_SOURCE_VERTEX, GL.VERTEX_SHADER));
    gl.attachShader(program, compileShader(GLSLX_SOURCE_FRAGMENT, GL.FRAGMENT_SHADER));
    gl.linkProgram(program);

    if (process.env.NODE_ENV === "development") {
        if (!gl.getProgramParameter(program, GL.LINK_STATUS)) {
            const error = gl.getProgramInfoLog(program);
            gl.deleteProgram(program);
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

    matrixLocation = getUniformLocation(GLSLX_NAME_M);
    textureLocation = getUniformLocation(GLSLX_NAME_X);

export interface Camera {
    atX_: number;
    atY_: number;
    toX_: number;
    toY_: number;
    angle_: number;
    scale_: number;
}

export let camera: Camera = {
    atX_: 0,
    atY_: 0,
    toX_: 0,
    toY_: 0,
    angle_: 0,
    scale_: 1,
};

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
}

export const getSubTexture = (src: Texture, x: number, y: number, w: number, h: number, ax: number, ay: number): Texture => {
    return {
        texture_: src.texture_,
        w_: w, h_: h,
        x_: ax,
        y_: ay,
        u0_: x / src.w_,
        v0_: y / src.h_,
        u1_: w / src.w_,
        v1_: h / src.h_,
    };
}

export const createTexture = (size: number): Texture => {
    return {
        texture_: gl.createTexture(),
        w_: size,
        h_: size,
        x_: 0,
        y_: 0,
        u0_: 0,
        v0_: 0,
        u1_: 1,
        v1_: 1
    };
}

export const uploadTexture = (glTexture: WebGLTexture, source: TexImageSource): void => {
    gl.bindTexture(GL.TEXTURE_2D, glTexture);
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.NEAREST);
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.NEAREST);
    gl.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA, GL.RGBA, GL.UNSIGNED_BYTE, source);
}

export const beginRender = (
    width: number = gl.drawingBufferWidth,
    height: number = gl.drawingBufferHeight
) => {
    const {atX_, atY_, toX_, toY_, angle_, scale_} = camera;

    const x = atX_ - width * toX_;
    const y = atY_ - height * toY_;

    const c = scale_ * Math.cos(angle_);
    const s = scale_ * Math.sin(angle_);

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

    const projection = [
        c * w, s * h, 0, 0,
        -s * w, c * h, 0, 0,
        0, 0, -1/* / depth*/, 0,

        (atX_ * (1 - c) + atY_ * s) * w - 2 * x / width - 1,
        (atY_ * (1 - c) - atX_ * s) * h + 2 * y / height + 1,
        0, 1,
    ];

    gl.enable(GL.BLEND);
    gl.blendFunc(GL.ONE, GL.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(program);
    gl.uniformMatrix4fv(matrixLocation, false, projection);
    gl.viewport(0, 0, width, Math.abs(height));
}

export const flush = () => {
    if (count) {
        gl.bindTexture(GL.TEXTURE_2D, currentTexture);
        gl.uniform1i(textureLocation, 0);
        gl.bufferSubData(GL.ARRAY_BUFFER, 0, floatView.subarray(0, count * floatSize));
        gl_instanced_arrays.drawElementsInstancedANGLE(GL.TRIANGLES, 6, GL.UNSIGNED_BYTE, 0, count);
        count = 0;
    }
}

export const draw = (texture: Texture, x: number, y: number, r: number, sx: number, sy: number, alpha?: number, color?: number, additive?: number, offset?: number) => {
    if (currentTexture !== texture.texture_ || count === maxBatch) {
        flush();
        currentTexture = texture.texture_;
    }

    let i = count * floatSize;

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
    uintView[i++] = ((((alpha ?? 1) * 0xFF) << 24) | ((color ?? 0xFFFFFF) & 0xFFFFFF)) >>> 0;
    uintView[i++] = (((additive * 0xFF) << 24) | (offset & 0xFFFFFF)) >>> 0;

    count++;
}
