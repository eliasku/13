import {hue, Vec4} from "./vec4";
import {inputPointers} from "./input";
import {createTextureDefer, DoubleFbo, Fbo, gl, Program, TextureObject} from "./gl";
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
    vorticity: number;
    pressure: number;
    pressureIterations: number;
    dissipationVelocity: number;
    dissipationDensity: number;
    viscosity: number;
    diffusion: number;
    shading: number;
}

export class Fluid2dGpu {
    config: Config = {
        vorticity: 10.0,
        pressure: 0.8,
        pressureIterations: 20,
        dissipationVelocity: 0.2,
        dissipationDensity: 1.0,
        viscosity: 0.0,
        diffusion: 0.0,
        shading: 0.0
    };

    splatProgram: Program;
    curlProgram: Program;
    vorticityProgram: Program;
    divergenceProgram: Program;
    advectionProgram: Program;
    displayProgram: Program;
    clearProgram: Program;
    pressureProgram: Program;
    gradientSubtractProgram: Program;
    solveProgram: Program;
    obstaclesProgram: Program;

    ditheringTexture: TextureObject;

    vbo: WebGLBuffer;
    ibo: WebGLBuffer;

    dye: DoubleFbo;
    velocity: DoubleFbo;
    pressure: DoubleFbo;
    curl: Fbo;
    divergence: Fbo;
    obstacleC: DoubleFbo;
    obstacleN: DoubleFbo;

    timeScale: number = 1.0;

    // spawnAmount = 50.0 * 6.0 * 10.0;
    // spawnForce = 60.0 * w;
    readonly color = new Vec4(1.0, 1.0, 1.0, 1.0);
    colorTime = 0.0;
    colorSpeed = 0.2;

    constructor(readonly canvas: HTMLCanvasElement) {
        const mapWidth = 1024;
        const mapHeight = 1024;
        const simulationWidth = 128;
        const simulationHeight = 128;

        this.vbo = gl.createBuffer()!;
        this.ibo = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);

        this.splatProgram = new Program(baseVertexShaderCode, splatShaderCode);
        this.curlProgram = new Program(baseVertexShaderCode, curlShaderCode);
        this.vorticityProgram = new Program(baseVertexShaderCode, vorticityShaderCode);
        this.divergenceProgram = new Program(baseVertexShaderCode, divergenceShaderCode);
        this.advectionProgram = new Program(baseVertexShaderCode, advectionShaderCode);
        this.displayProgram = new Program(baseVertexShaderCode, displayShaderCode);
        this.clearProgram = new Program(baseVertexShaderCode, clearShaderCode);
        this.pressureProgram = new Program(baseVertexShaderCode, pressureShaderCode);
        this.gradientSubtractProgram = new Program(baseVertexShaderCode, gradientSubtractShaderCode);
        this.solveProgram = new Program(baseVertexShaderCode, solveShaderCode);
        this.obstaclesProgram = new Program(baseVertexShaderCode, obstaclesShaderCode);

        this.dye = new DoubleFbo(mapWidth, mapHeight, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR);
        this.velocity = new DoubleFbo(simulationWidth, simulationHeight, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR);
        this.pressure = new DoubleFbo(simulationWidth, simulationHeight, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.NEAREST);
        this.divergence = new Fbo(simulationWidth, simulationHeight, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.NEAREST);
        this.curl = new Fbo(simulationWidth, simulationHeight, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.NEAREST);
        this.obstacleC = new DoubleFbo(simulationWidth, simulationHeight, gl.R8, gl.RED, gl.UNSIGNED_BYTE, gl.NEAREST);
        this.obstacleN = new DoubleFbo(simulationWidth, simulationHeight, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST);

