
export const baseVertexShaderCode = `
precision highp float;
attribute vec2 aPosition;
varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;
uniform vec2 texelSize;
void main () {
    vUv = aPosition * 0.5 + 0.5;
    vL = vUv - vec2(texelSize.x, 0.0);
    vR = vUv + vec2(texelSize.x, 0.0);
    vT = vUv + vec2(0.0, texelSize.y);
    vB = vUv - vec2(0.0, texelSize.y);
    gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const splatShaderCode = `
precision highp float;
precision highp sampler2D;
varying vec2 vUv;
uniform sampler2D uTarget;
uniform float aspectRatio;
uniform vec3 color;
uniform vec2 point;
uniform float radius;
void main () {
    vec2 p = vUv - point.xy;
    p.x *= aspectRatio;
    float a = exp(-dot(p, p) / radius);
    //vec3 r = a * color.xyz + (1.0 - a) * texture2D(uTarget, vUv).xyz;
    vec3 dest = texture2D(uTarget, vUv).xyz;
    //vec3 r = a * color.xyz + (1.0 - a) * dest;
    vec3 r = a * color.xyz + dest;
    gl_FragColor = vec4(r, 1.0);
}
`;

export const curlShaderCode = `
precision mediump float;
precision mediump sampler2D;
varying highp vec2 vUv;
varying highp vec2 vL;
varying highp vec2 vR;
varying highp vec2 vT;
varying highp vec2 vB;
uniform sampler2D uVelocity;
void main () {
    float L = texture2D(uVelocity, vL).y;
    float R = texture2D(uVelocity, vR).y;
    float T = texture2D(uVelocity, vT).x;
    float B = texture2D(uVelocity, vB).x;
    float vorticity = R - L - T + B;
    gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
}
`;

export const vorticityShaderCode = `
precision highp float;
precision highp sampler2D;
varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform float curl;
uniform float dt;
void main () {
    float L = texture2D(uCurl, vL).x;
    float R = texture2D(uCurl, vR).x;
    float T = texture2D(uCurl, vT).x;
    float B = texture2D(uCurl, vB).x;
    float C = texture2D(uCurl, vUv).x;
    vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
    force /= length(force) + 0.0001;
    force *= curl * C;
    force.y *= -1.0;
    vec2 velocity = texture2D(uVelocity, vUv).xy;
    velocity += force * dt;
    velocity = min(max(velocity, -1000.0), 1000.0);
    gl_FragColor = vec4(velocity, 0.0, 1.0);
}
`;

export const displayShaderCode = `
precision highp float;
precision highp sampler2D;
varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;
uniform sampler2D uTexture;
uniform sampler2D uBloom;
uniform sampler2D uSunrays;
uniform sampler2D uDithering;
uniform sampler2D uObstacleC;
uniform float uShadingK;
uniform vec2 ditherScale;
uniform vec2 texelSize;
vec3 linearToGamma (vec3 color) {
    color = max(color, vec3(0));
    return max(1.055 * pow(color, vec3(0.416666667)) - 0.055, vec3(0));
}
void main () {
    vec3 c = texture2D(uTexture, vUv).rgb;
    vec3 lc = texture2D(uTexture, vL).rgb;
    vec3 rc = texture2D(uTexture, vR).rgb;
    vec3 tc = texture2D(uTexture, vT).rgb;
    vec3 bc = texture2D(uTexture, vB).rgb;
    float dx = length(rc) - length(lc);
    float dy = length(tc) - length(bc);
    vec3 n = normalize(vec3(dx, dy, length(texelSize)));
    vec3 l = vec3(0.0, 0.0, 1.0);
    float diffuse = clamp(dot(n, l) + 0.7, 0.7, 1.0);
    c *= mix(1.0, diffuse, uShadingK);
    //c = mix(c, vec3(diffuse, diffuse, diffuse), uShadingK);

#ifdef BLOOM
    vec3 bloom = texture2D(uBloom, vUv).rgb;
#endif
#ifdef SUNRAYS
    float sunrays = texture2D(uSunrays, vUv).r;
    c *= sunrays;
#ifdef BLOOM
    bloom *= sunrays;
#endif
#endif
#ifdef BLOOM
    float noise = texture2D(uDithering, vUv * ditherScale).r;
    noise = noise * 2.0 - 1.0;
    bloom += noise / 255.0;
    bloom = linearToGamma(bloom);
    c += bloom;
#endif
    float noise = texture2D(uDithering, vUv * ditherScale).r;
    noise = noise * 2.0 - 1.0;
    c += noise / 255.0;
    float a = max(c.r, max(c.g, c.b));
    float C = texture2D(uObstacleC, vUv).x;
    gl_FragColor = vec4(c, a) + vec4(C, C, C, 0.0);
}
`;

export const clearShaderCode = `
precision mediump float;
precision mediump sampler2D;
varying highp vec2 vUv;
uniform sampler2D uTexture;
uniform float value;
void main () {
    gl_FragColor = value * texture2D(uTexture, vUv);
}
`;

export const divergenceShaderCode = `
precision mediump float;
precision mediump sampler2D;
varying highp vec2 vUv;
varying highp vec2 vL;
varying highp vec2 vR;
varying highp vec2 vT;
varying highp vec2 vB;
uniform sampler2D uVelocity;
uniform sampler2D uObstacleC;
uniform sampler2D uObstacleN;
void main () {
    if(texture2D(uObstacleC, vUv).x >= 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }
    float L = texture2D(uVelocity, vL).x;
    float R = texture2D(uVelocity, vR).x;
    float T = texture2D(uVelocity, vT).y;
    float B = texture2D(uVelocity, vB).y;
    vec2 C = texture2D(uVelocity, vUv).xy;
    if (vL.x < 0.0) { L = -C.x; }
    if (vR.x > 1.0) { R = -C.x; }
    if (vT.y > 1.0) { T = -C.y; }
    if (vB.y < 0.0) { B = -C.y; }
    vec4 oN = texture2D(uObstacleN, vUv);
    L = mix(L, -C.x, oN.x);  // if(oT > 0.0) vT = -vC;
    R = mix(R, -C.x, oN.y);  // if(oB > 0.0) vB = -vC;
    T = mix(T, -C.y, oN.z);  // if(oR > 0.0) vR = -vC;
    B = mix(B, -C.y, oN.w);  // if(oL > 0.0) vL = -vC;
    float div = -0.5 * (R - L + T - B);
    gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
}
`;

export const pressureShaderCode = `
precision mediump float;
precision mediump sampler2D;
varying highp vec2 vUv;
varying highp vec2 vL;
varying highp vec2 vR;
varying highp vec2 vT;
varying highp vec2 vB;
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform sampler2D uObstacleC;
uniform sampler2D uObstacleN;
void main () {
    if(texture2D(uObstacleC, vUv).x >= 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }
    float L = texture2D(uPressure, vL).x;
    float R = texture2D(uPressure, vR).x;
    float T = texture2D(uPressure, vT).x;
    float B = texture2D(uPressure, vB).x;
    float C = texture2D(uPressure, vUv).x;
    vec4 oN = texture2D(uObstacleN, vUv);
    L = mix(L, C, oN.x);  // if(oT > 0.0) vT = -vC;
    R = mix(R, C, oN.y);  // if(oB > 0.0) vB = -vC;
    T = mix(T, C, oN.z);  // if(oR > 0.0) vR = -vC;
    B = mix(B, C, oN.w);  // if(oL > 0.0) vL = -vC;
    float div = texture2D(uDivergence, vUv).x;
    float pressure = (L + R + B + T + div) * 0.25;
    gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
}
`;

export const gradientSubtractShaderCode = `
precision mediump float;
precision mediump sampler2D;
varying highp vec2 vUv;
varying highp vec2 vL;
varying highp vec2 vR;
varying highp vec2 vT;
varying highp vec2 vB;
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
uniform sampler2D uObstacleC;
uniform sampler2D uObstacleN;

