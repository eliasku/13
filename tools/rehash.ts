import {readFileSync} from "fs";

const inputProps: Record<string, Record<string, string[]>> = {
    safari: {
        "AudioContext": ["baseLatency", "getOutputTimestamp", "suspend", "resume", "close", "createMediaElementSource", "createMediaStreamSource", "createMediaStreamDestination", "destination", "currentTime", "sampleRate", "listener", "audioWorklet", "state", "onstatechange", "createBuffer", "decodeAudioData", "createBufferSource", "createGain", "createDelay", "createBiquadFilter", "createWaveShaper", "createPanner", "createConvolver", "createDynamicsCompressor", "createAnalyser", "createScriptProcessor", "createOscillator", "createPeriodicWave", "createConstantSource", "createStereoPanner", "createIIRFilter", "createChannelSplitter", "createChannelMerger", "addEventListener", "removeEventListener", "dispatchEvent"],
        "WebGLRenderingContext": ["canvas", "drawingBufferWidth", "drawingBufferHeight", "activeTexture", "attachShader", "bindAttribLocation", "bindBuffer", "bindFramebuffer", "bindRenderbuffer", "bindTexture", "blendColor", "blendEquation", "blendEquationSeparate", "blendFunc", "blendFuncSeparate", "bufferData", "bufferSubData", "checkFramebufferStatus", "clear", "clearColor", "clearDepth", "clearStencil", "colorMask", "compileShader", "texImage2D", "texSubImage2D", "compressedTexImage2D", "compressedTexSubImage2D", "copyTexImage2D", "copyTexSubImage2D", "createBuffer", "createFramebuffer", "createProgram", "createRenderbuffer", "createShader", "createTexture", "cullFace", "deleteBuffer", "deleteFramebuffer", "deleteProgram", "deleteRenderbuffer", "deleteShader", "deleteTexture", "depthFunc", "depthMask", "depthRange", "detachShader", "disable", "disableVertexAttribArray", "drawArrays", "drawElements", "enable", "enableVertexAttribArray", "finish", "flush", "framebufferRenderbuffer", "framebufferTexture2D", "frontFace", "generateMipmap", "getActiveAttrib", "getActiveUniform", "getAttachedShaders", "getAttribLocation", "getBufferParameter", "getContextAttributes", "getError", "getSupportedExtensions", "getExtension", "getFramebufferAttachmentParameter", "getParameter", "getProgramParameter", "getProgramInfoLog", "getRenderbufferParameter", "getShaderParameter", "getShaderInfoLog", "getShaderPrecisionFormat", "getShaderSource", "getTexParameter", "getUniform", "getUniformLocation", "getVertexAttrib", "getVertexAttribOffset", "isBuffer", "isContextLost", "isEnabled", "isFramebuffer", "isProgram", "isRenderbuffer", "isShader", "isTexture", "lineWidth", "linkProgram", "pixelStorei", "polygonOffset", "readPixels", "renderbufferStorage", "sampleCoverage", "scissor", "shaderSource", "stencilFunc", "stencilFuncSeparate", "stencilMask", "stencilMaskSeparate", "stencilOp", "stencilOpSeparate", "texParameterf", "texParameteri", "uniform1f", "uniform2f", "uniform3f", "uniform4f", "uniform1i", "uniform2i", "uniform3i", "uniform4i", "uniform1fv", "uniform2fv", "uniform3fv", "uniform4fv", "uniform1iv", "uniform2iv", "uniform3iv", "uniform4iv", "uniformMatrix2fv", "uniformMatrix3fv", "uniformMatrix4fv", "useProgram", "validateProgram", "vertexAttrib1f", "vertexAttrib2f", "vertexAttrib3f", "vertexAttrib4f", "vertexAttrib1fv", "vertexAttrib2fv", "vertexAttrib3fv", "vertexAttrib4fv", "vertexAttribPointer", "viewport"],
        "CanvasRenderingContext2D": ["canvas", "webkitBackingStorePixelRatio", "webkitImageSmoothingEnabled", "webkitLineDash", "webkitLineDashOffset", "globalAlpha", "globalCompositeOperation", "strokeStyle", "fillStyle", "imageSmoothingEnabled", "imageSmoothingQuality", "lineWidth", "lineCap", "lineJoin", "miterLimit", "lineDashOffset", "shadowOffsetX", "shadowOffsetY", "shadowBlur", "shadowColor", "textAlign", "textBaseline", "direction", "getContextAttributes", "setAlpha", "setCompositeOperation", "drawImageFromRect", "setStrokeColor", "setFillColor", "setLineWidth", "setLineCap", "setLineJoin", "setMiterLimit", "setShadow", "clearShadow", "drawImage", "beginPath", "stroke", "isPointInPath", "isPointInStroke", "createLinearGradient", "createRadialGradient", "createConicGradient", "createPattern", "createImageData", "getImageData", "putImageData", "closePath", "moveTo", "lineTo", "quadraticCurveTo", "bezierCurveTo", "arcTo", "ellipse", "setLineDash", "getLineDash", "clearRect", "fillRect", "strokeRect", "restore", "fillText", "strokeText", "measureText", "scale", "rotate", "translate", "transform", "getTransform", "setTransform", "resetTransform", "drawFocusIfNeeded"],
        "CanvasGradient": ["addColorStop"],
        "EventSource": ["withCredentials", "readyState", "onopen", "onmessage", "onerror", "close", "addEventListener", "removeEventListener", "dispatchEvent"],
        "RTCPeerConnection": ["localDescription", "currentLocalDescription", "pendingLocalDescription", "remoteDescription", "currentRemoteDescription", "pendingRemoteDescription", "signalingState", "iceGatheringState", "iceConnectionState", "connectionState", "canTrickleIceCandidates", "onnegotiationneeded", "onicecandidate", "onsignalingstatechange", "oniceconnectionstatechange", "onicegatheringstatechange", "onconnectionstatechange", "onicecandidateerror", "ontrack", "ondatachannel", "createOffer", "createAnswer", "setLocalDescription", "setRemoteDescription", "addIceCandidate", "restartIce", "getConfiguration", "setConfiguration", "close", "getSenders", "getReceivers", "getTransceivers", "addTrack", "removeTrack", "addTransceiver", "createDataChannel", "getStats", "addEventListener", "removeEventListener", "dispatchEvent"],
        "RTCDataChannel": ["label", "ordered", "maxPacketLifeTime", "maxRetransmits", "protocol", "negotiated", "readyState", "bufferedAmount", "priority", "bufferedAmountLowThreshold", "binaryType", "onopen", "onerror", "onclose", "onclosing", "onmessage", "onbufferedamountlow", "close", "addEventListener", "removeEventListener", "dispatchEvent"]
    },
    firefox: {
        "AudioContext": ["getOutputTimestamp", "suspend", "close", "createMediaElementSource", "createMediaStreamSource", "createMediaStreamTrackSource", "createMediaStreamDestination", "baseLatency", "outputLatency", "resume", "createBuffer", "decodeAudioData", "createBufferSource", "createConstantSource", "createScriptProcessor", "createAnalyser", "createGain", "createDelay", "createBiquadFilter", "createIIRFilter", "createWaveShaper", "createPanner", "createStereoPanner", "createConvolver", "createChannelSplitter", "createChannelMerger", "createDynamicsCompressor", "createOscillator", "createPeriodicWave", "destination", "sampleRate", "currentTime", "listener", "state", "audioWorklet", "onstatechange", "addEventListener", "removeEventListener", "dispatchEvent"],
        "WebGLRenderingContext": ["bufferData", "bufferSubData", "compressedTexImage2D", "compressedTexSubImage2D", "readPixels", "texImage2D", "texSubImage2D", "uniform1fv", "uniform2fv", "uniform3fv", "uniform4fv", "uniform1iv", "uniform2iv", "uniform3iv", "uniform4iv", "uniformMatrix2fv", "uniformMatrix3fv", "uniformMatrix4fv", "getContextAttributes", "isContextLost", "getSupportedExtensions", "getExtension", "activeTexture", "attachShader", "bindAttribLocation", "bindBuffer", "bindFramebuffer", "bindRenderbuffer", "bindTexture", "blendColor", "blendEquation", "blendEquationSeparate", "blendFunc", "blendFuncSeparate", "checkFramebufferStatus", "clear", "clearColor", "clearDepth", "clearStencil", "colorMask", "compileShader", "copyTexImage2D", "copyTexSubImage2D", "createBuffer", "createFramebuffer", "createProgram", "createRenderbuffer", "createShader", "createTexture", "cullFace", "deleteBuffer", "deleteFramebuffer", "deleteProgram", "deleteRenderbuffer", "deleteShader", "deleteTexture", "depthFunc", "depthMask", "depthRange", "detachShader", "disable", "disableVertexAttribArray", "drawArrays", "drawElements", "enable", "enableVertexAttribArray", "finish", "flush", "framebufferRenderbuffer", "framebufferTexture2D", "frontFace", "generateMipmap", "getActiveAttrib", "getActiveUniform", "getAttachedShaders", "getAttribLocation", "getBufferParameter", "getParameter", "getError", "getFramebufferAttachmentParameter", "getProgramParameter", "getProgramInfoLog", "getRenderbufferParameter", "getShaderParameter", "getShaderPrecisionFormat", "getShaderInfoLog", "getShaderSource", "getTexParameter", "getUniform", "getUniformLocation", "getVertexAttrib", "getVertexAttribOffset", "isBuffer", "isEnabled", "isFramebuffer", "isProgram", "isRenderbuffer", "isShader", "isTexture", "lineWidth", "linkProgram", "pixelStorei", "polygonOffset", "renderbufferStorage", "sampleCoverage", "scissor", "shaderSource", "stencilFunc", "stencilFuncSeparate", "stencilMask", "stencilMaskSeparate", "stencilOp", "stencilOpSeparate", "texParameterf", "texParameteri", "uniform1f", "uniform2f", "uniform3f", "uniform4f", "uniform1i", "uniform2i", "uniform3i", "uniform4i", "useProgram", "validateProgram", "vertexAttrib1f", "vertexAttrib1fv", "vertexAttrib2f", "vertexAttrib2fv", "vertexAttrib3f", "vertexAttrib3fv", "vertexAttrib4f", "vertexAttrib4fv", "vertexAttribPointer", "viewport", "canvas", "drawingBufferWidth", "drawingBufferHeight"],
        "CanvasRenderingContext2D": ["drawImage", "beginPath", "stroke", "isPointInPath", "isPointInStroke", "createLinearGradient", "createRadialGradient", "createConicGradient", "createPattern", "createImageData", "getImageData", "putImageData", "setLineDash", "getLineDash", "closePath", "moveTo", "lineTo", "quadraticCurveTo", "bezierCurveTo", "arcTo", "ellipse", "clearRect", "fillRect", "strokeRect", "restore", "fillText", "strokeText", "measureText", "scale", "rotate", "translate", "transform", "getTransform", "setTransform", "resetTransform", "drawFocusIfNeeded", "canvas", "mozCurrentTransform", "mozCurrentTransformInverse", "mozTextStyle", "mozImageSmoothingEnabled", "globalAlpha", "globalCompositeOperation", "strokeStyle", "fillStyle", "filter", "imageSmoothingEnabled", "lineWidth", "lineCap", "lineJoin", "miterLimit", "lineDashOffset", "shadowOffsetX", "shadowOffsetY", "shadowBlur", "shadowColor", "textAlign", "textBaseline", "direction", "fontKerning"],
        "CanvasGradient": ["addColorStop"],
        "EventSource": ["close", "withCredentials", "readyState", "onopen", "onmessage", "onerror", "addEventListener", "removeEventListener", "dispatchEvent"],
        "RTCPeerConnection": ["setIdentityProvider", "getIdentityAssertion", "createOffer", "createAnswer", "setLocalDescription", "setRemoteDescription", "addIceCandidate", "restartIce", "getConfiguration", "setConfiguration", "getLocalStreams", "getRemoteStreams", "addStream", "addTrack", "removeTrack", "addTransceiver", "getSenders", "getReceivers", "getTransceivers", "close", "getStats", "createDataChannel", "localDescription", "currentLocalDescription", "pendingLocalDescription", "remoteDescription", "currentRemoteDescription", "pendingRemoteDescription", "signalingState", "canTrickleIceCandidates", "iceGatheringState", "iceConnectionState", "peerIdentity", "idpLoginUrl", "onnegotiationneeded", "onicecandidate", "onsignalingstatechange", "onaddstream", "onaddtrack", "ontrack", "oniceconnectionstatechange", "onicegatheringstatechange", "ondatachannel", "addEventListener", "removeEventListener", "dispatchEvent"],
        "RTCDataChannel": ["close", "label", "negotiated", "ordered", "reliable", "maxPacketLifeTime", "maxRetransmits", "protocol", "readyState", "bufferedAmount", "bufferedAmountLowThreshold", "onopen", "onerror", "onclose", "onmessage", "onbufferedamountlow", "binaryType", "addEventListener", "removeEventListener", "dispatchEvent"]
    },
    chrome: {
        "AudioContext": ["baseLatency", "outputLatency", "close", "createMediaElementSource", "createMediaStreamDestination", "createMediaStreamSource", "getOutputTimestamp", "resume", "suspend", "destination", "currentTime", "sampleRate", "listener", "state", "onstatechange", "createAnalyser", "createBiquadFilter", "createBuffer", "createBufferSource", "createChannelMerger", "createChannelSplitter", "createConstantSource", "createConvolver", "createDelay", "createDynamicsCompressor", "createGain", "createIIRFilter", "createOscillator", "createPanner", "createPeriodicWave", "createScriptProcessor", "createStereoPanner", "createWaveShaper", "decodeAudioData", "audioWorklet", "addEventListener", "dispatchEvent", "removeEventListener"],
        "WebGLRenderingContext": ["canvas", "drawingBufferWidth", "drawingBufferHeight", "activeTexture", "attachShader", "bindAttribLocation", "bindRenderbuffer", "blendColor", "blendEquation", "blendEquationSeparate", "blendFunc", "blendFuncSeparate", "bufferData", "bufferSubData", "checkFramebufferStatus", "compileShader", "compressedTexImage2D", "compressedTexSubImage2D", "copyTexImage2D", "copyTexSubImage2D", "createBuffer", "createFramebuffer", "createProgram", "createRenderbuffer", "createShader", "createTexture", "cullFace", "deleteBuffer", "deleteFramebuffer", "deleteProgram", "deleteRenderbuffer", "deleteShader", "deleteTexture", "depthFunc", "depthMask", "depthRange", "detachShader", "disable", "enable", "finish", "flush", "framebufferRenderbuffer", "framebufferTexture2D", "frontFace", "generateMipmap", "getActiveAttrib", "getActiveUniform", "getAttachedShaders", "getAttribLocation", "getBufferParameter", "getContextAttributes", "getError", "getExtension", "getFramebufferAttachmentParameter", "getParameter", "getProgramInfoLog", "getProgramParameter", "getRenderbufferParameter", "getShaderInfoLog", "getShaderParameter", "getShaderPrecisionFormat", "getShaderSource", "getSupportedExtensions", "getTexParameter", "getUniform", "getUniformLocation", "getVertexAttrib", "getVertexAttribOffset", "isBuffer", "isContextLost", "isEnabled", "isFramebuffer", "isProgram", "isRenderbuffer", "isShader", "isTexture", "lineWidth", "linkProgram", "pixelStorei", "polygonOffset", "readPixels", "renderbufferStorage", "sampleCoverage", "shaderSource", "stencilFunc", "stencilFuncSeparate", "stencilMask", "stencilMaskSeparate", "stencilOp", "stencilOpSeparate", "texImage2D", "texParameterf", "texParameteri", "texSubImage2D", "useProgram", "validateProgram", "bindBuffer", "bindFramebuffer", "bindTexture", "clear", "clearColor", "clearDepth", "clearStencil", "colorMask", "disableVertexAttribArray", "drawArrays", "drawElements", "enableVertexAttribArray", "scissor", "uniform1f", "uniform1fv", "uniform1i", "uniform1iv", "uniform2f", "uniform2fv", "uniform2i", "uniform2iv", "uniform3f", "uniform3fv", "uniform3i", "uniform3iv", "uniform4f", "uniform4fv", "uniform4i", "uniform4iv", "uniformMatrix2fv", "uniformMatrix3fv", "uniformMatrix4fv", "vertexAttrib1f", "vertexAttrib1fv", "vertexAttrib2f", "vertexAttrib2fv", "vertexAttrib3f", "vertexAttrib3fv", "vertexAttrib4f", "vertexAttrib4fv", "vertexAttribPointer", "viewport", "drawingBufferColorSpace", "unpackColorSpace", "makeXRCompatible"],
        "CanvasRenderingContext2D": ["canvas", "globalAlpha", "globalCompositeOperation", "filter", "imageSmoothingEnabled", "imageSmoothingQuality", "strokeStyle", "fillStyle", "shadowOffsetX", "shadowOffsetY", "shadowBlur", "shadowColor", "lineWidth", "lineCap", "lineJoin", "miterLimit", "lineDashOffset", "textAlign", "textBaseline", "direction", "fontKerning", "fontStretch", "fontVariantCaps", "letterSpacing", "textRendering", "wordSpacing", "createConicGradient", "createImageData", "createLinearGradient", "createPattern", "createRadialGradient", "drawFocusIfNeeded", "drawImage", "fillText", "getContextAttributes", "getImageData", "getLineDash", "getTransform", "isContextLost", "isPointInPath", "isPointInStroke", "measureText", "putImageData", "reset", "roundRect", "scale", "setLineDash", "setTransform", "stroke", "strokeText", "transform", "translate", "arcTo", "beginPath", "bezierCurveTo", "clearRect", "closePath", "ellipse", "fillRect", "lineTo", "moveTo", "quadraticCurveTo", "resetTransform", "restore", "rotate", "strokeRect"],
        "CanvasGradient": ["addColorStop"],
        "EventSource": ["withCredentials", "readyState", "onopen", "onmessage", "onerror", "close", "addEventListener", "dispatchEvent", "removeEventListener"],
        "RTCPeerConnection": ["localDescription", "currentLocalDescription", "pendingLocalDescription", "remoteDescription", "currentRemoteDescription", "pendingRemoteDescription", "signalingState", "iceGatheringState", "iceConnectionState", "connectionState", "canTrickleIceCandidates", "onnegotiationneeded", "onicecandidate", "onsignalingstatechange", "oniceconnectionstatechange", "onconnectionstatechange", "onicegatheringstatechange", "onicecandidateerror", "ontrack", "ondatachannel", "onaddstream", "onremovestream", "addIceCandidate", "addStream", "addTrack", "addTransceiver", "close", "createAnswer", "createDTMFSender", "createDataChannel", "createOffer", "getConfiguration", "getLocalStreams", "getReceivers", "getRemoteStreams", "getSenders", "getStats", "getTransceivers", "removeStream", "removeTrack", "restartIce", "setConfiguration", "setLocalDescription", "setRemoteDescription", "addEventListener", "dispatchEvent", "removeEventListener"],
        "RTCDataChannel": ["label", "ordered", "maxPacketLifeTime", "maxRetransmits", "protocol", "negotiated", "readyState", "bufferedAmount", "bufferedAmountLowThreshold", "onopen", "onbufferedamountlow", "onerror", "onclosing", "onclose", "onmessage", "binaryType", "reliable", "close", "addEventListener", "dispatchEvent", "removeEventListener"]
    },
    ANGLE: {
        "ANGLEInstancedArrays": [
            "VERTEX_ATTRIB_ARRAY_DIVISOR_ANGLE",
            "drawArraysInstancedANGLE",
            "drawElementsInstancedANGLE",
            "vertexAttribDivisorANGLE",
        ]
    }
};

