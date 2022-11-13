export const SHADER_VERTEX = `
attribute vec2 a_location;
attribute vec2 a_anchor;
attribute vec2 a_translation;
attribute float a_rotation;
attribute float a_z;
attribute vec2 a_scale;
attribute vec4 a_uvs;
attribute vec4 a_colorMul;
attribute vec4 a_colorAdd;

uniform mat4 u_mvp;

varying vec2 v_texCoord;
varying vec4 v_colorMul;
varying vec3 v_colorAdd;

void main() {
    v_texCoord = a_uvs.xy + a_location * a_uvs.zw;
    v_colorMul = vec4(a_colorMul.bgr * a_colorMul.a, (1.0 - a_colorAdd.a) * a_colorMul.a);
    v_colorAdd = a_colorAdd.bgr;
    vec2 p = (a_location - a_anchor) * a_scale;
    float q = cos(a_rotation);
    float w = sin(a_rotation);
    p = vec2(p.x * q - p.y * w, p.x * w + p.y * q);
    p += a_anchor + a_translation;
    gl_Position = u_mvp * vec4(p, a_z, 1.0);
}
`;

export const SHADER_FRAGMENT = `
precision mediump float;

uniform sampler2D u_tex0;

varying vec2 v_texCoord;
varying vec4 v_colorMul;
varying vec3 v_colorAdd;

void main() {
    vec4 color = v_colorMul * texture2D(u_tex0, v_texCoord);
    gl_FragColor = color + vec4(v_colorAdd * color.a, 0.0);
}
`;

export const SHADER_A_ROTATION = "a_rotation";
export const SHADER_A_Z = "a_z";
export const SHADER_A_LOCATION = "a_location";
export const SHADER_A_ANCHOR = "a_anchor";
export const SHADER_A_COLOR_MUL = "a_colorMul";
export const SHADER_A_SCALE = "a_scale";
export const SHADER_A_UVS = "a_uvs";
export const SHADER_A_COLOR_ADD = "a_colorAdd";
export const SHADER_A_TRANSLATION = "a_translation";

export const SHADER_U_TEX = "u_tex0";
export const SHADER_U_MVP = "u_mvp";
