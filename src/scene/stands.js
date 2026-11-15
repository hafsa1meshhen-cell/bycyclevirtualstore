import * as THREE from 'three';
import { glowMaterial, beamMaterial, ROOM } from './showroom.js';
import { createFeatherMask, createHaloTexture, createLabelTexture, ACCENT } from './textures.js';

const PANEL_W = 2.4;
const PANEL_H = PANEL_W / 1.79;
const PANEL_Y = 1.72;
const SPACING = 4.6;

/** World layout for a wing stand: back row (z=-7) faces +z, front row (z=+7) faces -z. */
export function standLayout(product) {
  const side = product.category === 'road' ? -1 : 1;
  const i = product.number - 1;
  const back = i < 8;
  const k = back ? i : i - 8;
  const x = side * (12 + k * SPACING + (back ? 0 : SPACING / 2));
  const z = back ? -7 : 7;
  return { x, z, rotY: back ? 0 : Math.PI, facing: new THREE.Vector3(0, 0, back ? 1 : -1) };
}

// ---------------------------------------------------------------- shared resources
const geo = {
  base: new THREE.CylinderGeometry(0.98, 1.08, 0.32, 48),
  ring: new THREE.TorusGeometry(1.03, 0.022, 8, 72).rotateX(Math.PI / 2),
  disc: new THREE.CylinderGeometry(0.86, 0.86, 0.05, 48),
  post: new THREE.CylinderGeometry(0.035, 0.035, 0.7, 12),
  slab: new THREE.BoxGeometry(PANEL_W + 0.06, PANEL_H + 0.06, 0.035),
  panel: new THREE.PlaneGeometry(PANEL_W, PANEL_H),
  edge: new THREE.BoxGeometry(PANEL_W + 0.1, 0.022, 0.05),
  halo: new THREE.PlaneGeometry(PANEL_W * 1.23, PANEL_H * 1.45),
  label: new THREE.PlaneGeometry(1.5, 0.375),
  beam: new THREE.ConeGeometry(1.35, 7.4, 32, 1, true),
  hit: new THREE.CylinderGeometry(1.35, 1.35, 2.9, 12),
};
geo.beam.translate(0, -3.7, 0); // apex at origin
let shared = null;
function getShared() {
  if (shared) return shared;
  shared = {
    baseMat: new THREE.MeshStandardMaterial({ color: 0x141217, roughness: 0.28, metalness: 0.9 }),
    discMat: new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.12, metalness: 0.5 }),
    slabMat: new THREE.MeshStandardMaterial({ color: 0x0d0c10, roughness: 0.2, metalness: 0.7 }),
    feather: createFeatherMask(),
    haloTex: createHaloTexture(),
    edge: { road: glowMaterial(ACCENT.road, 2.4), mountain: glowMaterial(ACCENT.mountain, 2.4), gold: glowMaterial(ACCENT.gold, 2.8) },
    beam: { road: beamMaterial(0xbfe9ff, 0.09), mountain: beamMaterial(0xffd6a0, 0.09) },
    hitMat: new THREE.MeshBasicMaterial({ visible: false }),
  };
  return shared;
}

function photoMaterial(texture, feather) {
  return new THREE.MeshBasicMaterial({
    map: texture,
    alphaMap: feather,
    transparent: true,
    toneMapped: false,
    color: new THREE.Color(0.86, 0.86, 0.88),
  });
}

/**
 * Builds one illuminated stand per product.
 * Returns { stands, hitTargets, byId, update(dt, t, hoveredOwner, focusOwner), setMatches(set) }
 */
