
const { vec3, mat4 } = glMatrix;

export const MAX_PARTICLES = 1000;

export function createParticleSystem(device) {
    const particles = Array.from({ length: MAX_PARTICLES }, () => ({ active: false }));
    const particleInstanceData = new Float32Array(MAX_PARTICLES * 8); // pos(3), size(1), color(4)
    const particleInstanceBuffer = device.createBuffer({
        size: particleInstanceData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    let activeParticleCount = 0;

    function updateParticles(deltaTime, modelMatrix) {
        const emitRate = 10;
        for (let i = 0; i < emitRate; i++) {
            const p = particles.find(p => !p.active);
            if (!p) continue;
            
            p.active = true;
            p.lifetime = Math.random() * 0.8 + 0.2;
            p.lifeRemaining = p.lifetime;
            
            const enginePos = (Math.random() > 0.5) ? [-1.5, -2.5, 0] : [1.5, -2.5, 0];
            p.position = vec3.transformMat4(vec3.create(), enginePos, modelMatrix);
            
            const localVelocity = [
                (Math.random() - 0.5) * 1.5,
                -3.0 - Math.random() * 2.0,
                (Math.random() - 0.5) * 1.5,
            ];
            
            const rotationMatrix = mat4.clone(modelMatrix);
            rotationMatrix[12] = 0; // Zero out translation components
            rotationMatrix[13] = 0;
            rotationMatrix[14] = 0;

            p.velocity = vec3.transformMat4(vec3.create(), localVelocity, rotationMatrix);
            p.size = Math.random() * 0.5 + 0.25;
        }

        activeParticleCount = 0;
        for (const p of particles) {
            if (!p.active) continue;

            p.lifeRemaining -= deltaTime;
            if (p.lifeRemaining <= 0) {
                p.active = false;
                continue;
            }

            vec3.scaleAndAdd(p.position, p.position, p.velocity, deltaTime);
            const lifeRatio = p.lifeRemaining / p.lifetime;
            
            const offset = activeParticleCount * 8;
            particleInstanceData.set(p.position, offset);
            particleInstanceData[offset + 3] = p.size * lifeRatio;
            particleInstanceData[offset + 4] = 1.0;
            particleInstanceData[offset + 5] = lifeRatio * 0.8;
            particleInstanceData[offset + 6] = 0.0;
            particleInstanceData[offset + 7] = lifeRatio * 0.7;
            
            activeParticleCount++;
        }
        
        if (activeParticleCount > 0) {
            device.queue.writeBuffer(particleInstanceBuffer, 0, particleInstanceData, 0, activeParticleCount * 8);
        }
    }

    return { particleInstanceBuffer, updateParticles, getActiveParticleCount: () => activeParticleCount };
}

export const particleShader = `
    struct Uniforms { vpMatrix: mat4x4<f32> };
    @group(0) @binding(1) var<uniform> uniforms: Uniforms;
    struct VSOutput { @builtin(position) pos: vec4<f32>, @location(0) color: vec4<f32>, @location(1) uv: vec2<f32> };

    const quad_pos = array<vec2<f32>, 4>(vec2(-0.5, -0.5), vec2(0.5, -0.5), vec2(-0.5, 0.5), vec2(0.5, 0.5));
    const quad_uv = array<vec2<f32>, 4>(vec2(0.0, 1.0), vec2(1.0, 1.0), vec2(0.0, 0.0), vec2(1.0, 0.0));
    const quad_indices = array<u32, 6>(0, 1, 2, 2, 1, 3);

    @vertex
    fn vs_main(@builtin(vertex_index) v_idx: u32, @location(0) inst_pos: vec3<f32>, @location(1) inst_size: f32, @location(2) inst_color: vec4<f32>) -> VSOutput {
        var out: VSOutput;
        let corner_idx = quad_indices[v_idx];
        
        // Billboard calculation: make quad face the camera
        let right = vec4<f32>(uniforms.vpMatrix[0][0], uniforms.vpMatrix[1][0], uniforms.vpMatrix[2][0], 0.0) * quad_pos[corner_idx].x;
        let up = vec4<f32>(uniforms.vpMatrix[0][1], uniforms.vpMatrix[1][1], uniforms.vpMatrix[2][1], 0.0) * quad_pos[corner_idx].y;
        let final_pos = vec4<f32>(inst_pos, 1.0) + (right + up) * inst_size;
        
        out.pos = uniforms.vpMatrix * final_pos;
        out.color = inst_color;
        out.uv = quad_uv[corner_idx];
        return out;
    }

    @fragment
    fn fs_main(in: VSOutput) -> @location(0) vec4<f32> {
        let dist = distance(in.uv, vec2(0.5, 0.5));
        let alpha = 1.0 - smoothstep(0.4, 0.5, dist);
        return vec4(in.color.rgb, in.color.a * alpha);
    }
`;
