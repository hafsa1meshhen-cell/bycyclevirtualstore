import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const EYE = 1.65;
const PLAYER_R = 0.45;
const isTyping = (el) =>
  el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);

/**
 * Desktop: WASD + mouse look (PointerLockControls), or click-drag look when unlocked.
 * Mobile: one-finger drag to look, virtual joystick to move, tap to select.
 */
export function createControls({ camera, dom, room, obstacles, joystick }) {
  const plc = new PointerLockControls(camera, dom);
  plc.pointerSpeed = 0.75;
  let lastUnlock = -Infinity;
  plc.addEventListener('unlock', () => (lastUnlock = performance.now()));
  const canLock = 'requestPointerLock' in dom && !matchMedia('(pointer: coarse)').matches;

  const keys = new Set();
  const velocity = new THREE.Vector3();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const wish = new THREE.Vector3();
  const tapListeners = new Set();
  const pointer = { ndc: new THREE.Vector2(9, 9), hasMouse: false };

  const api = {
    enabled: true,
    plc,
    pointer,
    get isLocked() {
      return plc.isLocked;
    },
    onTap(fn) {
      tapListeners.add(fn);
    },
    get canLock() {
      return canLock;
    },
    lock() {
      // Browsers refuse a re-lock shortly after the user pressed Esc – avoid noisy errors.
      if (!canLock || plc.isLocked || performance.now() - lastUnlock < 1300) return false;
      try {
        const p = dom.requestPointerLock();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch {
        return false;
      }
      return true;
    },
    unlock() {
      if (document.pointerLockElement === dom) document.exitPointerLock();
    },
    getYaw() {
      euler.setFromQuaternion(camera.quaternion);
      return euler.y;
    },
    setPose(position, lookAt) {
      camera.position.set(position.x, EYE, position.z);
      if (lookAt) {
        camera.lookAt(lookAt);
        euler.setFromQuaternion(camera.quaternion);
        euler.z = 0;
        euler.x = Math.max(-0.6, Math.min(0.6, euler.x));
        camera.quaternion.setFromEuler(euler);
      }
      velocity.set(0, 0, 0);
    },
    resolveCollisions(pos) {
      collide(pos);
    },
    update(dt) {
      if (!api.enabled) {
        velocity.set(0, 0, 0);
        return;
      }
      // input → desired direction (camera-relative, on the floor plane)
      camera.getWorldDirection(fwd);
      fwd.y = 0;
      fwd.normalize();
      right.crossVectors(fwd, camera.up).normalize();
      wish.set(0, 0, 0);
      if (keys.has('KeyW') || keys.has('ArrowUp')) wish.add(fwd);
      if (keys.has('KeyS') || keys.has('ArrowDown')) wish.sub(fwd);
      if (keys.has('KeyD') || keys.has('ArrowRight')) wish.add(right);
      if (keys.has('KeyA') || keys.has('ArrowLeft')) wish.sub(right);
      if (joystick && (joystick.x || joystick.y)) {
        wish.addScaledVector(fwd, -joystick.y).addScaledVector(right, joystick.x);
      }
      const len = wish.length();
      if (len > 1) wish.divideScalar(len);
      const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 8 : 4.2;
      wish.multiplyScalar(speed);
      velocity.lerp(wish, 1 - Math.exp(-dt * 9));
      camera.position.addScaledVector(velocity, dt);
      camera.position.y = EYE;
      collide(camera.position);
    },
  };

  function collide(p) {
    p.x = Math.min(room.maxX - 0.8, Math.max(room.minX + 0.8, p.x));
    p.z = Math.min(room.maxZ - 0.8, Math.max(room.minZ + 0.8, p.z));
    for (const o of obstacles) {
      const dx = p.x - o.x;
      const dz = p.z - o.z;
      const min = o.r + PLAYER_R;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min) {
        const d = Math.sqrt(d2) || 0.0001;
        p.x = o.x + (dx / d) * min;
        p.z = o.z + (dz / d) * min;
      }
    }
  }

  // ------------------------------------------------------------ keyboard
  window.addEventListener('keydown', (e) => {
    if (isTyping(e.target)) return;
    keys.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) && e.target === document.body)
      e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  // ------------------------------------------------------------ pointer (drag look + tap)
  const drag = { id: null, x: 0, y: 0, sx: 0, sy: 0, t: 0, moved: false };
  dom.addEventListener('pointerdown', (e) => {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
    if (drag.id !== null) return;
    drag.id = e.pointerId;
    drag.x = drag.sx = e.clientX;
    drag.y = drag.sy = e.clientY;
    drag.t = performance.now();
    drag.moved = false;
    if (!plc.isLocked) dom.setPointerCapture?.(e.pointerId);
  });
  dom.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') {
      pointer.hasMouse = true;
      pointer.ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    }
    if (e.pointerId !== drag.id || plc.isLocked || !api.enabled) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.moved = true;
    if (!drag.moved) return;
    const s = e.pointerType === 'touch' ? 0.005 : 0.0035;
    euler.setFromQuaternion(camera.quaternion);
    euler.y += dx * s;
    euler.x += dy * s;
    euler.x = Math.max(-1.3, Math.min(1.3, euler.x));
    camera.quaternion.setFromEuler(euler);
  });
  const end = (e) => {
    if (e.pointerId !== drag.id) return;
    const wasTap = !drag.moved && performance.now() - drag.t < 450;
    drag.id = null;
    if (wasTap && e.type === 'pointerup') {
      tapListeners.forEach((fn) => fn({ x: e.clientX, y: e.clientY, pointerType: e.pointerType, locked: plc.isLocked }));
    }
  };
  dom.addEventListener('pointerup', end);
  dom.addEventListener('pointercancel', end);
  dom.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') pointer.ndc.set(9, 9);
  });

  return api;
}

/** On-screen joystick for touch devices. Returns a live {x, y} vector in [-1, 1]. */
export function createJoystick(el) {
  const vec = { x: 0, y: 0 };
  const knob = el.querySelector('.knob');
  let id = null;
  let cx = 0;
  let cy = 0;
  const R = 46;
  const set = (x, y) => {
    const d = Math.hypot(x, y);
    if (d > R) {
      x = (x / d) * R;
      y = (y / d) * R;
    }
    knob.style.transform = `translate(${x}px, ${y}px)`;
    vec.x = x / R;
    vec.y = y / R;
  };
  el.addEventListener('pointerdown', (e) => {
    id = e.pointerId;
    const r = el.getBoundingClientRect();
    cx = r.left + r.width / 2;
    cy = r.top + r.height / 2;
    el.setPointerCapture(e.pointerId);
    set(e.clientX - cx, e.clientY - cy);
    e.preventDefault();
  });
  el.addEventListener('pointermove', (e) => {
    if (e.pointerId === id) set(e.clientX - cx, e.clientY - cy);
  });
  const up = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    set(0, 0);
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  return vec;
}
