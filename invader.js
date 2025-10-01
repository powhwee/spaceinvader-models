export function createInvaderVertices() {
    const invaderShape = [
        [0,0], [3,0], [4,0], [5,0], [6,0], [9,0], [1,1], [2,1], [7,1], [8,1],
        [0,2], [1,2], [2,2], [3,2], [4,2], [5,2], [6,2], [7,2], [8,2], [9,2],
        [0,3], [2,3], [3,3], [4,3], [5,3], [6,3], [7,3], [9,3], [2,4], [7,4]
    ];

    // prettier-ignore
    const singleCubeVertices = [
        // pos(x,y,z),    color(r,g,b),   normal(x,y,z),    uv(u,v)
        // Front face (+z)
        -0.5, -0.5,  0.5,   1, 0, 0,   0, 0, 1,  0, 0,
         0.5, -0.5,  0.5,   1, 0, 0,   0, 0, 1,  1, 0,
         0.5,  0.5,  0.5,   1, 0, 0,   0, 0, 1,  1, 1,
        -0.5, -0.5,  0.5,   1, 0, 0,   0, 0, 1,  0, 0,
         0.5,  0.5,  0.5,   1, 0, 0,   0, 0, 1,  1, 1,
        -0.5,  0.5,  0.5,   1, 0, 0,   0, 0, 1,  0, 1,
        // Back face (-z)
        -0.5, -0.5, -0.5,   1, 0, 0,   0, 0, -1, 1, 0,
        -0.5,  0.5, -0.5,   1, 0, 0,   0, 0, -1, 1, 1,
         0.5,  0.5, -0.5,   1, 0, 0,   0, 0, -1, 0, 1,
        -0.5, -0.5, -0.5,   1, 0, 0,   0, 0, -1, 1, 0,
         0.5,  0.5, -0.5,   1, 0, 0,   0, 0, -1, 0, 1,
         0.5, -0.5, -0.5,   1, 0, 0,   0, 0, -1, 0, 0,
        // Top face (+y)
        -0.5,  0.5, -0.5,   1, 0, 0,   0, 1, 0,  0, 1,
        -0.5,  0.5,  0.5,   1, 0, 0,   0, 1, 0,  0, 0,
         0.5,  0.5,  0.5,   1, 0, 0,   0, 1, 0,  1, 0,
        -0.5,  0.5, -0.5,   1, 0, 0,   0, 1, 0,  0, 1,
         0.5,  0.5,  0.5,   1, 0, 0,   0, 1, 0,  1, 0,
         0.5,  0.5, -0.5,   1, 0, 0,   0, 1, 0,  1, 1,
        // Bottom face (-y)
        -0.5, -0.5, -0.5,   1, 0, 0,   0, -1, 0, 0, 0,
         0.5, -0.5, -0.5,   1, 0, 0,   0, -1, 0, 1, 0,
         0.5, -0.5,  0.5,   1, 0, 0,   0, -1, 0, 1, 1,
        -0.5, -0.5, -0.5,   1, 0, 0,   0, -1, 0, 0, 0,
         0.5, -0.5,  0.5,   1, 0, 0,   0, -1, 0, 1, 1,
        -0.5, -0.5,  0.5,   1, 0, 0,   0, -1, 0, 0, 1,
        // Right face (+x)
         0.5, -0.5, -0.5,   1, 0, 0,   1, 0, 0,  0, 0,
         0.5,  0.5, -0.5,   1, 0, 0,   1, 0, 0,  1, 0,
         0.5,  0.5,  0.5,   1, 0, 0,   1, 0, 0,  1, 1,
         0.5, -0.5, -0.5,   1, 0, 0,   1, 0, 0,  0, 0,
         0.5,  0.5,  0.5,   1, 0, 0,   1, 0, 0,  1, 1,
         0.5, -0.5,  0.5,   1, 0, 0,   1, 0, 0,  0, 1,
        // Left face (-x)
        -0.5, -0.5, -0.5,   1, 0, 0,  -1, 0, 0,  1, 0,
        -0.5, -0.5,  0.5,   1, 0, 0,  -1, 0, 0,  0, 0,
        -0.5,  0.5,  0.5,   1, 0, 0,  -1, 0, 0,  0, 1,
        -0.5, -0.5, -0.5,   1, 0, 0,  -1, 0, 0,  1, 0,
        -0.5,  0.5,  0.5,   1, 0, 0,  -1, 0, 0,  0, 1,
        -0.5,  0.5, -0.5,   1, 0, 0,  -1, 0, 0,  1, 1,
    ];

    const fullInvaderVertices = [];
    const vertexSize = 11; // 3 for pos, 3 for color, 3 for normal, 2 for uv

    invaderShape.forEach(([x, y]) => {
        const offsetX = x - 4.5;
        const offsetY = -y + 2.0;
        const offsetZ = 0;

        for (let i = 0; i < singleCubeVertices.length; i += vertexSize) {
            fullInvaderVertices.push(singleCubeVertices[i + 0] + offsetX);
            fullInvaderVertices.push(singleCubeVertices[i + 1] + offsetY);
            fullInvaderVertices.push(singleCubeVertices[i + 2] + offsetZ);

            // Copy color, normal, and uv as is
            fullInvaderVertices.push(...singleCubeVertices.slice(i + 3, i + 11));
        }
    });

    return new Float32Array(fullInvaderVertices);
}


export const invaderShader = `
    struct Uniforms { mvpMatrix: mat4x4<f32> };
    @group(0) @binding(0) var<uniform> uniforms: Uniforms;
    struct VSOutput { @builtin(position) pos: vec4<f32>, @location(0) color: vec3<f32>, @location(1) normal: vec3<f32> };

    @vertex
    fn vs_main(@location(0) pos: vec3<f32>, @location(1) color: vec3<f32>, @location(3) normal: vec3<f32>) -> VSOutput {
        var out: VSOutput;
        out.pos = uniforms.mvpMatrix * vec4<f32>(pos, 1.0);
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