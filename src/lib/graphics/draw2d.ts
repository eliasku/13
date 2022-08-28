import {gl, GL, gl_instanced_arrays} from "./gl";

const vertexShader = `attribute vec2 g;
attribute vec2 a;
attribute vec2 t;
attribute float r;
attribute vec2 s;
attribute vec4 u;
attribute vec4 c;
attribute vec4 o;
uniform mat4 m;
varying vec2 v;
varying vec4 i;
varying vec3 j;
void main(){
v=u.xy+g*u.zw;
i=vec4(c.bgr*c.a,(1.0-o.a)*c.a);
j=o.xyz;
vec2 p=(g-a)*s;
float q=cos(r);
float w=sin(r);
p=vec2(p.x*q-p.y*w,p.x*w+p.y*q);
p+=a+t;
gl_Position=m*vec4(p,0,1);}`;

const fragmentShader = `precision mediump float;
uniform sampler2D x;
varying vec2 v;
varying vec4 i;
varying vec3 j;
void main(){
vec4 c=i*texture2D(x,v);
gl_FragColor=c+vec4(j*c.a,0.0);
}`;

const maxBatch = 65535;
const depth = 1e5;
let count = 0;
let currentTexture: WebGLTexture = null;

function compileShader(source: string, type: GLenum): WebGLShader {
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

function createBuffer(type: GLenum, src: ArrayBufferLike, usage: GLenum) {
    gl.bindBuffer(type, gl.createBuffer());
    gl.bufferData(type, src, usage);
}

function bindAttrib(name: string, size: number, stride: number, divisor: number, offset: number, type: GLenum, norm: boolean) {
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
const arrayBuffer = new ArrayBuffer(1 << 22/* maxBatch * byteSize */);
const floatView = new Float32Array(arrayBuffer);
const uintView = new Uint32Array(arrayBuffer);
let program: WebGLProgram | null = null;
let matrixLocation: WebGLUniformLocation = null;
let textureLocation: WebGLUniformLocation = null;

function getUniformLocation(name: string): WebGLUniformLocation | null {
    return gl.getUniformLocation(program, name);
}

export function initDraw2d() {
    program = gl.createProgram();

    gl.attachShader(program, compileShader(vertexShader, GL.VERTEX_SHADER));
    gl.attachShader(program, compileShader(fragmentShader, GL.FRAGMENT_SHADER));
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
    bindAttrib("g", 2, 0, 0, 0, GL.FLOAT, false);

    // dynamicBuffer
    createBuffer(GL.ARRAY_BUFFER, arrayBuffer, GL.DYNAMIC_DRAW);

    // anchorLocation
    bindAttrib("a", 2, byteSize, 1, 0, GL.FLOAT, false);
    // scaleLocation
    bindAttrib("s", 2, byteSize, 1, 8, GL.FLOAT, false);
    // rotationLocation
    bindAttrib("r", 1, byteSize, 1, 16, GL.FLOAT, false);
    // translationLocation
    bindAttrib("t", 2, byteSize, 1, 20, GL.FLOAT, false);
    // uvsLocation
    bindAttrib("u", 4, byteSize, 1, 28, GL.FLOAT, false);
    // colorLocation
    bindAttrib("c", 4, byteSize, 1, 44, GL.UNSIGNED_BYTE, true);
    // colorOffsetLocation
    bindAttrib("o", 4, byteSize, 1, 48, GL.UNSIGNED_BYTE, true);

    matrixLocation = getUniformLocation("m");
    textureLocation = getUniformLocation("x");
}

interface Camera {
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
    i?: WebGLTexture;
    w: number;
    h: number;
    // anchor
    x: number;
    y: number;
    // uv rect (stpq)
    s: number;
    t: number;
    p: number;
    q: number;
}

export function getSubTexture(src: Texture, x: number, y: number, w: number, h: number, ax: number, ay: number): Texture {
    return {
        i: src.i,
        w, h,
        x: ax,
        y: ay,
        s: x / src.w,
        t: y / src.h,
        p: w / src.w,
        q: h / src.h,
    };
}

export function createTexture(size: number): Texture {
    return {
        i: gl.createTexture(),
        w: size,
        h: size,
        x: 0,
        y: 0,
        s: 0,
        t: 0,
        p: 1,
        q: 1
    };
}

export function uploadTexture(texture: Texture, source: TexImageSource): void {
    gl.bindTexture(GL.TEXTURE_2D, texture.i);
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.NEAREST);
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.NEAREST);
    gl.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA, GL.RGBA, GL.UNSIGNED_BYTE, source);
}

export function beginRender(width: number, height: number) {
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
        0, 0, -1 / depth, 0,

        (atX_ * (1 - c) + atY_ * s) * w - 2 * x / width - 1,
        (atY_ * (1 - c) - atX_ * s) * h + 2 * y / height + 1,
        0, 1,
    ];

    gl.enable(GL.BLEND);
    gl.blendFunc(GL.ONE, GL.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(program);
    gl.uniformMatrix4fv(matrixLocation, false, projection);
    gl.viewport(0, 0, width, height);
}

export function flush() {
    if (count) {
        gl.bindTexture(GL.TEXTURE_2D, currentTexture);
        gl.uniform1i(textureLocation, 0);
        gl.bufferSubData(GL.ARRAY_BUFFER, 0, floatView.subarray(0, count * floatSize));
        gl_instanced_arrays.drawElementsInstancedANGLE(GL.TRIANGLES, 6, GL.UNSIGNED_BYTE, 0, count);
        count = 0;
    }
}

export function draw(texture: Texture, x: number, y: number, r: number, sx: number, sy: number, alpha?: number, color?: number, additive?: number, offset?: number) {
    if (currentTexture !== texture.i || count === maxBatch) {
        flush();
        currentTexture = texture.i;
    }

    let i = count * floatSize;

    floatView[i++] = texture.x;
    floatView[i++] = texture.y;
    floatView[i++] = sx * texture.w;
    floatView[i++] = sy * texture.h;
    floatView[i++] = r;
    floatView[i++] = x;
    floatView[i++] = y;
    floatView[i++] = texture.s;
    floatView[i++] = texture.t;
    floatView[i++] = texture.p;
    floatView[i++] = texture.q;
    uintView[i++] = ((((alpha ?? 1) * 0xFF) << 24) | ((color ?? 0xFFFFFF) & 0xFFFFFF)) >>> 0;
    uintView[i++] = (((additive * 0xFF) << 24) | (offset & 0xFFFFFF)) >>> 0;

    count++;
}
