import './styles.css';
import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { PRODUCTS, PRODUCT_BY_ID } from './data/products.js';
import { buildShowroom, ROOM } from './scene/showroom.js';
import { buildStands } from './scene/stands.js';
import { buildHero } from './scene/hero.js';
import { loadBikeImages } from './scene/textures.js';
import { createControls, createJoystick } from './scene/controls.js';
import { createXR } from './scene/xr.js';
import { createVRPanel } from './scene/vrPanel.js';
import { createTestRide } from './scene/testRide.js';
import { cameraWorldYaw } from './scene/rig.js';

import { initTopbar } from './ui/topbar.js';
import { createProductPanel } from './ui/productPanel.js';
import { createCart } from './ui/cart.js';
import { createGallery } from './ui/gallery.js';
import { createMinimap } from './ui/minimap.js';
import { filters } from './ui/filters.js';
import { store } from './ui/store.js';
import { audio } from './ui/audio.js';
import { aed } from './ui/format.js';
import { toast } from './ui/toast.js';

const $ = (id) => document.getElementById(id);

// ============================================================== quality profile
const isTouch = matchMedia('(pointer: coarse)').matches;
const cores = navigator.hardwareConcurrency || 8;
const quality = {
  high: !isTouch && cores > 4,
  reflections: !isTouch,
  bloom: !isTouch,
};
const PIXEL_RATIO = Math.min(window.devicePixelRatio || 1, 2);

// ============================================================== renderer / scene
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(PIXEL_RATIO);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFoveation?.(1);
const canvas = renderer.domElement;
canvas.setAttribute('aria-label', '3D showroom view. Click to look around.');
canvas.tabIndex = 0;
$('stage').appendChild(canvas);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 1000);
const player = new THREE.Group();
player.name = 'player-rig';
player.add(camera);
scene.add(player);
camera.position.set(0, 2.1, 13);
camera.lookAt(0, 2.6, 0);

const showroom = buildShowroom({ scene, renderer, quality });

let composer = null;
if (quality.bloom) {
  composer = new EffectComposer(renderer);
  composer.setPixelRatio(PIXEL_RATIO);
  composer.setSize(window.innerWidth, window.innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.6, 0.55, 0.82));
  composer.addPass(new OutputPass());
}

// ============================================================== UI
const loaderEl = $('loader');
const loaderBar = $('loaderBar');
const loaderStatus = $('loaderStatus');
const hintEl = $('hint');
const crosshair = $('crosshair');
const joystickEl = $('joystick');
const rideBanner = $('rideBanner');

let entered = false;
let ready = false;
let world = null; // filled once textures are loaded

const topbar = initTopbar({
  onToggleGallery: () => (gallery.isOpen ? closeGallery() : openGallery()),
  onOpenCart: () => {
    testRide?.skip();
    controls?.unlock();
    cart.toggle();
  },
  onEnterVR: () => enterVR(),
});

const productPanel = createProductPanel({
  onTestRide: (p) => startTestRide(p),
  onLocate: (p) => locate(p.id),
  onClose: () => {
    panelOwner = null;
    updateHint();
  },
});
const cart = createCart({ onBrowse: () => closeGallery() });
const gallery = createGallery({
  onView: (id) => openProduct(PRODUCT_BY_ID.get(id), world?.stands.byId.get(id) ?? null),
  onLocate: (id) => locate(id),
});

// ============================================================== loading
function setProgress(p) {
  const pct = Math.round(p * 100);
  loaderBar.style.width = `${pct}%`;
  loaderBar.parentElement.setAttribute('aria-valuenow', String(pct));
  loaderStatus.textContent = p < 1 ? `Polishing the showroom… ${pct}%` : 'Showroom ready';
}
const manager = new THREE.LoadingManager();
manager.onProgress = (_url, loaded, total) => setProgress((loaded / total) * 0.92);

const fontsReady = Promise.race([
  Promise.all([
    document.fonts?.load('700 64px Outfit'),
    document.fonts?.load('800 64px Outfit'),
    document.fonts?.load('600 30px Inter'),
  ]).catch(() => {}),
  new Promise((r) => setTimeout(r, 2500)),
]);

let controls = null;
let xr = null;
let vrPanel = null;
let testRide = null;
let minimap = null;
let hitTargets = [];
const obstacles = [];

