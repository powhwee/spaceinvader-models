
import { invaderShape, getInvaderInstanceData, invaderShader } from './invader.js';
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
    // prettier-ignore
    const cubeVertices = new Float32Array([
        -0.5,-0.5, 0.5, 1,0,0, 0,0,1,  0.5,-0.5, 0.5, 1,0,0, 0,0,1,  0.5, 0.5, 0.5, 1,0,0, 0,0,1, -0.5,-0.5, 0.5, 1,0,0, 0,0,1,  0.5, 0.5, 0.5, 1,0,0, 0,0,1, -0.5, 0.5, 0.5, 1,0,0, 0,0,1,
        -0.5,-0.5,-0.5, 1,0,0, 0,0,-1, -0.5, 0.5,-0.5, 1,0,0, 0,0,-1,  0.5, 0.5,-0.5, 1,0,0, 0,0,-1, -0.5,-0.5,-0.5, 1,0,0, 0,0,-1,  0.5, 0.5,-0.5, 1,0,0, 0,0,-1,  0.5,-0.5,-0.5, 1,0,0, 0,0,-1,
        -0.5, 0.5,-0.5, 1,0,0, 0,1,0, -0.5, 0.5, 0.5, 1,0,0, 0,1,0,  0.5, 0.5, 0.5, 1,0,0, 0,1,0, -0.5, 0.5,-0.5, 1,0,0, 0,1,0,  0.5, 0.5, 0.5, 1,0,0, 0,1,0,  0.5, 0.5,-0.5, 1,0,0, 0,1,0,
        -0.5,-0.5,-0.5, 1,0,0, 0,-1,0,  0.5,-0.5,-0.5, 1,0,0, 0,-1,0,  0.5,-0.5, 0.5, 1,0,0, 0,-1,0, -0.5,-0.5,-0.5, 1,0,0, 0,-1,0,  0.5,-0.5, 0.5, 1,0,0, 0,-1,0, -0.5,-0.5, 0.5, 1,0,0, 0,-1,0,
         0.5,-0.5,-0.5, 1,0,0, 1,0,0,  0.5, 0.5,-0.5, 1,0,0, 1,0,0,  0.5, 0.5, 0.5, 1,0,0, 1,0,0,  0.5,-0.5,-0.5, 1,0,0, 1,0,0,  0.5, 0.5, 0.5, 1,0,0, 1,0,0,  0.5,-0.5, 0.5, 1,0,0, 1,0,0,
        -0.5,-0.5,-0.5, 1,0,0, -1,0,0, -0.5,-0.5, 0.5, 1,0,0, -1,0,0, -0.5, 0.5, 0.5, 1,0,0, -1,0,0, -0.5,-0.5,-0.5, 1,0,0, -1,0,0, -0.5, 0.5, 0.5, 1,0,0, -1,0,0, -0.5, 0.5,-0.5, 1,0,0, -1,0,0,
    ]);
    const invaderInstanceData = getInvaderInstanceData();

    const cubeVertexBuffer = device.createBuffer({ size: cubeVertices.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(cubeVertexBuffer, 0, cubeVertices);
    const invaderInstanceBuffer = device.createBuffer({ size: invaderInstanceData.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(invaderInstanceBuffer, 0, invaderInstanceData);
    
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
    
    const uniformBufferInvader = device.createBuffer({ size: 16 * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const uniformBufferParticles = device.createBuffer({ size: 16 * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

    const bindGroupLayout = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: {} },
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
        vertex: { module: invaderShaderModule, entryPoint: 'vs_main', buffers: [ { arrayStride: 9 * 4, attributes: [ { shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 3 * 4, format: 'float32x3' }, { shaderLocation: 3, offset: 6 * 4, format: 'float32x3' }, ], }, { arrayStride: 3 * 4, stepMode: 'instance', attributes: [ { shaderLocation: 2, offset: 0, format: 'float32x3' } ], } ] },
        fragment: { module: invaderShaderModule, entryPoint: 'fs_main', targets: [{ format: canvasFormat }] },
        primitive: { topology: 'triangle-list' },
        depthStencil: { depthWriteEnabled: true, depthCompare: 'less', format: 'depth24plus', depthBias: 0, depthBiasSlopeScale: 0 },
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
    
    const aspect = presentationSize[0] / presentationSize[1];
    mat4.perspective(projectionMatrix, Math.PI / 3, aspect, 0.1, 100.0);
    mat4.lookAt(viewMatrix, vec3.fromValues(0, 0, 20), vec3.fromValues(0, 0, 0), vec3.fromValues(0, 1, 0));

    let isPaused = false;
    let rotationX = 0, rotationY = 0;
    let lastTime = 0;

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

        rotationY += deltaTime * (Math.PI / 4);
        rotationX += deltaTime * (Math.PI / 6);
        mat4.fromYRotation(modelMatrix, rotationY);
        //mat4.rotateX(modelMatrix, modelMatrix, rotationX);

        mat4.multiply(vpMatrix, projectionMatrix, viewMatrix);
        mat4.multiply(mvpMatrix, vpMatrix, modelMatrix);

        device.queue.writeBuffer(uniformBufferInvader, 0, mvpMatrix);
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
        passEncoder.setVertexBuffer(0, cubeVertexBuffer);
        passEncoder.setVertexBuffer(1, invaderInstanceBuffer);
        passEncoder.draw(36, invaderShape.length, 0, 0);

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