export function buildStands({ scene, products, images }) {
  const S = getShared();
  const stands = [];
  const hitTargets = [];
  const byId = new Map();

  for (const product of products) {
    const L = standLayout(product);
    const accentKey = product.limited ? 'gold' : product.category;
    const accentHex = product.limited ? ACCENT.gold : ACCENT[product.category];
    const tex = images.get(product.id).texture;

    const root = new THREE.Group();
    root.position.set(L.x, 0, L.z);
    root.rotation.y = L.rotY;
    root.name = `stand-${product.id}`;

    const base = new THREE.Mesh(geo.base, S.baseMat);
    base.position.y = 0.16;
    const ringMat = glowMaterial(accentHex, 2.2);
    const ring = new THREE.Mesh(geo.ring, ringMat);
    ring.position.y = 0.33;
    root.add(base, ring);

    // rotating turntable with the floating photo panel
    const turntable = new THREE.Group();
    turntable.position.y = 0.34;
    const disc = new THREE.Mesh(geo.disc, S.discMat);
    disc.position.y = 0.025;
    const post = new THREE.Mesh(geo.post, S.baseMat);
    post.position.y = 0.4;
    turntable.add(disc, post);

    const lift = new THREE.Group();
    lift.position.y = PANEL_Y - 0.34;
    const slab = new THREE.Mesh(geo.slab, S.slabMat);
    const frontMat = photoMaterial(tex, S.feather);
    const backMat = photoMaterial(tex, S.feather);
    const front = new THREE.Mesh(geo.panel, frontMat);
    front.position.z = 0.02;
    const back = new THREE.Mesh(geo.panel, backMat);
    back.position.z = -0.02;
    back.rotation.y = Math.PI; // shows the mirrored "other side" of the bike
    const edgeTop = new THREE.Mesh(geo.edge, S.edge[accentKey]);
    edgeTop.position.y = PANEL_H / 2 + 0.04;
    const edgeBottom = edgeTop.clone();
    edgeBottom.position.y = -PANEL_H / 2 - 0.04;
    const haloMat = new THREE.MeshBasicMaterial({
      map: S.haloTex,
      color: new THREE.Color(accentHex).multiplyScalar(1.6),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const halo = new THREE.Mesh(geo.halo, haloMat);
    halo.visible = false;
    lift.add(halo, slab, front, back, edgeTop, edgeBottom);
    turntable.add(lift);
    turntable.rotation.y = (product.number * 0.9) % (Math.PI * 2);
    root.add(turntable);

    // name + price label (static, tilted towards the visitor)
    const labelMat = new THREE.MeshBasicMaterial({
      map: createLabelTexture(product),
      transparent: true,
      toneMapped: false,
      depthWrite: false,
    });
    const label = new THREE.Mesh(geo.label, labelMat);
    label.position.set(0, 0.62, 1.2);
    label.rotation.x = -0.32;
    root.add(label);

    // light beam from the ceiling
    const beam = new THREE.Mesh(geo.beam, S.beam[product.category]);
    beam.position.y = ROOM.height - 0.05;
    root.add(beam);

    // invisible pick volume
    const hit = new THREE.Mesh(geo.hit, S.hitMat);
    hit.position.y = 1.5;
    root.add(hit);

    scene.add(root);

    const stand = {
      kind: 'stand',
      product,
      root,
      turntable,
      lift,
      halo,
      haloMat,
      ringMat,
      ringBase: new THREE.Color(accentHex),
      photoMats: [frontMat, backMat],
      labelMat,
      center: new THREE.Vector3(L.x, PANEL_Y, L.z),
      facing: L.facing,
      approach: new THREE.Vector3(L.x, 1.6, L.z).addScaledVector(L.facing, 3.8),
      obstacle: { x: L.x, z: L.z, r: 1.35 },
      state: { hover: 0, dim: 0, targetDim: 0, spin: 0.32 },
    };
    hit.userData.pick = { owner: stand, product };
    stands.push(stand);
    hitTargets.push(hit);
    byId.set(product.id, stand);
  }

  const TWO_PI = Math.PI * 2;

  return {
    stands,
    hitTargets,
    byId,
    setMatches(matchSet) {
      for (const s of stands) s.state.targetDim = matchSet.has(s.product.id) ? 0 : 1;
    },
    update(dt, t, hoveredOwner, focusOwner) {
      const k = 1 - Math.exp(-dt * 8);
      for (const s of stands) {
        const st = s.state;
        const isHover = s === hoveredOwner;
        const isFocus = s === focusOwner;
        st.hover += ((isHover || isFocus ? 1 : 0) - st.hover) * k;
        st.dim += (st.targetDim - st.dim) * k;

        // rotation: spin slowly; pause on hover; face front when focused (test ride)
        if (isFocus) {
          const r = s.turntable.rotation.y % TWO_PI;
          const target = r > Math.PI ? TWO_PI : 0;
          s.turntable.rotation.y = r + (target - r) * k;
        } else {
          s.turntable.rotation.y += dt * st.spin * (1 - st.hover) * (1 - st.dim * 0.7);
        }

        // lift + glow
        s.lift.position.y = PANEL_Y - 0.34 + st.hover * 0.18 + Math.sin(t * 1.2 + s.product.number) * 0.03;
        s.lift.scale.setScalar(1 + st.hover * 0.06);
        s.halo.visible = st.hover > 0.02;
        s.haloMat.opacity = st.hover * 0.85;
        const glow = (1.6 + st.hover * 2.4) * (1 - st.dim * 0.8);
        s.ringMat.color.copy(s.ringBase).multiplyScalar(glow);

        const op = 1 - st.dim * 0.82;
        s.photoMats[0].opacity = s.photoMats[1].opacity = op;
        s.labelMat.opacity = 1 - st.dim * 0.75;
      }
    },
  };
}
