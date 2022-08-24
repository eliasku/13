import {gl, GL} from "./gl";

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
let currentTexture: Texture | null = null;

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
        //ext.vertexAttribDivisorANGLE(location, divisor);
        gl.vertexAttribDivisor(location, divisor);
    }
}

const floatSize = 2 + 2 + 1 + 2 + 4 + 1 + 1 + 1;
const byteSize = floatSize * 4;
const arrayBuffer = new ArrayBuffer(maxBatch * byteSize);
const floatView = new Float32Array(arrayBuffer);
const uintView = new Uint32Array(arrayBuffer);
// let ext: ANGLE_instanced_arrays | null = null;
let program: WebGLProgram | null = null;
let matrixLocation: WebGLUniformLocation = null;
let textureLocation: WebGLUniformLocation = null;

let scale = 1.0;
let width: number = 1;
let height: number = 1;

function getUniformLocation(name: string): WebGLUniformLocation | null {
    return gl.getUniformLocation(program, name);
}

export function initDraw2d() {
    //ext = gl.getExtension('ANGLE_instanced_arrays');
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
    bindAttrib('g', 2, 0, 0, 0, GL.FLOAT, false);

    // dynamicBuffer
    createBuffer(GL.ARRAY_BUFFER, arrayBuffer, GL.DYNAMIC_DRAW);

    // anchorLocation
    bindAttrib('a', 2, byteSize, 1, 0, GL.FLOAT, false);
    // scaleLocation
    bindAttrib('s', 2, byteSize, 1, 8, GL.FLOAT, false);
    // rotationLocation
    bindAttrib('r', 1, byteSize, 1, 16, GL.FLOAT, false);
    // translationLocation
    bindAttrib('t', 2, byteSize, 1, 20, GL.FLOAT, false);
    // uvsLocation
    bindAttrib('u', 4, byteSize, 1, 28, GL.FLOAT, false);
    // colorLocation
    bindAttrib('c', 4, byteSize, 1, 44, GL.UNSIGNED_BYTE, true);
    // colorOffsetLocation
    bindAttrib('o', 4, byteSize, 1, 48, GL.UNSIGNED_BYTE, true);

    matrixLocation = getUniformLocation('m');
    textureLocation = getUniformLocation('x');
}

function begin(w: number, h: number) {
    width = w;
    height = h;
}

function clear(r: number, g: number, b: number, a: number) {
    gl.clearColor(r, g, b, a);
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
    w: number;
    h: number;
    // anchor
    x: number;
    y: number;
    // uv rect
    u: number;
    v: number;
    u2: number;
    v2: number;

    t: WebGLTexture;
}

export function getSubTexture(src: Texture, x: number, y: number, w: number, h: number, anchorX?: number, anchorY?: number): Texture {
    return {
        w, h,
        x: anchorX || src.x,
        y: anchorY || src.y,
        u: x / src.w,
        v: y / src.h,
        u2: w / src.w,
        v2: h / src.h,
        t: src.t
    };
}

export function createTexture(source: TexImageSource): Texture {
    const w = source.width;
    const h = source.height;
    const t = gl.createTexture();

    gl.bindTexture(GL.TEXTURE_2D, t);
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.NEAREST);
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.NEAREST);
    gl.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA, GL.RGBA, GL.UNSIGNED_BYTE, source);

    return {
        w,
        h,
        x: 0,
        y: 0,
        u: 0,
        v: 0,
        u2: 1,
        v2: 1,
        t,
    };
}

export function beginRender(viewportWidth: number, viewportHeight: number) {
    width = viewportWidth;
    height = viewportHeight;

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

    gl.useProgram(program);
    gl.enable(GL.BLEND);
    gl.uniformMatrix4fv(matrixLocation, false, projection);
    gl.viewport(0, 0, width, height);
}

export function beginRenderGroup() {
}

export function flush() {
    if (!count) return;

    gl.enable(GL.BLEND);
    gl.blendFunc(GL.ONE, GL.ONE_MINUS_SRC_ALPHA);

    gl.bindTexture(GL.TEXTURE_2D, currentTexture.t);
    gl.uniform1i(textureLocation, 0);

    gl.bufferSubData(GL.ARRAY_BUFFER, 0, floatView.subarray(0, count * floatSize));
    //ext.drawElementsInstancedANGLE(GL.TRIANGLES, 6, GL.UNSIGNED_BYTE, 0, count);
    gl.drawElementsInstanced(GL.TRIANGLES, 6, GL.UNSIGNED_BYTE, 0, count);
    count = 0;
}

export function draw(texture: Texture, x: number, y: number, r: number, sx: number, sy: number, color: number, offset?: number) {
    if (count === maxBatch) {
        flush();
    }

    if (!currentTexture) {
        currentTexture = texture;
    } else if (currentTexture.t !== texture.t) {
        flush();
        currentTexture = texture;
    }

    let i = count * floatSize;

    floatView[i++] = texture.x;
    floatView[i++] = texture.y;
    floatView[i++] = sx * texture.w;
    floatView[i++] = sy * texture.h;
    floatView[i++] = r;
    floatView[i++] = x;
    floatView[i++] = y;
    floatView[i++] = texture.u;
    floatView[i++] = texture.v;
    floatView[i++] = texture.u2;
    floatView[i++] = texture.v2;
    uintView[i++] = color >>> 0;
    uintView[i++] = offset >>> 0;

    count++;
}
