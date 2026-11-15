import * as THREE from 'three';

export const SUN_DIR = new THREE.Vector3(0.22, 0.05, -1).normalize();

/** Sunset sky dome + layered mountain silhouettes on the horizon. */
export function createSky() {
  const group = new THREE.Group();
  group.name = 'sky';

  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { sunDir: { value: SUN_DIR } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww; // keep at far plane
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 sunDir;
      varying vec3 vDir;
      vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 low = lin(vec3(1.0, 0.80, 0.50));
        vec3 hor = lin(vec3(1.0, 0.50, 0.24));
        vec3 mid = lin(vec3(0.70, 0.24, 0.42));
        vec3 top = lin(vec3(0.10, 0.08, 0.24));
        vec3 col = mix(low, hor, smoothstep(0.0, 0.05, h));
        col = mix(col, mid, smoothstep(0.05, 0.25, h));
        col = mix(col, top, smoothstep(0.22, 0.75, h));
        float s = max(dot(d, sunDir), 0.0);
        col += lin(vec3(1.0, 0.55, 0.3)) * pow(s, 6.0) * 0.55;
        col += lin(vec3(1.0, 0.8, 0.55)) * pow(s, 60.0) * 0.9;
        col += vec3(6.0, 4.2, 2.6) * smoothstep(0.9993, 0.9997, s);
        // thin wispy cloud bands
        float band = sin(d.x * 9.0 + sin(d.z * 5.0) * 1.5) * 0.5 + 0.5;
        float clouds = smoothstep(0.55, 1.0, band) * smoothstep(0.03, 0.08, h) * (1.0 - smoothstep(0.1, 0.2, h));
        col = mix(col, lin(vec3(1.0, 0.62, 0.48)), clouds * 0.35);
        if (h < 0.0) col = mix(low * 0.7, lin(vec3(0.16, 0.08, 0.12)), smoothstep(0.0, -0.12, h));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24), skyMat);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  group.add(sky);

  // Mountain silhouettes (cheap ShapeGeometry layers)
  const layers = [
    { z: -230, color: 0x6b3550, amp: 46, base: 10, seed: 1.7 },
    { z: -170, color: 0x3d1d36, amp: 30, base: 4, seed: 4.1 },
    { z: -120, color: 0x1f0f1f, amp: 16, base: 0, seed: 7.3 },
  ];
  for (const L of layers) {
    const shape = new THREE.Shape();
    const width = 900;
    shape.moveTo(-width / 2, -20);
    for (let i = 0; i <= 160; i++) {
      const x = -width / 2 + (i / 160) * width;
      const u = x * 0.012 + L.seed;
      const y =
        L.base +
        L.amp * (0.55 * Math.abs(Math.sin(u)) + 0.3 * Math.sin(u * 2.7 + 1.3) ** 2 + 0.15 * Math.sin(u * 6.1));
      shape.lineTo(x, y);
    }
    shape.lineTo(width / 2, -20);
    shape.closePath();
    const m = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      new THREE.MeshBasicMaterial({ color: L.color, fog: false }),
    );
    m.position.set(0, -1, L.z);
    group.add(m);
  }

  // Outside desert ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 260).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x2b1820, fog: false }),
  );
  ground.position.set(0, -0.6, -146);
  group.add(ground);

  return group;
}
