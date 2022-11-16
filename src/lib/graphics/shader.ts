export const SHADER_VERTEX = `
attribute vec3 a_position;
attribute vec2 a_texCoord;
attribute vec4 a_colorMul;
attribute vec4 a_colorAdd;

uniform mat4 u_mvp;

varying vec2 v_texCoord;
varying vec4 v_colorMul;
varying vec3 v_colorAdd;

void main() {
    v_texCoord = a_texCoord;
    v_colorMul = vec4(a_colorMul.bgr * a_colorMul.a, (1.0 - a_colorAdd.a) * a_colorMul.a);
    v_colorAdd = a_colorAdd.bgr;
    gl_Position = u_mvp * vec4(a_position, 1.0);
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

export const SHADER_A_POSITION = "a_position";
export const SHADER_A_TEX_COORD = "a_texCoord";
export const SHADER_A_COLOR_MUL = "a_colorMul";
export const SHADER_A_COLOR_ADD = "a_colorAdd";

export const SHADER_U_TEX = "u_tex0";
export const SHADER_U_MVP = "u_mvp";