//"clientX", "clientY", "label","close", "open",
export const filter: string[] = ["clear", "state", "flush", "delete", "get", "has", "set", "filter", "map", "fill", "length"];

export let propMap: Record<string, Set<string>> = {};

for (const map of Object.keys(inputProps)) {
    for (const type of Object.keys(inputProps[map])) {
        propMap[type] ??= new Set();
        const fields = inputProps[map][type];
        for (const f of fields) {
            propMap[type].add(f);
        }
    }
}

let props: Record<string, number[][]> = {};

for (const type of Object.keys(propMap)) {
    const typeFields = [...propMap[type]];
    props[type] = [];
    for (const field of typeFields) {
        props[type].push([...field].map(x => x.charCodeAt(0)));
    }
}


const enum Tempering {
    MaskB = 0x9D2C5680,
    MaskC = 0xEFC60000,
}

/* @__PURE__ */
const temper = (x: number /* u32 */): number /* u32 */ => {
    x ^= x >>> 11;
    x ^= (x << 7) & Tempering.MaskB;
    x ^= (x << 15) & Tempering.MaskC;
    x ^= x >>> 18;
    return x >>> 1;
}
// simple PRNG from libc with u32 state
let _rngSeed = new Date as any as number >>> 0;

const nextInt = (): number =>
    temper(_rngSeed = (Math.imul(_rngSeed, 1103515245) + 12345) >>> 0);

