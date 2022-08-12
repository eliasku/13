import {logDoc} from "../debug/log";

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
        logDoc("💀 <b>WebGL 2</b> is required");
    }
    const ext = gl.getExtension('EXT_color_buffer_float');
    if (!ext) {
        logDoc("😵 <b>EXT_color_buffer_float</b> is required");
    }
    // const linearFiltering = gl.getExtension('OES_texture_half_float_linear');
    // if (!linearFiltering) {
    //     logToDocument("😵‍💫 <b>OES_texture_half_float_linear</b> is required");
    //     return null;
    // }
}

export interface TextureObject {
    texture: WebGLTexture;
    width: number;
    height: number;

    attach(id: number): number;
}

export function createTextureDefer(url: string): TextureObject {
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255]));

    let obj: TextureObject = {
        texture,
        width: 1,
        height: 1,
        attach(id: number) {
            gl.activeTexture(gl.TEXTURE0 + id);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            return id;
        }
    };

    let image = new Image();
    image.onload = () => {
        obj.width = image.width;
        obj.height = image.height;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
    };
    image.src = url;

    return obj;
}


type UniformMap = { [key: string]: WebGLUniformLocation | null };

function createShader(type: GLenum, code: string) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, code);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn(gl.getShaderInfoLog(shader));
    }
    return shader;
}

function createProgram(vertexShader: string, fragmentShader: string) {
    const program = gl.createProgram()!;
    const vs = createShader(gl.VERTEX_SHADER, vertexShader)!;
    const fs = createShader(gl.FRAGMENT_SHADER, fragmentShader)!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.warn(gl.getProgramInfoLog(program));
    }
    return program;
}

function getUniforms(program: WebGLProgram): UniformMap {
    let uniforms: UniformMap = {};
    let uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < uniformCount; i++) {
        let uniformName = gl.getActiveUniform(program, i)?.name;
        if (uniformName) {
            uniforms[uniformName] = gl.getUniformLocation(program, uniformName);
        }
    }
    return uniforms;
}

export class Program {
    uniforms: UniformMap;
    program: WebGLProgram;

    constructor(vertexShader: string,
                fragmentShader: string) {
        this.program = createProgram(vertexShader, fragmentShader);
        this.uniforms = getUniforms(this.program);
    }

    bind() {
        gl.useProgram(this.program);
    }
}

export class Fbo {
    texture: WebGLTexture;
    fbo: WebGLFramebuffer;
    texelSizeX: number;
    texelSizeY: number;

    constructor(readonly width: number,
                readonly height: number,
                internalFormat: GLenum,
                format: GLenum,
                type: GLenum,
                param: GLint) {
        gl.activeTexture(gl.TEXTURE0);

        this.texture = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        let err = gl.getError();
        gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, null);
        err = gl.getError();
        if (err !== gl.NO_ERROR) {
            console.error(gl);
        }
        this.fbo = gl.createFramebuffer()!;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
        gl.viewport(0, 0, width, height);
        gl.clear(gl.COLOR_BUFFER_BIT);

        this.texelSizeX = 1.0 / width;
        this.texelSizeY = 1.0 / height;
    }

    attach(id: GLint): GLint {
        gl.activeTexture(gl.TEXTURE0 + id);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        return id;
    }
}

export class DoubleFbo {
    fbo1: Fbo;
    fbo2: Fbo;
    texelSizeX: number;
    texelSizeY: number;

    constructor(readonly width: number,
                readonly height: number,
                internalFormat: GLenum,
                format: GLenum,
                type: GLenum,
                param: GLint) {
        this.fbo1 = new Fbo(width, height, internalFormat, format, type, param);
        this.fbo2 = new Fbo(width, height, internalFormat, format, type, param);

        this.texelSizeX = 1.0 / width;
        this.texelSizeY = 1.0 / height;
    }

    get read(): Fbo {
        return this.fbo1;
    }

    set read(value) {
        this.fbo1 = value;
    }

    get write(): Fbo {
        return this.fbo2;
    }

    set write(value) {
        this.fbo2 = value;
    }

    swap() {
        const temp = this.fbo1;
        this.fbo1 = this.fbo2;
        this.fbo2 = temp;
    }
}
