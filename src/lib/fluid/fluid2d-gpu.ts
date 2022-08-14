import {hue, Vec4} from "./vec4";
import {inputPointers} from "./input";
import {createTextureDefer, DoubleFbo, Fbo, GL, gl, Program, TextureObject} from "./gl";
import {
    advectionShaderCode,
    baseVertexShaderCode,
    clearShaderCode,
    curlShaderCode,
    displayShaderCode,
    divergenceShaderCode,
    gradientSubtractShaderCode,
    obstaclesShaderCode,
    pressureShaderCode,
    solveShaderCode,
    splatShaderCode,
    vorticityShaderCode
} from "./shaders";

interface Config {
    vorticity_: number;
    pressure_: number;
    pressureIterations_: number;
    dissipationVelocity_: number;
    dissipationDensity_: number;
    viscosity_: number;
    diffusion_: number;
    shading_: number;
}

export class Fluid2dGpu {
    config_: Config = {
        vorticity_: 10.0,
        pressure_: 0.8,
        pressureIterations_: 20,
        dissipationVelocity_: 0.2,
        dissipationDensity_: 1.0,
        viscosity_: 0.0,
        diffusion_: 0.0,
        shading_: 0.0
    };

    splatProgram_: Program;
    curlProgram_: Program;
    vorticityProgram_: Program;
    divergenceProgram_: Program;
    advectionProgram_: Program;
    displayProgram_: Program;
    clearProgram_: Program;
    pressureProgram_: Program;
    gradientSubtractProgram_: Program;
    solveProgram_: Program;
    obstaclesProgram_: Program;

    ditheringTexture_: TextureObject;

    vbo_: WebGLBuffer;
    ibo_: WebGLBuffer;

    dye_: DoubleFbo;
    velocity_: DoubleFbo;
    pressure_: DoubleFbo;
    curl_: Fbo;
    divergence_: Fbo;
    obstacleC_: DoubleFbo;
    obstacleN_: DoubleFbo;

    timeScale_: number = 1.0;

    // spawnAmount = 50.0 * 6.0 * 10.0;
    // spawnForce = 60.0 * w;
    readonly color_ = new Vec4(1.0, 1.0, 1.0, 1.0);
    colorTime_ = 0.0;
    colorSpeed_ = 0.2;