const h2_ = (str: number[], seed: number, mod: number): number => {
    for (let i = 0, n = str.length; i < n; ++i) {
        seed = (Math.imul(seed, 23131) + str[i]) >>> 0;
    }
    return seed % mod;
}

if (process.argv.indexOf("--gen") > 0) {

    const usedMap: Record<string, Set<string>> = {};
    const refSource = readFileSync("build/client0.js", "utf8");
    const reFieldID = (from: string) => new RegExp("([.])(" + from + ")([^\\w_$]|$)", "gm");

    for (const map of Object.keys(inputProps)) {
        for (const type of Object.keys(inputProps[map])) {
            usedMap[type] ??= new Set();
            const fields = inputProps[map][type];
            for (const f of fields) {
                if (filter.indexOf(f) < 0) {
                    refSource.replaceAll(reFieldID(f), (a, c1, c2, c3) => {
                        usedMap[type].add(f);
                        return "";
                    });
                }
            }
        }
    }

    let seed = 1;
    // let mod = 513; //Hash.Mod;
    let mod = 255; //32 * 32;
    let st = new Set<number>();
    let ust = new Set<number>();

    const seedHasCollisions = (seed: number, mod: number) => {
        for (const typename in props) {
            const propList = props[typename];
            st.clear();
            ust.clear();
            for (let i = 0, n = propList.length; i < n; ++i) {
                const f = h2_(propList[i], seed, mod);
                if (!ust.has(f)) {
                    if (usedMap[typename].has(String.fromCharCode(...propList[i]))) {
                        if(st.has(f)) {
                            return true;
                        }
                        ust.add(f);
                    }
                    else {
                        st.add(f);
                    }
                } else {
                    // console.warn(typename + ": " + f + " vs " + String.fromCharCode(...propList[i]));
                    return true;
                }
            }
        }
        return false;
    }

    let prevMinMod = 1000000;
    let prevMinSeed = 0x100000000;
    for(;;) {
        //console.info("Start mod: 0x" + mod.toString(16));
        let attempts = 0;
        let found = true;
        // _SEEDS[1] = +new Date >>> 0;
        // seed = nextInt(1);
        const maxIters = 0x1000;
        // const maxIters = 0x80000000;
        while (seedHasCollisions(seed, mod)) {
            seed = nextInt();
            if (++attempts > maxIters) {
                found = false;
                break;
            }
        }
        if (found) {
            if (mod < prevMinMod) {
                prevMinMod = mod;
                prevMinSeed = seed;
                console.info("Found on iteration: " + attempts);
                console.info("SEED = " + seed);
                console.info("MOD = " + mod);
            }
            else if(mod == prevMinMod && seed < prevMinSeed) {
                prevMinSeed = seed;
                console.info("Found on iteration: " + attempts);
                console.info("SEED = " + seed);
                console.info("MOD = " + mod);
            }
        }

        ++mod;
        while (!(mod & 1)) {
            ++mod;
        }
        if (mod >= 427) {
            console.info("cycle!");
            // _rngSeed = new Date as any as number >>> 0;
            mod = 377;
        }
    }
}