Promise.all([loadBikeImages(PRODUCTS, manager, renderer.capabilities.getMaxAnisotropy()), fontsReady])
  .then(([images]) => buildWorld(images))
  .catch((err) => {
    console.error(err);
    loaderStatus.textContent = 'Something went wrong while loading. Please refresh.';
  });

function buildWorld(images) {
  const stands = buildStands({ scene, products: PRODUCTS, images });
  const hero = buildHero({
    scene,
    roadHero: PRODUCT_BY_ID.get('road-15'),
    mountainHero: PRODUCT_BY_ID.get('mountain-15'),
    images,
    maxAnisotropy: renderer.capabilities.getMaxAnisotropy(),
    particleCount: quality.high ? 800 : 400,
  });
  hero.setPixelScale(PIXEL_RATIO * (window.innerHeight / 900) * 1.4);
  world = { stands, hero, images };

  obstacles.push(...stands.stands.map((s) => s.obstacle), hero.obstacle);
  for (const [x, z] of [[-7, 9.5], [7, 9.5], [-7, -10.5], [7, -10.5]]) obstacles.push({ x, z, r: 1.2 });
  hitTargets = [...stands.hitTargets, hero.hit];

  const joystick = isTouch ? createJoystick(joystickEl) : null;
  controls = createControls({ camera, dom: canvas, room: ROOM, obstacles, joystick });
  controls.onTap(onTap);
  controls.plc.addEventListener('lock', updateHint);
  controls.plc.addEventListener('unlock', updateHint);

  vrPanel = createVRPanel({
    images,
    onTestRide: (p) => startTestRide(p),
    onAction: (id) => id === 'cart' && audio.success(),
  });
  scene.add(vrPanel.mesh);
  store.subscribe(() => vrPanel.refresh());

  xr = createXR({
    renderer,
    scene,
    player,
    camera,
    hitTargets,
    vrPanel,
    room: ROOM,
    obstacles,
    onSelect: (product, owner) => openProduct(product, owner),
    sounds: audio,
  });

  testRide = createTestRide({ camera, player, renderer });

  minimap = createMinimap({
    canvas: $('minimapCanvas'),
    room: ROOM,
    stands: stands.stands,
    onTeleport: (x, z) => {
      if (!entered || testRide.active) return;
      const p = new THREE.Vector3(x, 1.65, z);
      controls.resolveCollisions(p);
      camera.position.set(p.x, 1.65, p.z);
      audio.whoosh(0.5);
    },
  });

  const applyFilters = () => {
    const matches = new Set(filters.apply().map((p) => p.id));
    stands.setMatches(matches);
  };
  filters.subscribe(applyFilters);
  store.subscribe((r) => r === 'wishlist' && filters.state.wishlistOnly && applyFilters());
  applyFilters();

  // warm up shaders/textures so the first frames don't stutter
  renderer.compile(scene, camera);

  ready = true;
  setProgress(1);
  $('enterBtn').disabled = false;
  $('enterBtn').focus({ preventScroll: true });
}

// ============================================================== enter / VR
function enterShowroom({ lock = true } = {}) {
  if (!ready) return;
  audio.init();
  if (!entered) {
    entered = true;
    loaderEl.classList.add('hide');
    setTimeout(() => (loaderEl.hidden = true), 900);
    controls.setPose(new THREE.Vector3(0, 1.65, 12.5), new THREE.Vector3(0, 2.4, 0));
    document.body.classList.add('entered');
    joystickEl.hidden = !isTouch;
    audio.whoosh(1.1);
  }
  if (lock && controls.canLock) controls.lock();
  updateHint();
}
$('enterBtn').addEventListener('click', () => enterShowroom());
$('enterGalleryBtn').addEventListener('click', () => {
  if (ready) enterShowroom({ lock: false });
  else audio.init();
  openGallery();
});

const vrButton = VRButton.createButton(renderer);
$('vrButtonHost').appendChild(vrButton);
if ('xr' in navigator) {
  navigator.xr
    .isSessionSupported('immersive-vr')
    .then((ok) => {
      if (!ok) return;
      $('enterVrBtn').hidden = false;
      topbar.showVR(true);
    })
    .catch(() => {});
}
function enterVR() {
  if (!ready) return;
  audio.init();
  enterShowroom({ lock: false });
  vrButton.click();
}
$('enterVrBtn').addEventListener('click', enterVR);

