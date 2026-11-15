import * as THREE from 'three';
import { glowMaterial, beamMaterial } from './showroom.js';
import { createFeatherMask, createDotTexture, createSignTexture, ACCENT } from './textures.js';

const HERO_W = 5.4;
const HERO_H = HERO_W / 1.79;
const HERO_Y = 3.0;

function heroTexture(entry, maxAnisotropy) {
  if (entry.image) {
    const t = new THREE.Texture(entry.image);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, maxAnisotropy);
    t.needsUpdate = true;
    return t;
  }
  return entry.texture;
}

/** Central atrium: rotating double-sided hero display (Road #15 front, Mountain #15 back) + particles. */
export function buildHero({ scene, roadHero, mountainHero, images, maxAnisotropy = 8, particleCount = 700 }) {
  const group = new THREE.Group();
  group.name = 'hero';
  scene.add(group);

  const gold = new THREE.MeshStandardMaterial({ color: 0xd6a24a, roughness: 0.22, metalness: 1, envMapIntensity: 1.2 });
  const black = new THREE.MeshStandardMaterial({ color: 0x0b0a0d, roughness: 0.18, metalness: 0.8 });

  // podium
  const p1 = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 0.36, 64), black);
  p1.position.y = 0.18;
  const p2 = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.3, 0.22, 64), black);
  p2.position.y = 0.47;
  const goldRing = new THREE.Mesh(new THREE.TorusGeometry(2.62, 0.035, 10, 120).rotateX(Math.PI / 2), glowMaterial(ACCENT.gold, 2.6));
  goldRing.position.y = 0.37;
  const goldRing2 = new THREE.Mesh(new THREE.TorusGeometry(2.12, 0.03, 10, 120).rotateX(Math.PI / 2), gold);
  goldRing2.position.y = 0.59;
  group.add(p1, p2, goldRing, goldRing2);

  // rotating display
  const spinner = new THREE.Group();
  spinner.position.y = 0.6;
  group.add(spinner);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, HERO_Y - HERO_H / 2 - 0.6, 16), gold);
  column.position.y = (HERO_Y - HERO_H / 2 - 0.6) / 2;
  spinner.add(column);

  const display = new THREE.Group();
  display.position.y = HERO_Y - 0.6;
  spinner.add(display);

  const feather = createFeatherMask(320, 180, 16, 14);
  const photoMat = (tex) =>
    new THREE.MeshBasicMaterial({ map: tex, alphaMap: feather, transparent: true, toneMapped: false, color: new THREE.Color(0.88, 0.88, 0.9) });

  const slab = new THREE.Mesh(new THREE.BoxGeometry(HERO_W + 0.1, HERO_H + 0.1, 0.05), black);
  const panelGeo = new THREE.PlaneGeometry(HERO_W, HERO_H);
  const front = new THREE.Mesh(panelGeo, photoMat(heroTexture(images.get(roadHero.id), maxAnisotropy)));
  front.position.z = 0.03;
  const back = new THREE.Mesh(panelGeo, photoMat(heroTexture(images.get(mountainHero.id), maxAnisotropy)));
  back.position.z = -0.03;
  back.rotation.y = Math.PI;
  display.add(slab, front, back);

  // gold frame
  const fw = 0.06;
  const frameH = new THREE.BoxGeometry(HERO_W + 0.22, fw, 0.09);
  const frameV = new THREE.BoxGeometry(fw, HERO_H + 0.22, 0.09);
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(frameH, gold);
    h.position.y = s * (HERO_H / 2 + 0.08);
    const v = new THREE.Mesh(frameV, gold);
    v.position.x = s * (HERO_W / 2 + 0.08);
    display.add(h, v);
  }
  const glowEdge = glowMaterial(ACCENT.gold, 3);
  const glowLine = new THREE.Mesh(new THREE.BoxGeometry(HERO_W + 0.3, 0.025, 0.12), glowEdge);
  glowLine.position.y = -HERO_H / 2 - 0.16;
  display.add(glowLine);

  // orbit rings
  const orbitMat = glowMaterial(ACCENT.gold, 1.8, { transparent: true, opacity: 0.85 });
  const orbitA = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.018, 8, 160), orbitMat);
  const orbitB = new THREE.Mesh(new THREE.TorusGeometry(3.9, 0.012, 8, 160), orbitMat);
  orbitA.position.y = orbitB.position.y = HERO_Y;
  group.add(orbitA, orbitB);

  // light beam
  const beam = new THREE.Mesh(new THREE.ConeGeometry(3.4, 8.6, 48, 1, true).translate(0, -4.3, 0), beamMaterial(0xffd38a, 0.07));
  beam.position.y = 8.9;
  group.add(beam);

  // "Limited edition" sign above
  const signMat = new THREE.MeshBasicMaterial({
    map: createSignTexture('LIMITED EDITION', ACCENT.gold, { size: 170, sub: 'BLACK & GOLD  ·  1 OF 50' }),
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.975), signMat);
  sign.position.y = HERO_Y + HERO_H / 2 + 1.05;
  group.add(sign);

  // floating golden particles (animated fully on the GPU)
  const count = particleCount;
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const r = 1.2 + Math.random() * 6.5;
    const a = Math.random() * Math.PI * 2;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = Math.random() * 8.5;
    pos[i * 3 + 2] = Math.sin(a) * r;
    seed[i] = Math.random();
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pGeo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const pMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 }, map: { value: createDotTexture() }, scale: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float seed; uniform float time; uniform float scale; varying float vA;
      void main() {
        vec3 p = position;
        p.y = mod(p.y + time * (0.12 + seed * 0.25), 8.5);
        float ang = time * (0.05 + seed * 0.08);
        float c = cos(ang), s = sin(ang);
        p.xz = mat2(c, -s, s, c) * p.xz;
        p.x += sin(time * 0.7 + seed * 40.0) * 0.15;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = scale * (10.0 + seed * 16.0) / max(-mv.z, 0.5);
        vA = smoothstep(0.0, 1.0, p.y) * (1.0 - smoothstep(7.0, 8.5, p.y)) * (0.55 + 0.45 * sin(time * 2.0 + seed * 30.0));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map; varying float vA;
      void main() {
        vec4 tex = texture2D(map, gl_PointCoord);
        gl_FragColor = vec4(vec3(1.0, 0.78, 0.42) * 2.2 * tex.a * vA, tex.a * vA);
      }`,
  });
  const particles = new THREE.Points(pGeo, pMat);
  particles.frustumCulled = false;
  group.add(particles);

  // pick volume – which product depends on the side facing the viewer
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 2.9, HERO_H + 3, 16), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = HERO_Y - 0.7;
  group.add(hit);

  const center = new THREE.Vector3(0, HERO_Y, 0);
  const tmpN = new THREE.Vector3();
  const tmpV = new THREE.Vector3();

  const hero = {
    kind: 'hero',
    group,
    center,
    hit,
    approach: new THREE.Vector3(0, 1.7, 7.5),
    obstacle: { x: 0, z: 0, r: 3.1 },
    state: { hover: 0 },
    products: { front: roadHero, back: mountainHero },
    /** Product on the side of the display facing the given world position. */
    productFacing(worldPos) {
      tmpN.set(0, 0, 1).applyQuaternion(spinner.quaternion);
      tmpV.subVectors(worldPos, center);
      return tmpN.dot(tmpV) >= 0 ? roadHero : mountainHero;
    },
    /** Rotate the display so that the given product faces +z (the default approach). */
    focusProduct: null,
    setPixelScale(s) {
      pMat.uniforms.scale.value = s;
    },
    update(dt, t, hovered, focusOwner, camPos) {
      const k = 1 - Math.exp(-dt * 6);
      const isFocus = focusOwner === hero;
      hero.state.hover += ((hovered === hero || isFocus ? 1 : 0) - hero.state.hover) * k;
      if (isFocus && hero.focusProduct) {
        const TWO = Math.PI * 2;
        const want = hero.focusProduct === roadHero ? 0 : Math.PI;
        let r = spinner.rotation.y % TWO;
        if (r < 0) r += TWO;
        let d = want - r;
        if (d > Math.PI) d -= TWO;
        if (d < -Math.PI) d += TWO;
        spinner.rotation.y = r + d * k;
      } else {
        spinner.rotation.y += dt * 0.28 * (1 - hero.state.hover * 0.9);
      }
      display.position.y = HERO_Y - 0.6 + Math.sin(t * 0.9) * 0.06 + hero.state.hover * 0.12;
      orbitA.rotation.set(Math.PI / 2 + Math.sin(t * 0.4) * 0.35, t * 0.3, 0);
      orbitB.rotation.set(Math.PI / 2 + Math.cos(t * 0.33) * 0.45, -t * 0.22, 0.3);
      glowEdge.color.setStyle(ACCENT.gold).multiplyScalar(2.4 + hero.state.hover * 2 + Math.sin(t * 2) * 0.4);
      if (camPos) sign.lookAt(camPos.x, sign.position.y, camPos.z);
      pMat.uniforms.time.value = t;
    },
  };
  hit.userData.pick = { owner: hero, product: null };
  return hero;
}