void main () {
    if(texture2D(uObstacleC, vUv).x >= 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }
    float L = texture2D(uPressure, vL).x;
    float R = texture2D(uPressure, vR).x;
    float T = texture2D(uPressure, vT).x;
    float B = texture2D(uPressure, vB).x;
    float C = texture2D(uPressure, vUv).x;
    vec2 velocity = texture2D(uVelocity, vUv).xy;
    vec4 oN = texture2D(uObstacleN, vUv);
    L = mix(L, C, oN.x);  // if(oT > 0.0) vT = -vC;
    R = mix(R, C, oN.y);  // if(oB > 0.0) vB = -vC;
    T = mix(T, C, oN.z);  // if(oR > 0.0) vR = -vC;
    B = mix(B, C, oN.w);  // if(oL > 0.0) vL = -vC;
    velocity.xy -= 0.5 * vec2(R - L, T - B);
    gl_FragColor = vec4(velocity, 0.0, 1.0);
}
`;

export const solveShaderCode = `
precision mediump float;
precision mediump sampler2D;
varying highp vec2 vUv;
varying highp vec2 vL;
varying highp vec2 vR;
varying highp vec2 vT;
varying highp vec2 vB;
uniform highp vec2 uC;
uniform sampler2D uSource;
uniform sampler2D uObstacleC;
uniform sampler2D uObstacleN;
void main () {
    if(texture2D(uObstacleC, vUv).x >= 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }
    vec4 x0 = texture2D(uSource, vUv);
    vec4 L = texture2D(uSource, vL);
    vec4 R = texture2D(uSource, vR);
    vec4 T = texture2D(uSource, vT);
    vec4 B = texture2D(uSource, vB);
    vec4 oN = texture2D(uObstacleN, vUv);
    L = mix(L, x0, oN.x);  // if(oT > 0.0) vT = -vC;
    R = mix(R, x0, oN.y);  // if(oB > 0.0) vB = -vC;
    T = mix(T, x0, oN.z);  // if(oR > 0.0) vR = -vC;
    B = mix(B, x0, oN.w);  // if(oL > 0.0) vL = -vC;
    
    vec4 x = (x0 + uC.x * (L + R + B + T)) * uC.y;
    gl_FragColor = vec4(x.xyz, 1.0);
}
`;

export const advectionShaderCode = `
precision highp float;
precision highp sampler2D;
varying vec2 vUv;
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform sampler2D uObstacleC;
uniform vec2 texelSize;
uniform vec2 dyeTexelSize;
uniform float dt;
uniform float dissipation;
vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
    vec2 st = uv / tsize - 0.5;
    vec2 iuv = floor(st);
    vec2 fuv = fract(st);
    vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
    vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
    vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
    vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);
    return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
}
void main () {
    if(texture2D(uObstacleC, vUv).x > 0.5) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }
#ifdef MANUAL_FILTERING
    vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
    vec4 result = bilerp(uSource, coord, dyeTexelSize);
#else
    vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
    vec4 result = texture2D(uSource, coord);
#endif
    float decay = 1.0 + dissipation * dt;
    gl_FragColor = result / decay;
}
`;

export const obstaclesShaderCode = `
precision mediump float;
precision mediump sampler2D;
varying highp vec2 vUv;
varying highp vec2 vL;
varying highp vec2 vR;
varying highp vec2 vT;
varying highp vec2 vB;
uniform highp vec2 uC;
uniform sampler2D uObstacles;
void main () {
    gl_FragColor = vec4(
        texture2D(uObstacles, vL).x,
        texture2D(uObstacles, vR).x,
        texture2D(uObstacles, vT).x,
        texture2D(uObstacles, vB).x
    );
}
`;