renderer.xr.addEventListener('sessionstart', () => {
  closeAllOverlays();
  controls.unlock();
  const yaw = controls.getYaw();
  player.position.set(camera.position.x, 0, camera.position.z);
  player.rotation.set(0, yaw, 0);
  showroom.setXRMode(true);
  document.body.classList.add('in-vr');
});
renderer.xr.addEventListener('sessionend', () => {
  const p = camera.getWorldPosition(new THREE.Vector3());
  const yaw = cameraWorldYaw(camera);
  player.position.set(0, 0, 0);
  player.rotation.set(0, 0, 0);
  player.updateMatrixWorld(true);
  camera.position.set(p.x, 1.65, p.z);
  camera.quaternion.setFromEuler(new THREE.Euler(0, yaw, 0, 'YXZ'));
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  vrPanel.close();
  showroom.setXRMode(false);
  document.body.classList.remove('in-vr');
  onResize();
});

// ============================================================== interaction
const raycaster = new THREE.Raycaster();
raycaster.far = 30;
const ndc = new THREE.Vector2();
const CENTER = new THREE.Vector2(0, 0);
let hovered = null; // stand or hero
let hoveredProduct = null;
let panelOwner = null;
let locateFocus = null;

function pickAt(point) {
  raycaster.setFromCamera(point, camera);
  const h = raycaster.intersectObjects(hitTargets, false)[0];
  if (!h) return null;
  const { owner, product } = h.object.userData.pick;
  return { owner, product: product || owner.productFacing(camera.getWorldPosition(new THREE.Vector3())) };
}

const uiBlocking = () => productPanel.isOpen || cart.isOpen || gallery.isOpen || (testRide && testRide.active);

function onTap({ x, y, pointerType, locked }) {
  if (!entered || uiBlocking()) return;
  const hit = pickAt(locked ? CENTER : ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1));
  if (hit) {
    audio.click();
    openProduct(hit.product, hit.owner);
  } else if (pointerType === 'mouse' && !locked) {
    audio.init();
    controls.lock();
  }
}

function openProduct(product, owner) {
  if (!product) return;
  panelOwner = owner || world?.stands.byId.get(product.id) || null;
  if (panelOwner?.kind === 'hero') panelOwner.focusProduct = product;
  if (renderer.xr.isPresenting) {
    vrPanel.open(product, camera);
    audio.whoosh(0.4);
    return;
  }
  controls?.unlock();
  productPanel.open(product);
}

function locate(id) {
  if (!world) return;
  const stand = world.stands.byId.get(id);
  if (!stand) return;
  if (!entered) enterShowroom({ lock: false });
  closeGallery();
  productPanel.close(false);
  controls.setPose(stand.approach, stand.center);
  locateFocus = { owner: stand, until: performance.now() + 3500 };
  audio.whoosh(0.6);
  toast(`${stand.product.name} – right in front of you`, { icon: '◎' });
  updateHint();
}

function startTestRide(product) {
  if (!world || testRide.active) return;
  let owner = panelOwner && (panelOwner.product === product || panelOwner.kind === 'hero') ? panelOwner : null;
  owner = owner || world.stands.byId.get(product.id);
  let approach = owner.approach;
  if (owner.kind === 'hero') {
    owner.focusProduct = product;
    approach = new THREE.Vector3(0, 1.7, product.category === 'road' ? 7.5 : -7.5);
  }
  if (!entered) enterShowroom({ lock: false });
  closeAllOverlays();
  controls.unlock();
  controls.enabled = false;
  panelOwner = null;
  $('rideName').textContent = product.name;
  rideBanner.hidden = renderer.xr.isPresenting;
  document.body.classList.add('riding');
  audio.whoosh(1.4);
  testRide.start(owner, product, approach, () => {
    controls.enabled = true;
    rideBanner.hidden = true;
    document.body.classList.remove('riding');
    if (owner.kind === 'hero') owner.focusProduct = null;
    // sync controls with the final camera pose
    if (!renderer.xr.isPresenting) controls.setPose(camera.position, owner.center);
    audio.success();
    toast(`Test ride complete – how about size M?`, { icon: '🚲' });
    updateHint();
  });
}
$('rideSkip').addEventListener('click', () => testRide?.skip());

