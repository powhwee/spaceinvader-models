import { invaderVertices, invaderIndices, invaderBaseDimensions, invaderShader } from './invader.js';
import { createParticleSystem, particleShader } from './particle.js';

// Ensure glMatrix is available
const { mat4, vec3 } = glMatrix;

async function main() {
    // 1. SETUP: Get device and configure canvas
    //================================================================
    const canvas = document.getElementById('webgpu-canvas');
    if (!navigator.gpu) {
        throw new Error("WebGPU not supported on this browser.");
    }

    const devicePixelRatio = window.devicePixelRatio || 1;
    const presentationSize = [
        canvas.clientWidth * devicePixelRatio,
        canvas.clientHeight * devicePixelRatio,
    ];
    canvas.width = presentationSize[0];
    canvas.height = presentationSize[1];

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        throw new Error("No appropriate GPUAdapter found.");
    }

    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu');
    const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    
    context.configure({
        device: device,
        format: canvasFormat,
        alphaMode: 'premultiplied',
    });

    // 2. GEOMETRY & DATA
    //================================================================

    // -- Invader Geometry --
    const invaderVertexBuffer = device.createBuffer({
        size: invaderVertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(invaderVertexBuffer, 0, invaderVertices);

    const invaderIndexBuffer = device.createBuffer({
        size: invaderIndices.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(invaderIndexBuffer, 0, invaderIndices);
    
    // -- Particle System for 3D Flames --
    const { particleInstanceBuffer, updateParticles, getActiveParticleCount } = createParticleSystem(device);


    // 3. SHADERS (WGSL)
    //================================================================
    const invaderShaderModule = device.createShaderModule({
        label: 'Invader Shader',
        code: invaderShader,
    });
    
    const particleShaderModule = device.createShaderModule({
        label: 'Particle Shader',
        code: particleShader,
    });

    // 4. PIPELINES & BINDING
    //================================================================
    const depthTexture = device.createTexture({ size: presentationSize, format: 'depth24plus', usage: GPUTextureUsage.RENDER_ATTACHMENT });
    
    // Buffer for mvpMatrix, color, and time
    const uniformBufferInvader = device.createBuffer({ size: 96, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const uniformBufferParticles = device.createBuffer({ size: 16 * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

    const bindGroupLayout = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: {} },
            { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: {} },
        ],
    });
    
    const bindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
            { binding: 0, resource: { buffer: uniformBufferInvader } },
            { binding: 1, resource: { buffer: uniformBufferParticles } },
        ],
    });

    const invaderPipeline = device.createRenderPipeline({
        label: 'Invader Pipeline',
        layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
        vertex: {
            module: invaderShaderModule,
            entryPoint: 'vs_main',
            buffers: [
                {
                    arrayStride: 8 * 4, // 3 pos, 3 normal, 2 uv
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: 'float32x3' }, // pos
                        { shaderLocation: 1, offset: 3 * 4, format: 'float32x3' }, // normal
                        { shaderLocation: 2, offset: 6 * 4, format: 'float32x2' }, // uv
                    ],
                },
            ],
        },
        fragment: { module: invaderShaderModule, entryPoint: 'fs_main', targets: [{ format: canvasFormat, blend: { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' } } }] },
        primitive: { topology: 'triangle-list' },
        depthStencil: { depthWriteEnabled: true, depthCompare: 'less', format: 'depth24plus', depthBias: 2, depthBiasSlopeScale: 2 },
        multisample: { count: 1 },
    });

    const particlePipeline = device.createRenderPipeline({
        label: 'Particle Pipeline',
        layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
        vertex: {
            module: particleShaderModule,
            entryPoint: 'vs_main',
            buffers: [{
                arrayStride: 8 * 4,
                stepMode: 'instance',
                attributes: [
                    { shaderLocation: 0, offset: 0, format: 'float32x3' },   // inst_pos
                    { shaderLocation: 1, offset: 3 * 4, format: 'float32' },   // inst_size
                    { shaderLocation: 2, offset: 4 * 4, format: 'float32x4' }, // inst_color
                ],
            }],
        },
        fragment: {
            module: particleShaderModule,
            entryPoint: 'fs_main',
            targets: [{ 
                format: canvasFormat,
                blend: { color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' } },
            }],
        },
        primitive: { topology: 'triangle-list' },
        depthStencil: { depthWriteEnabled: false, depthCompare: 'less', format: 'depth24plus' },
    });


    // 5. RENDER LOOP
    //================================================================
    const mvpMatrix = mat4.create();
    const modelMatrix = mat4.create();
    const viewMatrix = mat4.create();
    const projectionMatrix = mat4.create();
    const vpMatrix = mat4.create();

    // Define the desired world-space dimensions of the invader
    const INVADER_WIDTH = 10.0;
    const INVADER_HEIGHT = 5.0;
    const INVADER_DEPTH = 1.0;
    const INVADER_COLOR = [1.0, 0.0, 0.0, 1.0]; // Red
    
    const aspect = presentationSize[0] / presentationSize[1];
    mat4.perspective(projectionMatrix, Math.PI / 3, aspect, 0.1, 100.0);
    mat4.lookAt(viewMatrix, vec3.fromValues(0, 0, 20), vec3.fromValues(0, 0, 0), vec3.fromValues(0, 1, 0));

    let isPaused = false;
    let rotationX = 0, rotationY = 0;
    let lastTime = 0;
    let manualTime = 0;

    document.addEventListener('keydown', (event) => {
        if (event.code === 'Space') {
            isPaused = !isPaused;
            if (!isPaused) requestAnimationFrame(drawFrame);
        }
    });

    function drawFrame(time) {
        if (isPaused) {
            lastTime = 0; return;
        }
        
        const deltaTime = lastTime > 0 ? (time - lastTime) / 1000 : 0.016;
        lastTime = time;
        manualTime += deltaTime;

        // Calculate scale factors based on desired dimensions and model's base dimensions
        const scaleX = INVADER_WIDTH / invaderBaseDimensions.width;
        const scaleY = INVADER_HEIGHT / invaderBaseDimensions.height;
        const scaleZ = INVADER_DEPTH / invaderBaseDimensions.depth;
        mat4.fromScaling(modelMatrix, [scaleX, scaleY, scaleZ]);

        // rotationY += deltaTime * (Math.PI / 4);
        // rotationX += deltaTime * (Math.PI / 6);
        // mat4.fromYRotation(modelMatrix, rotationY);
        //mat4.rotateX(modelMatrix, modelMatrix, rotationX);

        mat4.multiply(vpMatrix, projectionMatrix, viewMatrix);
        mat4.multiply(mvpMatrix, vpMatrix, modelMatrix);

        // Upload data to uniform buffer
        device.queue.writeBuffer(uniformBufferInvader, 0, mvpMatrix);
        device.queue.writeBuffer(uniformBufferInvader, 64, new Float32Array(INVADER_COLOR));
        device.queue.writeBuffer(uniformBufferInvader, 80, new Float32Array([manualTime]));
        device.queue.writeBuffer(uniformBufferParticles, 0, vpMatrix);
        
        updateParticles(deltaTime, modelMatrix);

        const commandEncoder = device.createCommandEncoder();
        const renderPassDescriptor = {
            colorAttachments: [{ view: context.getCurrentTexture().createView(), clearValue: { r: 0.05, g: 0.05, b: 0.1, a: 1.0 }, loadOp: 'clear', storeOp: 'store' }],
            depthStencilAttachment: { view: depthTexture.createView(), depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store' },
        };
        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

        passEncoder.setPipeline(invaderPipeline);
        passEncoder.setBindGroup(0, bindGroup);
        passEncoder.setVertexBuffer(0, invaderVertexBuffer);
        passEncoder.setIndexBuffer(invaderIndexBuffer, 'uint32');
        passEncoder.drawIndexed(invaderIndices.length, 1, 0, 0, 0);

        const activeParticleCount = getActiveParticleCount();
        if (activeParticleCount > 0) {
            passEncoder.setPipeline(particlePipeline);
            passEncoder.setBindGroup(0, bindGroup);
            passEncoder.setVertexBuffer(0, particleInstanceBuffer);
            passEncoder.draw(6, activeParticleCount, 0, 0); 
        }

        passEncoder.end();
        device.queue.submit([commandEncoder.finish()]);
        requestAnimationFrame(drawFrame);
    }
    requestAnimationFrame(drawFrame);
}

main().catch(err => {
    console.error(err);
    document.body.innerHTML = `<div style="text-align: center; color: red; font-size: 1.2em; padding: 2em;"><h2>Error</h2><p>${err.message}</p></div>`;
});