    constructor(readonly canvas_: HTMLCanvasElement) {
        const mapWidth = 1024;
        const mapHeight = 1024;
        const simulationWidth = 128;
        const simulationHeight = 128;

        this.vbo_ = gl.createBuffer()!;
        this.ibo_ = gl.createBuffer()!;
        gl.bindBuffer(GL.ARRAY_BUFFER, this.vbo_);
        gl.bufferData(GL.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), GL.STATIC_DRAW);
        gl.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, this.ibo_);
        gl.bufferData(GL.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), GL.STATIC_DRAW);
        gl.vertexAttribPointer(0, 2, GL.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);

        this.splatProgram_ = new Program(baseVertexShaderCode, splatShaderCode);
        this.curlProgram_ = new Program(baseVertexShaderCode, curlShaderCode);
        this.vorticityProgram_ = new Program(baseVertexShaderCode, vorticityShaderCode);
        this.divergenceProgram_ = new Program(baseVertexShaderCode, divergenceShaderCode);
        this.advectionProgram_ = new Program(baseVertexShaderCode, advectionShaderCode);
        this.displayProgram_ = new Program(baseVertexShaderCode, displayShaderCode);
        this.clearProgram_ = new Program(baseVertexShaderCode, clearShaderCode);
        this.pressureProgram_ = new Program(baseVertexShaderCode, pressureShaderCode);
        this.gradientSubtractProgram_ = new Program(baseVertexShaderCode, gradientSubtractShaderCode);
        this.solveProgram_ = new Program(baseVertexShaderCode, solveShaderCode);
        this.obstaclesProgram_ = new Program(baseVertexShaderCode, obstaclesShaderCode);

        this.dye_ = new DoubleFbo(mapWidth, mapHeight, GL.RGBA16F, GL.RGBA, GL.HALF_FLOAT, GL.LINEAR);
        this.velocity_ = new DoubleFbo(simulationWidth, simulationHeight, GL.RGBA16F, GL.RGBA, GL.HALF_FLOAT, GL.LINEAR);
        this.pressure_ = new DoubleFbo(simulationWidth, simulationHeight, GL.RGBA16F, GL.RGBA, GL.HALF_FLOAT, GL.NEAREST);
        this.divergence_ = new Fbo(simulationWidth, simulationHeight, GL.RGBA16F, GL.RGBA, GL.HALF_FLOAT, GL.NEAREST);
        this.curl_ = new Fbo(simulationWidth, simulationHeight, GL.RGBA16F, GL.RGBA, GL.HALF_FLOAT, GL.NEAREST);
        this.obstacleC_ = new DoubleFbo(simulationWidth, simulationHeight, GL.R8, GL.RED, GL.UNSIGNED_BYTE, GL.NEAREST);
        this.obstacleN_ = new DoubleFbo(simulationWidth, simulationHeight, GL.RGBA8, GL.RGBA, GL.UNSIGNED_BYTE, GL.NEAREST);

        this.ditheringTexture_ = createTextureDefer("LDR_LLL1_0.png");
    }

    updateBrush_(dt: number) {
        this.colorTime_ += dt * this.colorSpeed_;
        hue(this.color_, this.colorTime_ - (this.colorTime_ | 0));
        // for (let i = 0; i < inputPointers.length; ++i) {
        //     const pointer = inputPointers[i];
        //     if (pointer.active_ && pointer.down_) {
        //         let mx = pointer.x_ | 0;
        //         let my = pointer.y_ | 0;
        //         const width = this.canvas_.width;
        //         const height = this.canvas_.height;
        //         if (pointer.down_ && (mx !== pointer.prevX_ || my !== pointer.prevY_)) {
        //             if (mx > 0 && mx < width - 1 && my > 0 && my < height - 1) {
        //                 const fx = mx - pointer.prevX_;
        //                 const fy = my - pointer.prevY_;
        //                 const len = Math.sqrt(fx * fx + fy * fy);
        //                 //const n = (len | 0) + 1;
        //                 const n = 1;
        //
        //                 let x = pointer.prevX_;
        //                 let y = pointer.prevY_;
        //                 let dx = (mx - pointer.prevX_) / n;
        //                 let dy = (my - pointer.prevY_) / n;
        //                 for (let i = 0; i < n + 1; ++i) {
        //                     //if (this.fluid.blocked[ij] !== 0) continue;
        //                     // this.fluid.addSourceDensity(this.spawnAmount / n, x | 0, y | 0);
        //                     // this.fluid.addSourceVelocity(this.spawnForce / n, fx, fy, x | 0, y | 0);
        //                     this.splat_(x / width,
        //                         1.0 - y / height,
        //                         fx, -fy, this.color_);
        //
        //                     x += dx;
        //                     y += dy;
        //                 }
        //             }
        //         }
        //     }
        // }
    }

    project_() {
        this.divergenceProgram_.bind_();
        gl.uniform2f(this.divergenceProgram_.uniforms_.texelSize, this.velocity_.texelSizeX_, this.velocity_.texelSizeY_);
        gl.uniform1i(this.divergenceProgram_.uniforms_.uVelocity, this.velocity_.read_.attach_(0));
        gl.uniform1i(this.divergenceProgram_.uniforms_.uObstacleC, this.obstacleC_.read_.attach_(1));
        gl.uniform1i(this.divergenceProgram_.uniforms_.uObstacleN, this.obstacleN_.read_.attach_(2));
        this.blit_(this.divergence_);

        this.clearProgram_.bind_();
        gl.uniform1i(this.clearProgram_.uniforms_.uTexture, this.pressure_.read_.attach_(0));
        gl.uniform1f(this.clearProgram_.uniforms_.value, this.config_.pressure_);
        this.blit_(this.pressure_.write_);
        this.pressure_.swap_();

        this.pressureProgram_.bind_();
        gl.uniform2f(this.pressureProgram_.uniforms_.texelSize, this.velocity_.texelSizeX_, this.velocity_.texelSizeY_);
        gl.uniform1i(this.pressureProgram_.uniforms_.uDivergence, this.divergence_.attach_(0));
        gl.uniform1i(this.pressureProgram_.uniforms_.uObstacleC, this.obstacleC_.read_.attach_(2));
        gl.uniform1i(this.pressureProgram_.uniforms_.uObstacleN, this.obstacleN_.read_.attach_(3));
        for (let i = 0; i < this.config_.pressureIterations_; ++i) {
            gl.uniform1i(this.pressureProgram_.uniforms_.uPressure, this.pressure_.read_.attach_(1));
            this.blit_(this.pressure_.write_);
            this.pressure_.swap_();
        }

        this.gradientSubtractProgram_.bind_();
        gl.uniform2f(this.gradientSubtractProgram_.uniforms_.texelSize, this.velocity_.texelSizeX_, this.velocity_.texelSizeY_);
        gl.uniform1i(this.gradientSubtractProgram_.uniforms_.uPressure, this.pressure_.read_.attach_(0));
        gl.uniform1i(this.gradientSubtractProgram_.uniforms_.uVelocity, this.velocity_.read_.attach_(1));
        gl.uniform1i(this.gradientSubtractProgram_.uniforms_.uObstacleC, this.obstacleC_.read_.attach_(2));
        gl.uniform1i(this.gradientSubtractProgram_.uniforms_.uObstacleN, this.obstacleN_.read_.attach_(3));
        this.blit_(this.velocity_.write_);
        this.velocity_.swap_();
    }

    vorticity_(dt: number) {
        if (this.config_.vorticity_ <= 0.0) {
            return;
        }

        this.curlProgram_.bind_();
        gl.uniform2f(this.curlProgram_.uniforms_.texelSize, this.velocity_.texelSizeX_, this.velocity_.texelSizeY_);
        gl.uniform1i(this.curlProgram_.uniforms_.uVelocity, this.velocity_.read_.attach_(0));
        this.blit_(this.curl_);

        this.vorticityProgram_.bind_();
        gl.uniform2f(this.vorticityProgram_.uniforms_.texelSize, this.velocity_.texelSizeX_, this.velocity_.texelSizeY_);
        gl.uniform1i(this.vorticityProgram_.uniforms_.uVelocity, this.velocity_.read_.attach_(0));
        gl.uniform1i(this.vorticityProgram_.uniforms_.uCurl, this.curl_.attach_(1));
        gl.uniform1f(this.vorticityProgram_.uniforms_.curl, this.config_.vorticity_);
        gl.uniform1f(this.vorticityProgram_.uniforms_.dt, dt);
        this.blit_(this.velocity_.write_);
        this.velocity_.swap_();
    }

    diffuse_(diff: number, dt: number, iterations: number, target: DoubleFbo) {
        if (diff <= 0.0) {
            return;
        }
        this.solveProgram_.bind_();
        const a = dt * diff;
        gl.uniform2f(this.solveProgram_.uniforms_.texelSize, target.texelSizeX_, target.texelSizeY_);
        gl.uniform2f(this.solveProgram_.uniforms_.uC, a, 1.0 / (1.0 + 4.0 * a));
        gl.uniform1i(this.solveProgram_.uniforms_.uObstacleC, this.obstacleC_.read_.attach_(1));
        gl.uniform1i(this.solveProgram_.uniforms_.uObstacleN, this.obstacleN_.read_.attach_(2));
        for (let i = 0; i < iterations; ++i) {
            gl.uniform1i(this.solveProgram_.uniforms_.uSource, target.read_.attach_(0));
            this.blit_(target.write_);
            target.swap_();
        }
    }

    step_(dt: number) {
        gl.disable(GL.BLEND);

        this.createObstacleN_();

        this.advectionProgram_.bind_();
        gl.uniform2f(this.advectionProgram_.uniforms_.texelSize, this.velocity_.texelSizeX_, this.velocity_.texelSizeY_);
        let velocityId = this.velocity_.read_.attach_(0);
        gl.uniform1i(this.advectionProgram_.uniforms_.uVelocity, velocityId);
        gl.uniform1i(this.advectionProgram_.uniforms_.uSource, velocityId);
        gl.uniform1i(this.advectionProgram_.uniforms_.uObstacleC, this.obstacleC_.read_.attach_(2));
        gl.uniform1f(this.advectionProgram_.uniforms_.dt, dt);
        gl.uniform1f(this.advectionProgram_.uniforms_.dissipation, this.config_.dissipationVelocity_);
        this.blit_(this.velocity_.write_);
        this.velocity_.swap_();

        this.advectionProgram_.bind_();
        gl.uniform2f(this.advectionProgram_.uniforms_.texelSize, this.velocity_.texelSizeX_, this.velocity_.texelSizeY_);
        gl.uniform1i(this.advectionProgram_.uniforms_.uVelocity, this.velocity_.read_.attach_(0));
        gl.uniform1i(this.advectionProgram_.uniforms_.uSource, this.dye_.read_.attach_(1));
        gl.uniform1i(this.advectionProgram_.uniforms_.uObstacleC, this.obstacleC_.read_.attach_(2));
        gl.uniform1f(this.advectionProgram_.uniforms_.dt, dt);
        gl.uniform1f(this.advectionProgram_.uniforms_.dissipation, this.config_.dissipationDensity_);
        this.blit_(this.dye_.write_);
        this.dye_.swap_();

        this.diffuse_(this.config_.viscosity_, dt, 20, this.velocity_);
        this.diffuse_(this.config_.diffusion_, dt, 20, this.dye_);

        this.vorticity_(dt);

        this.project_();
    }

    addObstacles_(x: number, y: number) {
        this.splatObstacle_(x, y);
    }

    update_(dt: number) {
        dt *= this.timeScale_;
        if (dt > 0.0) {
            this.updateBrush_(dt);
            this.step_(dt);
        }

        this.render_(null);
    }

    render_(target: Fbo | null) {
        const width = target === null ? gl.drawingBufferWidth : target.width_;
        const height = target === null ? gl.drawingBufferHeight : target.height_;
        this.displayProgram_.bind_();
        gl.uniform2f(this.displayProgram_.uniforms_.texelSize, this.dye_.texelSizeX_, this.dye_.texelSizeY_);
        gl.uniform1i(this.displayProgram_.uniforms_.uTexture, this.dye_.read_.attach_(0));
        //gl.uniform1i(displayMaterial.uniforms.uBloom, bloom.attach(1));
        gl.uniform1f(this.displayProgram_.uniforms_.uShadingK, this.config_.shading_);
        gl.uniform1i(this.displayProgram_.uniforms_.uDithering, this.ditheringTexture_.attach_(2));
        gl.uniform1i(this.displayProgram_.uniforms_.uObstacleC, this.obstacleC_.read_.attach_(3));
        gl.uniform2f(this.displayProgram_.uniforms_.ditherScale, width / this.ditheringTexture_.width_, height / this.ditheringTexture_.height_);
        this.blit_(target);
    }

    splat_(u: number, v: number, dx: number, dy: number, color: Vec4) {
        this.splatProgram_.bind_();
        gl.uniform1i(this.splatProgram_.uniforms_.uTarget, this.velocity_.read_.attach_(0));
        gl.uniform1f(this.splatProgram_.uniforms_.aspectRatio, this.canvas_.width / this.canvas_.height);
        gl.uniform2f(this.splatProgram_.uniforms_.point, u, v);
        gl.uniform3f(this.splatProgram_.uniforms_.color, dx, dy, 0.0);
        gl.uniform1f(this.splatProgram_.uniforms_.radius, 1 / this.canvas_.width);
        this.blit_(this.velocity_.write_);
        this.velocity_.swap_();

        gl.uniform1i(this.splatProgram_.uniforms_.uTarget, this.dye_.read_.attach_(0));
        gl.uniform3f(this.splatProgram_.uniforms_.color, color.x, color.y, color.z);
        this.blit_(this.dye_.write_);
        this.dye_.swap_();
    }

    splatObstacle_(u: number, v: number) {
        this.splatProgram_.bind_();
        gl.uniform1i(this.splatProgram_.uniforms_.uTarget, this.obstacleC_.read_.attach_(0));
        gl.uniform1f(this.splatProgram_.uniforms_.aspectRatio, this.canvas_.width / this.canvas_.height);
        gl.uniform2f(this.splatProgram_.uniforms_.point, u, v);
        gl.uniform3f(this.splatProgram_.uniforms_.color, 1.0, 1.0, 1.0);
        gl.uniform1f(this.splatProgram_.uniforms_.radius, 1.0 / this.canvas_.width);
        this.blit_(this.obstacleC_.write_);
        this.obstacleC_.swap_();
    }

    blit_(target: Fbo | null, clear?: undefined | boolean) {
        if (target == null) {
            gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
            gl.bindFramebuffer(GL.FRAMEBUFFER, null);
        } else {
            gl.viewport(0, 0, target.width_, target.height_);
            gl.bindFramebuffer(GL.FRAMEBUFFER, target.fbo_);
        }
        if (clear) {
            gl.clearColor(0.0, 0.0, 0.0, 1.0);
            gl.clear(GL.COLOR_BUFFER_BIT);
        }
        gl.drawElements(GL.TRIANGLES, 6, GL.UNSIGNED_SHORT, 0);
    }

    // create cell-neighbor scale factors
    private createObstacleN_() {
        this.obstaclesProgram_.bind_();
        gl.uniform2f(this.obstaclesProgram_.uniforms_.texelSize, this.obstacleC_.texelSizeX_, this.obstacleC_.texelSizeY_);
        gl.uniform1i(this.obstaclesProgram_.uniforms_.uObstacles, this.obstacleC_.read_.attach_(0));
        this.blit_(this.obstacleN_.write_);
        this.obstacleN_.swap_();
    }
}