        this.ditheringTexture = createTextureDefer("LDR_LLL1_0.png");
    }

    updateBrush(dt: number) {
        this.colorTime += dt * this.colorSpeed;
        hue(this.color, this.colorTime - (this.colorTime | 0));
        for (let i = 0; i < inputPointers.length; ++i) {
            const pointer = inputPointers[i];
            if (pointer.active && pointer.down) {
                let mx = pointer.x | 0;
                let my = pointer.y | 0;
                const width = this.canvas.width;
                const height = this.canvas.height;
                if (pointer.down && (mx !== pointer.prevX || my !== pointer.prevY)) {
                    if (mx > 0 && mx < width - 1 && my > 0 && my < height - 1) {
                        const fx = mx - pointer.prevX;
                        const fy = my - pointer.prevY;
                        const len = Math.sqrt(fx * fx + fy * fy);
                        //const n = (len | 0) + 1;
                        const n = 1;

                        let x = pointer.prevX;
                        let y = pointer.prevY;
                        let dx = (mx - pointer.prevX) / n;
                        let dy = (my - pointer.prevY) / n;
                        for (let i = 0; i < n + 1; ++i) {
                            //if (this.fluid.blocked[ij] !== 0) continue;
                            // this.fluid.addSourceDensity(this.spawnAmount / n, x | 0, y | 0);
                            // this.fluid.addSourceVelocity(this.spawnForce / n, fx, fy, x | 0, y | 0);
                            this.splat(x / width,
                                1.0 - y / height,
                                fx, -fy, this.color);

                            x += dx;
                            y += dy;
                        }
                    }
                }
            }
        }
    }

    project() {
        this.divergenceProgram.bind();
        gl.uniform2f(this.divergenceProgram.uniforms.texelSize, this.velocity.texelSizeX, this.velocity.texelSizeY);
        gl.uniform1i(this.divergenceProgram.uniforms.uVelocity, this.velocity.read.attach(0));
        gl.uniform1i(this.divergenceProgram.uniforms.uObstacleC, this.obstacleC.read.attach(1));
        gl.uniform1i(this.divergenceProgram.uniforms.uObstacleN, this.obstacleN.read.attach(2));
        this.blit(this.divergence);

        this.clearProgram.bind();
        gl.uniform1i(this.clearProgram.uniforms.uTexture, this.pressure.read.attach(0));
        gl.uniform1f(this.clearProgram.uniforms.value, this.config.pressure);
        this.blit(this.pressure.write);
        this.pressure.swap();

        this.pressureProgram.bind();
        gl.uniform2f(this.pressureProgram.uniforms.texelSize, this.velocity.texelSizeX, this.velocity.texelSizeY);
        gl.uniform1i(this.pressureProgram.uniforms.uDivergence, this.divergence.attach(0));
        gl.uniform1i(this.pressureProgram.uniforms.uObstacleC, this.obstacleC.read.attach(2));
        gl.uniform1i(this.pressureProgram.uniforms.uObstacleN, this.obstacleN.read.attach(3));
        for (let i = 0; i < this.config.pressureIterations; ++i) {
            gl.uniform1i(this.pressureProgram.uniforms.uPressure, this.pressure.read.attach(1));
            this.blit(this.pressure.write);
            this.pressure.swap();
        }

        this.gradientSubtractProgram.bind();
        gl.uniform2f(this.gradientSubtractProgram.uniforms.texelSize, this.velocity.texelSizeX, this.velocity.texelSizeY);
        gl.uniform1i(this.gradientSubtractProgram.uniforms.uPressure, this.pressure.read.attach(0));
        gl.uniform1i(this.gradientSubtractProgram.uniforms.uVelocity, this.velocity.read.attach(1));
        gl.uniform1i(this.gradientSubtractProgram.uniforms.uObstacleC, this.obstacleC.read.attach(2));
        gl.uniform1i(this.gradientSubtractProgram.uniforms.uObstacleN, this.obstacleN.read.attach(3));
        this.blit(this.velocity.write);
        this.velocity.swap();
    }

    vorticity(dt: number) {
        if (this.config.vorticity <= 0.0) {
            return;
        }

        this.curlProgram.bind();
        gl.uniform2f(this.curlProgram.uniforms.texelSize, this.velocity.texelSizeX, this.velocity.texelSizeY);
        gl.uniform1i(this.curlProgram.uniforms.uVelocity, this.velocity.read.attach(0));
        this.blit(this.curl);

        this.vorticityProgram.bind();
        gl.uniform2f(this.vorticityProgram.uniforms.texelSize, this.velocity.texelSizeX, this.velocity.texelSizeY);
        gl.uniform1i(this.vorticityProgram.uniforms.uVelocity, this.velocity.read.attach(0));
        gl.uniform1i(this.vorticityProgram.uniforms.uCurl, this.curl.attach(1));
        gl.uniform1f(this.vorticityProgram.uniforms.curl, this.config.vorticity);
        gl.uniform1f(this.vorticityProgram.uniforms.dt, dt);
        this.blit(this.velocity.write);
        this.velocity.swap();
    }

    diffuse(diff: number, dt: number, iterations: number, target: DoubleFbo) {
        if (diff <= 0.0) {
            return;
        }
        this.solveProgram.bind();
        const a = dt * diff;
        gl.uniform2f(this.solveProgram.uniforms.texelSize, target.texelSizeX, target.texelSizeY);
        gl.uniform2f(this.solveProgram.uniforms.uC, a, 1.0 / (1.0 + 4.0 * a));
        gl.uniform1i(this.solveProgram.uniforms.uObstacleC, this.obstacleC.read.attach(1));
        gl.uniform1i(this.solveProgram.uniforms.uObstacleN, this.obstacleN.read.attach(2));
        for (let i = 0; i < iterations; ++i) {
            gl.uniform1i(this.solveProgram.uniforms.uSource, target.read.attach(0));
            this.blit(target.write);
            target.swap();
        }
    }

    step(dt: number) {
        gl.disable(gl.BLEND);

        this.createObstacleN();

        this.advectionProgram.bind();
        gl.uniform2f(this.advectionProgram.uniforms.texelSize, this.velocity.texelSizeX, this.velocity.texelSizeY);
        let velocityId = this.velocity.read.attach(0);
        gl.uniform1i(this.advectionProgram.uniforms.uVelocity, velocityId);
        gl.uniform1i(this.advectionProgram.uniforms.uSource, velocityId);
        gl.uniform1i(this.advectionProgram.uniforms.uObstacleC, this.obstacleC.read.attach(2));
        gl.uniform1f(this.advectionProgram.uniforms.dt, dt);
        gl.uniform1f(this.advectionProgram.uniforms.dissipation, this.config.dissipationVelocity);
        this.blit(this.velocity.write);
        this.velocity.swap();

        this.advectionProgram.bind();
        gl.uniform2f(this.advectionProgram.uniforms.texelSize, this.velocity.texelSizeX, this.velocity.texelSizeY);
        gl.uniform1i(this.advectionProgram.uniforms.uVelocity, this.velocity.read.attach(0));
        gl.uniform1i(this.advectionProgram.uniforms.uSource, this.dye.read.attach(1));
        gl.uniform1i(this.advectionProgram.uniforms.uObstacleC, this.obstacleC.read.attach(2));
        gl.uniform1f(this.advectionProgram.uniforms.dt, dt);
        gl.uniform1f(this.advectionProgram.uniforms.dissipation, this.config.dissipationDensity);
        this.blit(this.dye.write);
        this.dye.swap();

        this.diffuse(this.config.viscosity, dt, 20, this.velocity);
        this.diffuse(this.config.diffusion, dt, 20, this.dye);

        this.vorticity(dt);

        this.project();
    }

    addObstacles(x: number, y: number) {
        this.splatObstacle(x, y);
    }

    update(dt: number) {
        dt *= this.timeScale;
        if (dt > 0.0) {
            this.updateBrush(dt);
            this.step(dt);
        }

        this.render(null);
    }

    render(target: Fbo | null) {
        const width = target === null ? gl.drawingBufferWidth : target.width;
        const height = target === null ? gl.drawingBufferHeight : target.height;
        this.displayProgram.bind();
        gl.uniform2f(this.displayProgram.uniforms.texelSize, this.dye.texelSizeX, this.dye.texelSizeY);
        gl.uniform1i(this.displayProgram.uniforms.uTexture, this.dye.read.attach(0));
        //gl.uniform1i(displayMaterial.uniforms.uBloom, bloom.attach(1));
        gl.uniform1f(this.displayProgram.uniforms.uShadingK, this.config.shading);
        gl.uniform1i(this.displayProgram.uniforms.uDithering, this.ditheringTexture.attach(2));
        gl.uniform1i(this.displayProgram.uniforms.uObstacleC, this.obstacleC.read.attach(3));
        gl.uniform2f(this.displayProgram.uniforms.ditherScale, width / this.ditheringTexture.width, height / this.ditheringTexture.height);
        this.blit(target);
    }

    splat(u: number, v: number, dx: number, dy: number, color: Vec4) {
        this.splatProgram.bind();
        gl.uniform1i(this.splatProgram.uniforms.uTarget, this.velocity.read.attach(0));
        gl.uniform1f(this.splatProgram.uniforms.aspectRatio, this.canvas.width / this.canvas.height);
        gl.uniform2f(this.splatProgram.uniforms.point, u, v);
        gl.uniform3f(this.splatProgram.uniforms.color, dx, dy, 0.0);
        gl.uniform1f(this.splatProgram.uniforms.radius, 1 / this.canvas.width);
        this.blit(this.velocity.write);
        this.velocity.swap();

        gl.uniform1i(this.splatProgram.uniforms.uTarget, this.dye.read.attach(0));
        gl.uniform3f(this.splatProgram.uniforms.color, color.x, color.y, color.z);
        this.blit(this.dye.write);
        this.dye.swap();
    }

    splatObstacle(u: number, v: number) {
        this.splatProgram.bind();
        gl.uniform1i(this.splatProgram.uniforms.uTarget, this.obstacleC.read.attach(0));
        gl.uniform1f(this.splatProgram.uniforms.aspectRatio, this.canvas.width / this.canvas.height);
        gl.uniform2f(this.splatProgram.uniforms.point, u, v);
        gl.uniform3f(this.splatProgram.uniforms.color, 1.0, 1.0, 1.0);
        gl.uniform1f(this.splatProgram.uniforms.radius, 1.0 / this.canvas.width);
        this.blit(this.obstacleC.write);
        this.obstacleC.swap();
    }

    blit(target: Fbo | null, clear?: undefined | boolean) {
        if (target == null) {
            gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        } else {
            gl.viewport(0, 0, target.width, target.height);
            gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
        }
        if (clear) {
            gl.clearColor(0.0, 0.0, 0.0, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT);
        }
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }

    // create cell-neighbor scale factors
    private createObstacleN() {
        this.obstaclesProgram.bind();
        gl.uniform2f(this.obstaclesProgram.uniforms.texelSize, this.obstacleC.texelSizeX, this.obstacleC.texelSizeY);
        gl.uniform1i(this.obstaclesProgram.uniforms.uObstacles, this.obstacleC.read.attach(0));
        this.blit(this.obstacleN.write);
        this.obstacleN.swap();
    }
}


