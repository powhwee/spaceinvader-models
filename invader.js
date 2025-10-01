
export const invaderShape = [
    [0,0], [3,0], [4,0], [5,0], [6,0], [9,0], [1,1], [2,1], [7,1], [8,1],
    [0,2], [1,2], [2,2], [3,2], [4,2], [5,2], [6,2], [7,2], [8,2], [9,2],
    [0,3], [2,3], [3,3], [4,3], [5,3], [6,3], [7,3], [9,3], [2,4], [7,4]
];

export function getInvaderInstanceData() {
    const invaderInstanceData = new Float32Array(invaderShape.length * 3);
    invaderShape.forEach(([x, y], i) => {
        invaderInstanceData[i * 3 + 0] = x - 4.5;
        invaderInstanceData[i * 3 + 1] = -y + 2.0;
        invaderInstanceData[i * 3 + 2] = 0;
    });
    return invaderInstanceData;
}

export const invaderShader = `
    struct Uniforms { mvpMatrix: mat4x4<f32> };
    @group(0) @binding(0) var<uniform> uniforms: Uniforms;
    struct VSOutput { @builtin(position) pos: vec4<f32>, @location(0) color: vec3<f32>, @location(1) normal: vec3<f32> };

    @vertex
    fn vs_main(@location(0) pos: vec3<f32>, @location(1) color: vec3<f32>, @location(2) inst_offset: vec3<f32>, @location(3) normal: vec3<f32>) -> VSOutput {
        var out: VSOutput;
        let scaled_pos = pos * 1.02;
        let model_pos = scaled_pos + inst_offset;
        out.pos = uniforms.mvpMatrix * vec4<f32>(model_pos, 1.0);
        out.color = color;
        out.normal = normal; 
        return out;
    }

    @fragment
    fn fs_main(in: VSOutput) -> @location(0) vec4<f32> {
        let lightDir = normalize(vec3<f32>(0.8, 1.0, 0.5));
        let normal = normalize(in.normal);
        let diffuse = max(dot(normal, lightDir), 0.0);
        let ambient = 0.4;
        let finalColor = in.color * (ambient + diffuse * 0.8);
        return vec4<f32>(finalColor, 1.0);
    }
`;
