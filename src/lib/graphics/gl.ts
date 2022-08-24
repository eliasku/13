export const enum GL {
    NONE = 0,

    BLEND = 0x0BE2,
    DEPTH_TEST = 0x0B71,
    DITHER = 0x0BD0,

    POINTS = 0x0000,
    LINES = 0x0001,
    LINE_LOOP = 0x0002,
    LINE_STRIP = 0x0003,
    TRIANGLES = 0x0004,
    TRIANGLE_STRIP = 0x0005,
    TRIANGLE_FAN = 0x0006,

    DEPTH_BUFFER_BIT = 0x00000100,
    STENCIL_BUFFER_BIT = 0x00000400,
    COLOR_BUFFER_BIT = 0x00004000,

    NO_ERROR = 0,
    COLOR_ATTACHMENT0 = 0x8CE0,
    DEPTH_ATTACHMENT = 0x8D00,
    STENCIL_ATTACHMENT = 0x8D20,
    DEPTH_STENCIL_ATTACHMENT = 0x821A,
    FRAMEBUFFER_COMPLETE = 0x8CD5,

    BYTE = 0x1400,
    UNSIGNED_BYTE = 0x1401,
    SHORT = 0x1402,
    UNSIGNED_SHORT = 0x1403,
    INT = 0x1404,
    UNSIGNED_INT = 0x1405,
    FLOAT = 0x1406,
    HALF_FLOAT = 0x140B,

    TEXTURE_2D = 0x0DE1,
    TEXTURE_MAG_FILTER = 0x2800,
    TEXTURE_MIN_FILTER = 0x2801,
    TEXTURE_WRAP_S = 0x2802,
    TEXTURE_WRAP_T = 0x2803,
    NEAREST = 0x2600,
    LINEAR = 0x2601,
    REPEAT = 0x2901,
    CLAMP_TO_EDGE = 0x812F,
    FRAGMENT_SHADER = 0x8B30,
    VERTEX_SHADER = 0x8B31,
    COMPILE_STATUS = 0x8B81,
    LINK_STATUS = 0x8B82,
    ACTIVE_UNIFORMS = 0x8B86,

    RED = 0x1903,
    RGB = 0x1907,
    RGBA = 0x1908,
    RGBA8 = 0x8058,
    RGBA16F = 0x881A,
    R8 = 0x8229,

    TEXTURE0 = 0x84C0,

    FRAMEBUFFER = 0x8D40,

    STREAM_DRAW = 0x88E0,
    STATIC_DRAW = 0x88E4,
    DYNAMIC_DRAW = 0x88E8,
    ARRAY_BUFFER = 0x8892,
    ELEMENT_ARRAY_BUFFER = 0x8893,
    BUFFER_SIZE = 0x8764,
    BUFFER_USAGE = 0x8765,


    // blend
    ZERO = 0,
    ONE = 1,
    SRC_COLOR = 0x0300,
    ONE_MINUS_SRC_COLOR = 0x0301,
    SRC_ALPHA = 0x0302,
    ONE_MINUS_SRC_ALPHA = 0x0303,
    DST_ALPHA = 0x0304,
    ONE_MINUS_DST_ALPHA = 0x0305,
    DST_COLOR = 0x0306,
    ONE_MINUS_DST_COLOR = 0x0307,
    SRC_ALPHA_SATURATE = 0x0308,
    CONSTANT_COLOR = 0x8001,
    ONE_MINUS_CONSTANT_COLOR = 0x8002,
    CONSTANT_ALPHA = 0x8003,
    ONE_MINUS_CONSTANT_ALPHA = 0x8004,

    // cmp
    NEVER = 0x0200,
    LESS = 0x0201,
    EQUAL = 0x0202,
    LEQUAL = 0x0203,
    GREATER = 0x0204,
    NOTEQUAL = 0x0205,
    GEQUAL = 0x0206,
    ALWAYS = 0x0207,


    UNPACK_PREMULTIPLY_ALPHA_WEBGL = 0x9241,
}

export let gl: WebGL2RenderingContext = null as WebGL2RenderingContext;

