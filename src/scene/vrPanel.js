import * as THREE from 'three';
import { roundRect, ACCENT } from './textures.js';
import { aed } from '../ui/format.js';
import { store } from '../ui/store.js';

const W = 1024;
const H = 1400;
const PANEL_W = 0.92;
const PANEL_H = (PANEL_W * H) / W;

/**
 * Floating 3D product panel for VR. Drawn into a canvas texture; buttons are
 * hit-tested using the UV coordinate of the controller ray intersection.
 */
export function createVRPanel({ images, onTestRide, onAction }) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(PANEL_W, PANEL_H),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false, depthTest: true }),
  );
  mesh.visible = false;
  mesh.renderOrder = 10;
  mesh.name = 'vr-product-panel';

  const state = { product: null, size: 'M', hover: null, status: '' };
  let buttons = [];

  function button(id, x, y, w, h, label, { primary = false, active = false, accent } = {}) {
    buttons.push({ id, x, y, w, h });
    const hov = state.hover === id;
    roundRect(ctx, x, y, w, h, 22);
    if (primary) {
      const g = ctx.createLinearGradient(x, y, x + w, y + h);
      g.addColorStop(0, hov ? '#ffd27e' : '#f0c06a');
      g.addColorStop(1, hov ? '#e5a648' : '#c98d34');
      ctx.fillStyle = g;
    } else if (active) {
      ctx.fillStyle = accent;
    } else {
      ctx.fillStyle = hov ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.08)';
    }
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = active || primary ? 'rgba(255,255,255,0.5)' : hov ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.22)';
    ctx.stroke();
    ctx.fillStyle = primary || active ? '#16110a' : '#fff';
    ctx.font = `700 ${Math.min(44, h * 0.42)}px Outfit, Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2 + 2);
  }

  function draw() {
    const p = state.product;
    if (!p) return;
    buttons = [];
    const accent = p.limited ? ACCENT.gold : ACCENT[p.category];
    ctx.clearRect(0, 0, W, H);

    // glass card
    roundRect(ctx, 8, 8, W - 16, H - 16, 48);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, 'rgba(24,20,30,0.95)');
    bg.addColorStop(1, 'rgba(10,9,14,0.96)');
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = accent;
    ctx.stroke();

    // image
    const img = images.get(p.id).canvas;
    const iw = W - 80;
    const ih = Math.round((iw * img.height) / img.width);
    ctx.save();
    roundRect(ctx, 40, 40, iw, ih, 28);
    ctx.clip();
    ctx.drawImage(img, 40, 40, iw, ih);
    ctx.restore();

    let y = 40 + ih + 70;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = accent;
    ctx.font = '600 30px Inter, sans-serif';
    ctx.fillText(`${p.categoryLabel.toUpperCase()} · NO. ${String(p.number).padStart(2, '0')}${p.limited ? ' · LIMITED EDITION' : ''}`, 56, y - 6);
    y += 56;
    ctx.fillStyle = '#fff';
    let fs = 60;
    do {
      ctx.font = `700 ${fs}px Outfit, Inter, sans-serif`;
      fs -= 2;
    } while (ctx.measureText(p.name).width > W - 112 && fs > 30);
    ctx.fillText(p.name, 56, y);
    y += 64;
    ctx.fillStyle = accent;
    ctx.font = '700 52px Outfit, Inter, sans-serif';
    ctx.fillText(aed(p.price), 56, y);

    // specs
    y += 52;
    const specs = [
      ['Frame', p.frame],
      ['Weight', `${p.weight} kg`],
      ['Groupset', p.groupset],
      ['Wheels', p.wheelSize],
    ];
    ctx.font = '500 30px Inter, sans-serif';
    for (const [k, v] of specs) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText(k, 56, y);
      ctx.fillStyle = '#fff';
      ctx.fillText(v, 250, y);
      y += 44;
    }

    // sizes
    y += 6;
    const sw = 120;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '600 28px Inter, sans-serif';
    ctx.fillText('SIZE', 56, y + 50);
    p.sizes.forEach((sz, i) =>
      button(`size:${sz}`, 200 + i * (sw + 18), y, sw, 80, sz, { active: state.size === sz, accent }),
    );
    y += 108;

    const half = (W - 112 - 24) / 2;
    button('cart', 56, y, half, 100, 'ADD TO CART', { primary: true });
    button('ride', 56 + half + 24, y, half, 100, 'TEST RIDE');
    y += 124;
    button('wish', 56, y, half, 90, store.isWished(p.id) ? '♥ WISHLISTED' : '♡ WISHLIST');
    button('close', 56 + half + 24, y, half, 90, 'CLOSE');
    y += 130;

    ctx.textAlign = 'center';
    ctx.font = '500 30px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(state.status || `Cart: ${store.count()} item${store.count() === 1 ? '' : 's'}`, W / 2, Math.min(y, H - 40));

    texture.needsUpdate = true;
  }

  const toPx = (uv) => ({ x: uv.x * W, y: (1 - uv.y) * H });
  const buttonAt = (uv) => {
    if (!uv) return null;
    const { x, y } = toPx(uv);
    return buttons.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)?.id ?? null;
  };

  const tmp = new THREE.Vector3();
  const dir = new THREE.Vector3();

  return {
    mesh,
    get isOpen() {
      return mesh.visible;
    },
    get product() {
      return state.product;
    },
    open(product, camera) {
      state.product = product;
      state.size = 'M';
      state.status = '';
      state.hover = null;
      draw();
      // place 1.1 m in front of the viewer at eye height, facing them
      camera.getWorldPosition(tmp);
      camera.getWorldDirection(dir);
      dir.y = 0;
      dir.normalize();
      mesh.position.copy(tmp).addScaledVector(dir, 1.1);
      mesh.position.y = tmp.y - 0.1;
      mesh.lookAt(tmp.x, mesh.position.y, tmp.z);
      mesh.visible = true;
    },
    close() {
      mesh.visible = false;
      state.product = null;
    },
    setHover(uv) {
      const id = buttonAt(uv);
      if (id !== state.hover) {
        state.hover = id;
        draw();
        return id !== null;
      }
      return false;
    },
    /** Handle a trigger press at uv. Returns the action id (or null). */
    press(uv) {
      const id = buttonAt(uv);
      const p = state.product;
      if (!id || !p) return null;
      if (id.startsWith('size:')) {
        state.size = id.slice(5);
      } else if (id === 'cart') {
        store.addToCart(p.id, state.size, 1);
        state.status = `✓ Added ${p.name} (size ${state.size}) · Cart: ${store.count()}`;
      } else if (id === 'wish') {
        const on = store.toggleWish(p.id);
        state.status = on ? '♥ Saved to your wishlist' : 'Removed from wishlist';
      } else if (id === 'ride') {
        const prod = p;
        this.close();
        onTestRide?.(prod);
      } else if (id === 'close') {
        this.close();
      }
      if (mesh.visible) draw();
      onAction?.(id);
      return id;
    },
    refresh() {
      if (mesh.visible) draw();
    },
  };
}