function openGallery() {
  controls?.unlock();
  productPanel.close(false);
  gallery.show();
  topbar.setGalleryActive(true);
  document.body.classList.add('gallery-open');
  updateHint();
}
function closeGallery() {
  if (!gallery.isOpen) return;
  gallery.hide();
  topbar.setGalleryActive(false);
  document.body.classList.remove('gallery-open');
  if (!entered && ready) enterShowroom({ lock: false });
  updateHint();
}
function closeAllOverlays() {
  productPanel.close(false);
  cart.close();
  closeGallery();
}

window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (testRide?.active) testRide.skip();
  else if (gallery.isOpen && !productPanel.isOpen && !cart.isOpen) closeGallery();
});

// ============================================================== hint / HUD
function updateHint() {
  if (!entered || gallery.isOpen || testRide?.active) {
    hintEl.hidden = true;
    crosshair.classList.remove('show');
    return;
  }
  const locked = controls?.isLocked;
  crosshair.classList.toggle('show', !!locked);
  hintEl.hidden = false;
  hintEl.classList.toggle('product', !!hoveredProduct);
  if (hoveredProduct) {
    hintEl.innerHTML = `<strong></strong><span class="price"></span><span class="sub">${isTouch ? 'Tap' : 'Click'} to view</span>`;
    hintEl.querySelector('strong').textContent = hoveredProduct.name;
    hintEl.querySelector('.price').textContent = aed(hoveredProduct.price);
  } else if (isTouch) {
    hintEl.textContent = 'Drag to look · Joystick to move · Tap a bike';
  } else if (locked) {
    hintEl.innerHTML = '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move · aim at a bike &amp; click · <kbd>Esc</kbd> free mouse';
  } else {
    hintEl.innerHTML = 'Click to look around · drag to turn · <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> to move';
  }
}

function computeDesktopHover() {
  if (!entered || uiBlocking()) return null;
  if (controls.isLocked) return pickAt(CENTER);
  if (!isTouch && controls.pointer.hasMouse && Math.abs(controls.pointer.ndc.x) <= 1) return pickAt(controls.pointer.ndc);
  return null;
}

// ============================================================== loop
const clock = new THREE.Clock();
const camWorld = new THREE.Vector3();
const lookTarget = new THREE.Vector3();

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  const xrOn = renderer.xr.isPresenting;

  // the 2D gallery covers the screen – skip 3D rendering to save battery
  if (gallery.isOpen && !xrOn) return;

  let hit = null;
  if (world) {
    if (!entered && !xrOn) {
      // cinematic idle pan behind the loading screen
      lookTarget.set(Math.sin(t * 0.18) * 7, 2.6, 0);
      camera.position.set(Math.sin(t * 0.1) * 2, 2.1, 13);
      camera.lookAt(lookTarget);
    } else if (xrOn) {
      if (!testRide.active) xr.update(dt);
      else xr.hideMarker();
      hit = xr.hovered ? { owner: xr.hovered.owner, product: xr.hovered.product } : null;
    } else {
      if (!testRide.active) controls.update(dt);
      hit = computeDesktopHover();
    }
    testRide.update(dt);

    const newHover = hit?.owner ?? null;
    const newProduct = hit?.product ?? null;
    if (newHover !== hovered || newProduct !== hoveredProduct) {
      if (newHover && newHover !== hovered && !xrOn) audio.hover();
      hovered = newHover;
      hoveredProduct = newProduct;
      canvas.style.cursor = hovered && !controls.isLocked ? 'pointer' : '';
      updateHint();
    }

    let focus = testRide.active ? testRide.owner : null;
    if (!focus && (productPanel.isOpen || vrPanel.isOpen)) focus = panelOwner;
    if (!focus && locateFocus && performance.now() < locateFocus.until) focus = locateFocus.owner;

    camera.getWorldPosition(camWorld);
    world.stands.update(dt, t, hovered, focus);
    world.hero.update(dt, t, hovered, focus, camWorld);
    minimap.update(camWorld, cameraWorldYaw(camera), hovered, t);
  }
  showroom.update(dt, t);

  if (xrOn || !composer) renderer.render(scene, camera);
  else composer.render(dt);
});

// ============================================================== resize
function onResize() {
  if (renderer.xr.isPresenting) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer?.setSize(w, h);
  world?.hero.setPixelScale(PIXEL_RATIO * (h / 900) * 1.4);
}
window.addEventListener('resize', onResize);
