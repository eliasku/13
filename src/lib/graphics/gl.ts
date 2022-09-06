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

export const gl: WebGLRenderingContext & {
    $?: ANGLE_instanced_arrays;
} = c.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
});
gl.$ = gl.getExtension('ANGLE_instanced_arrays')!;

if (process.env.NODE_ENV === "development") {
    if (!gl?.$) {
        alert("WebGL is required");
    }
}

gl.pixelStorei(GL.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);

onresize = () => {
    const w = innerWidth;
    const h = innerHeight;
    const s = devicePixelRatio;
    c.style.width = w + "px";
    c.style.height = h + "px";
    c.width = w * s;
    c.height = h * s;
};

(onresize as any)();