export function initGL(canvas: HTMLCanvasElement) {
    const params: WebGLContextAttributes = {
        alpha: false,
        depth: false,
        stencil: false,
        antialias: false
    };
    gl = canvas.getContext("webgl2", params);
    if (!gl) {
        alert("WebGL 2 is required");
    }
    gl.pixelStorei(GL.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
    // const fp16 = gl.getExtension('EXT_color_buffer_half_float');
    // const fp32 = gl.getExtension('EXT_color_buffer_float');
    // if (!fp16 && !fp32) {
    //     logDoc("😵 <b>EXT_color_buffer_half_float</b> or <b>EXT_color_buffer_float</b> is required");
    // }

    // const linearFiltering = gl.getExtension('OES_texture_half_float_linear');
    // if (!linearFiltering) {
    //     logToDocument("😵‍💫 <b>OES_texture_half_float_linear</b> is required");
    //     return null;
    // }
}

export interface TextureObject {
    texture_: WebGLTexture;
    width_: number;
    height_: number;

    attach_(id: number): number;
}

export function createTextureDefer(url: string): TextureObject {
    const texture = gl.createTexture()!;
    gl.bindTexture(GL.TEXTURE_2D, texture);
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR);
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.LINEAR);
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.REPEAT);
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.REPEAT);
    gl.texImage2D(GL.TEXTURE_2D, 0, GL.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255]));

    let obj: TextureObject = {
        texture_: texture,
        width_: 1,
        height_: 1,
        attach_(id: number) {
            gl.activeTexture(GL.TEXTURE0 + id);
            gl.bindTexture(GL.TEXTURE_2D, texture);
            return id;
        }
    };

    let image = new Image();
    image.onload = () => {
        obj.width_ = image.width;
        obj.height_ = image.height;
        gl.bindTexture(GL.TEXTURE_2D, texture);
        gl.texImage2D(GL.TEXTURE_2D, 0, GL.RGB, GL.RGB, GL.UNSIGNED_BYTE, image);
    };
    image.src = url;

    return obj;
}

type UniformMap = { [key: string]: WebGLUniformLocation | null };

function createShader(type: GLenum, code: string) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, code);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, GL.COMPILE_STATUS)) {
        console.warn(gl.getShaderInfoLog(shader));
    }
    return shader;
}

function createProgram(vertexShader: string, fragmentShader: string) {
    const program = gl.createProgram()!;
    const vs = createShader(GL.VERTEX_SHADER, vertexShader)!;
    const fs = createShader(GL.FRAGMENT_SHADER, fragmentShader)!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, GL.LINK_STATUS)) {
        console.warn(gl.getProgramInfoLog(program));
    }
    return program;
}

function getUniforms(program: WebGLProgram): UniformMap {
    let uniforms: UniformMap = {};
    let uniformCount = gl.getProgramParameter(program, GL.ACTIVE_UNIFORMS);
    for (let i = 0; i < uniformCount; i++) {
        let uniformName = gl.getActiveUniform(program, i)?.name;
        if (uniformName) {
            uniforms[uniformName] = gl.getUniformLocation(program, uniformName);
        }
    }
    return uniforms;
}

export class Program {
    uniforms_: UniformMap;
    program_: WebGLProgram;

    constructor(vertexShader: string,
                fragmentShader: string) {
        this.program_ = createProgram(vertexShader, fragmentShader);
        this.uniforms_ = getUniforms(this.program_);
    }

    bind_() {
        gl.useProgram(this.program_);
    }
}

export class Fbo {
    texture_: WebGLTexture;
    fbo_: WebGLFramebuffer;
    texelSizeX_: number;
    texelSizeY_: number;

    constructor(readonly width_: number,
                readonly height_: number,
                internalFormat: GLenum,
                format: GLenum,
                type: GLenum,
                param: GLint) {
        gl.activeTexture(GL.TEXTURE0);

        this.texture_ = gl.createTexture()!;
        gl.bindTexture(GL.TEXTURE_2D, this.texture_);
        gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, param);
        gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, param);
        gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
        gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE);
        let err = gl.getError();
        gl.texImage2D(GL.TEXTURE_2D, 0, internalFormat, width_, height_, 0, format, type, null);
        err = gl.getError();
        if (err !== GL.NO_ERROR) {
            console.error(gl);
        }
        this.fbo_ = gl.createFramebuffer()!;
        gl.bindFramebuffer(GL.FRAMEBUFFER, this.fbo_);
        gl.framebufferTexture2D(GL.FRAMEBUFFER, GL.COLOR_ATTACHMENT0, GL.TEXTURE_2D, this.texture_, 0);
        gl.viewport(0, 0, width_, height_);
        gl.clear(GL.COLOR_BUFFER_BIT);

        this.texelSizeX_ = 1.0 / width_;
        this.texelSizeY_ = 1.0 / height_;
    }

    attach_(id: GLint): GLint {
        gl.activeTexture(GL.TEXTURE0 + id);
        gl.bindTexture(GL.TEXTURE_2D, this.texture_);
        return id;
    }
}

export class DoubleFbo {
    fbo1_: Fbo;
    fbo2_: Fbo;
    texelSizeX_: number;
    texelSizeY_: number;

    constructor(readonly width_: number,
                readonly height_: number,
                internalFormat: GLenum,
                format: GLenum,
                type: GLenum,
                param: GLint) {
        this.fbo1_ = new Fbo(width_, height_, internalFormat, format, type, param);
        this.fbo2_ = new Fbo(width_, height_, internalFormat, format, type, param);

        this.texelSizeX_ = 1.0 / width_;
        this.texelSizeY_ = 1.0 / height_;
    }

    get read_(): Fbo {
        return this.fbo1_;
    }

    set read_(value) {
        this.fbo1_ = value;
    }

    get write_(): Fbo {
        return this.fbo2_;
    }

    set write_(value) {
        this.fbo2_ = value;
    }

    swap_() {
        const temp = this.fbo1_;
        this.fbo1_ = this.fbo2_;
        this.fbo2_ = temp;
    }
}
