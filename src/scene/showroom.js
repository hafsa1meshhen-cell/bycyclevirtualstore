import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { createSky, SUN_DIR } from './sky.js';
import { createConcreteTexture, createSignTexture, ACCENT } from './textures.js';

export const ROOM = { minX: -50, maxX: 50, minZ: -15, maxZ: 15, height: 9 };

/** Emissive material that blooms (values > 1, not tone mapped). */
export function glowMaterial(hex, intensity = 2.5, extra = {}) {
  const color = new THREE.Color(hex).multiplyScalar(intensity);
  return new THREE.MeshBasicMaterial({ color, toneMapped: false, ...extra });
}

/** Shared volumetric light-beam material (fake god-ray cone). */
export function beamMaterial(hex, strength = 0.12) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { color: { value: new THREE.Color(hex) }, strength: { value: strength } },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vN; varying vec3 vView;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vView = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 color; uniform float strength;
      varying vec2 vUv; varying vec3 vN; varying vec3 vView;
      void main() {
        float facing = abs(dot(normalize(vN), normalize(vView)));
        float a = strength * pow(facing, 1.5) * smoothstep(0.0, 0.35, vUv.y) * (0.35 + 0.65 * vUv.y);
        gl_FragColor = vec4(color * a, a);
      }`,
  });
}

export function buildShowroom({ scene, renderer, quality }) {
  const W = ROOM.maxX - ROOM.minX;
  const D = ROOM.maxZ - ROOM.minZ;
  const H = ROOM.height;
  const updaters = [];

  // ------------------------------------------------------------ environment
  scene.background = new THREE.Color(0x0b0910);
  scene.fog = new THREE.FogExp2(0x120c16, 0.016);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.35;
  pmrem.dispose();

  scene.add(createSky());

  // ------------------------------------------------------------ lights
  scene.add(new THREE.HemisphereLight(0xffd9b8, 0x14101c, 0.55));
  const sun = new THREE.DirectionalLight(0xff9a5c, quality.reflections ? 0.9 : 0.45);
  sun.position.set(SUN_DIR.x * 40, 14, SUN_DIR.z * 40);
  scene.add(sun);

  const spot = (x, z, color, intensity, angle = 0.55, ty = 0, tz = z) => {
    const s = new THREE.SpotLight(color, intensity, 0, angle, 0.6, 1.6);
    s.position.set(x, H - 0.3, z);
    s.target.position.set(x, ty, tz);
    scene.add(s, s.target);
    return s;
  };
  // Warm wing spots and gold hero spots (kept few for 60 fps)
  const spotCount = quality.high ? [-38, -24, 24, 38] : [-30, 30];
  spotCount.forEach((x) => {
    spot(x, -7, 0xffd2a0, 90, 0.7);
    spot(x, 7, 0xffd2a0, 90, 0.7);
  });
  // hero key lights: angled onto the display so the floor doesn't get a hot spot
  spot(0, 7, 0xffc670, 70, 0.32, 3, 0);
  spot(0, -7, 0xffc670, 70, 0.32, 3, 0);

  // ------------------------------------------------------------ floor
  const concrete = createConcreteTexture();
  concrete.repeat.set(W / 6, D / 6);
  const floorMat = new THREE.MeshStandardMaterial({
    map: concrete,
    color: 0x9a9aa2,
    roughness: 0.42,
    metalness: 0.1,
    envMapIntensity: 0.6,
    transparent: !!quality.reflections,
    opacity: quality.reflections ? 0.78 : 1,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), floorMat);
  floor.position.y = 0.004;
  floor.renderOrder = -2;
  floor.name = 'floor';
  scene.add(floor);

  let reflector = null;
  if (quality.reflections) {
    const scale = 0.5 * Math.min(window.devicePixelRatio, 1.5);
    reflector = new Reflector(new THREE.PlaneGeometry(W, D), {
      clipBias: 0.003,
      textureWidth: Math.round(window.innerWidth * scale),
      textureHeight: Math.round(window.innerHeight * scale),
      color: 0x8a8a90,
    });
    reflector.rotation.x = -Math.PI / 2;
    reflector.renderOrder = -3;
    scene.add(reflector);
  }

  // ------------------------------------------------------------ walls & ceiling
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x17141c, roughness: 0.85, metalness: 0.05 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1c1a20, roughness: 0.35, metalness: 0.85 });

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(Math.PI / 2), wallMat);
  ceiling.position.y = H;
  scene.add(ceiling);

  const front = new THREE.Mesh(new THREE.PlaneGeometry(W, H), wallMat);
  front.position.set(0, H / 2, ROOM.maxZ);
  front.rotation.y = Math.PI;
  scene.add(front);

  for (const side of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(D, H), wallMat);
    w.position.set(side * ROOM.maxX, H / 2, 0);
    w.rotation.y = -side * (Math.PI / 2);
    scene.add(w);
  }

  // Back wall: large glass windows with a sunset view
  const sillH = 0.6;
  const headerY = 7.4;
  const sill = new THREE.Mesh(new THREE.BoxGeometry(W, sillH, 0.4), darkMetal);
  sill.position.set(0, sillH / 2, ROOM.minZ);
  const header = new THREE.Mesh(new THREE.BoxGeometry(W, H - headerY, 0.4), wallMat);
  header.position.set(0, headerY + (H - headerY) / 2, ROOM.minZ);
  scene.add(sill, header);

  const mullionGeo = new THREE.BoxGeometry(0.14, headerY - sillH, 0.22);
  const mullions = new THREE.InstancedMesh(mullionGeo, darkMetal, 21);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i <= 20; i++) {
    m4.makeTranslation(ROOM.minX + i * 5, sillH + (headerY - sillH) / 2, ROOM.minZ);
    mullions.setMatrixAt(i, m4);
  }
  scene.add(mullions);
  const transom = new THREE.Mesh(new THREE.BoxGeometry(W, 0.1, 0.18), darkMetal);
  transom.position.set(0, 5.2, ROOM.minZ);
  scene.add(transom);

  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(W, headerY - sillH),
    new THREE.MeshStandardMaterial({
      color: 0x9fb4c8,
      roughness: 0.05,
      metalness: 0.6,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
      envMapIntensity: 0.4,
    }),
  );
  glass.position.set(0, sillH + (headerY - sillH) / 2, ROOM.minZ + 0.02);
  scene.add(glass);

  // ------------------------------------------------------------ LED strips
  const warmLed = glowMaterial(0xffb070, 2.2);
  const roadLed = glowMaterial(ACCENT.road, 2.4);
  const mtbLed = glowMaterial(ACCENT.mountain, 2.4);
  const goldLed = glowMaterial(ACCENT.gold, 2.6);

  const strip = (len, mat, x, y, z, axis = 'x', thick = 0.05) => {
    const geo =
      axis === 'x'
        ? new THREE.BoxGeometry(len, thick, thick)
        : axis === 'y'
          ? new THREE.BoxGeometry(thick, len, thick)
          : new THREE.BoxGeometry(thick, thick, len);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    scene.add(m);
    return m;
  };
  // ceiling light lines
  for (const z of [-11, -3.2, 3.2, 11]) {
    strip(39, roadLed, -29.5, H - 0.05, z);
    strip(39, mtbLed, 29.5, H - 0.05, z);
  }
  // atrium ceiling halo
  const halo = new THREE.Mesh(new THREE.TorusGeometry(5.5, 0.05, 8, 96).rotateX(Math.PI / 2), goldLed);
  halo.position.y = H - 0.15;
  scene.add(halo);
  const halo2 = new THREE.Mesh(new THREE.TorusGeometry(3.5, 0.04, 8, 96).rotateX(Math.PI / 2), warmLed);
  halo2.position.y = H - 0.15;
  scene.add(halo2);
  // cove lighting along walls (floor + ceiling)
  strip(W, warmLed, 0, 0.05, ROOM.maxZ - 0.05);
  strip(W, warmLed, 0, H - 0.6, ROOM.maxZ - 0.05);
  strip(W, warmLed, 0, sillH + 0.03, ROOM.minZ + 0.22);
  for (const side of [-1, 1]) {
    const mat = side < 0 ? roadLed : mtbLed;
    strip(D, mat, side * (ROOM.maxX - 0.05), 0.05, 0, 'z');
    strip(D, mat, side * (ROOM.maxX - 0.05), H - 0.6, 0, 'z');
    // aisle guide lines in the floor
    for (const z of [-2.6, 2.6]) strip(38, mat, side * 29.5, 0.012, z, 'x', 0.03);
  }

  // ------------------------------------------------------------ wing portals & signs
  const signGeo = new THREE.PlaneGeometry(7, 1.3125);
  const makeSign = (text, color, sub) =>
    new THREE.MeshBasicMaterial({
      map: createSignTexture(text, color, { sub }),
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
  const roadSignMat = makeSign('ROAD', ACCENT.road, 'WING  ·  15 BIKES');
  const mtbSignMat = makeSign('MOUNTAIN', ACCENT.mountain, 'WING  ·  15 BIKES');

  for (const side of [-1, 1]) {
    const mat = side < 0 ? roadLed : mtbLed;
    const x = side * 9.6;
    // portal arch
    for (const z of [-5.2, 5.2]) strip(7.2, mat, x, 3.6, z, 'y');
    strip(10.4, mat, x, 7.2, 0, 'z');
    // sign above the portal facing the atrium
    const s = new THREE.Mesh(signGeo, side < 0 ? roadSignMat : mtbSignMat);
    s.position.set(x, 8.05, 0);
    s.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    scene.add(s);
    // sign on the end wall
    const e = new THREE.Mesh(signGeo, side < 0 ? roadSignMat : mtbSignMat);
    e.scale.setScalar(1.6);
    e.position.set(side * (ROOM.maxX - 0.08), 5.6, 0);
    e.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    scene.add(e);
  }

  // Logo signs
  const logoMat = new THREE.MeshBasicMaterial({
    map: createSignTexture('VELO VR', ACCENT.gold, { sub: 'VIRTUAL  BICYCLE  SHOWROOM' }),
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  const logoGeo = new THREE.PlaneGeometry(8, 1.5);
  for (const x of [-27, 27]) {
    const l = new THREE.Mesh(logoGeo, logoMat);
    l.position.set(x, 8.2, ROOM.minZ + 0.22);
    scene.add(l);
  }
  const logoFront = new THREE.Mesh(logoGeo, logoMat);
  logoFront.position.set(0, 6, ROOM.maxZ - 0.05);
  logoFront.rotation.y = Math.PI;
  logoFront.scale.setScalar(1.4);
  scene.add(logoFront);

  // ------------------------------------------------------------ atrium floor inlay
  const inlay = new THREE.Mesh(
    new THREE.CircleGeometry(6.2, 96).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x0c0b10, roughness: 0.15, metalness: 0.6, transparent: true, opacity: 0.85 }),
  );
  inlay.position.y = 0.008;
  inlay.renderOrder = -1;
  scene.add(inlay);
  const ringMat = glowMaterial(ACCENT.gold, 2.2, { transparent: true, side: THREE.DoubleSide });
  const ring1 = new THREE.Mesh(new THREE.RingGeometry(6.15, 6.25, 128).rotateX(-Math.PI / 2), ringMat);
  ring1.position.y = 0.012;
  const ring2 = new THREE.Mesh(new THREE.RingGeometry(3.6, 3.66, 128).rotateX(-Math.PI / 2), ringMat);
  ring2.position.y = 0.012;
  scene.add(ring1, ring2);
  updaters.push((dt, t) => {
    ringMat.color.setStyle(ACCENT.gold).multiplyScalar(1.8 + Math.sin(t * 1.6) * 0.6);
  });

  // ------------------------------------------------------------ benches (simple luxury seating)
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x2a2026, roughness: 0.6, metalness: 0.1 });
  const benchGeo = new THREE.BoxGeometry(2.6, 0.42, 0.8);
  for (const [x, z] of [[-7, 9.5], [7, 9.5], [-7, -10.5], [7, -10.5]]) {
    const b = new THREE.Mesh(benchGeo, benchMat);
    b.position.set(x, 0.21, z);
    scene.add(b);
  }

  return {
    floor,
    reflector,
    floorMat,
    /** Hide expensive reflections in VR (and use an opaque floor). */
    setXRMode(on) {
      if (!reflector) return;
      reflector.visible = !on;
      floorMat.transparent = !on;
      floorMat.opacity = on ? 1 : 0.78;
      floorMat.needsUpdate = true;
    },
    update(dt, t) {
      for (const u of updaters) u(dt, t);
    },
  };
}
