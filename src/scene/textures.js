import * as THREE from 'three';
import { aed } from '../ui/format.js';

export const PANEL_TEX_WIDTH = 768; // stand textures are downscaled for GPU memory / 60 fps
export const ACCENT = {
  road: '#45d4ff',
  mountain: '#ffad42',
  gold: '#e8b65a',
};

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Signed distance to a rounded rectangle centred in a w×h canvas. */
function roundedSdf(x, y, w, h, halfW, halfH, r) {
  const qx = Math.abs(x - w / 2) - (halfW - r);
  const qy = Math.abs(y - h / 2) - (halfH - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

/** Feathered rounded-rect alpha mask used to blend the photo edges into the scene. */
export function createFeatherMask(w = 256, h = 144, featherPx = 14, radiusPx = 12) {
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = roundedSdf(x + 0.5, y + 0.5, w, h, w / 2, h / 2, radiusPx);
      const a = smoothstep(0, featherPx, -d);
      const i = (y * w + x) * 4;
      const v = Math.round(a * 255);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

/** Soft glow around a rounded rect – used as the hover halo. */
export function createHaloTexture(w = 256, h = 160, innerHalfW = 104, innerHalfH = 58) {
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = roundedSdf(x + 0.5, y + 0.5, w, h, innerHalfW, innerHalfH, 10);
      const a = d < 0 ? 0.9 : Math.exp(-d / 9) * 0.9;
      const i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Round soft dot for particles. */
export function createDotTexture(size = 64) {
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,240,200,0.8)');
  g.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Procedural polished-concrete texture. */
export function createConcreteTexture(size = 512) {
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2a2a2e';
  ctx.fillRect(0, 0, size, size);
  // soft blotches
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 20 + Math.random() * 90;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const v = Math.random() < 0.5 ? 255 : 0;
    g.addColorStop(0, `rgba(${v},${v},${v},${0.03 + Math.random() * 0.04})`);
    g.addColorStop(1, `rgba(${v},${v},${v},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // speckles
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 18;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  // tile seams (large format slabs)
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

function fitText(ctx, text, maxWidth, size, weight, family) {
  let s = size;
  do {
    ctx.font = `${weight} ${s}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    s -= 2;
  } while (s > 14);
  return s;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
export { roundRect };

/** 3D label with name + price. */
export function createLabelTexture(product) {
  const W = 1024;
  const H = 256;
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  const accent = product.limited ? ACCENT.gold : ACCENT[product.category];

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, 'rgba(14,12,20,0.92)');
  bg.addColorStop(1, 'rgba(30,24,34,0.92)');
  roundRect(ctx, 6, 6, W - 12, H - 12, 36);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.85;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // accent bar
  ctx.fillStyle = accent;
  roundRect(ctx, 34, 48, 10, H - 96, 5);
  ctx.fill();

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '600 30px Inter, system-ui, sans-serif';
  const tag = `${product.categoryLabel.toUpperCase()}  ·  NO. ${String(product.number).padStart(2, '0')}${
    product.limited ? '  ·  LIMITED' : ''
  }`;
  ctx.fillText(tag, 72, 74);

  ctx.fillStyle = '#ffffff';
  fitText(ctx, product.name, W - 110, 66, 700, 'Outfit, Inter, system-ui, sans-serif');
  ctx.fillText(product.name, 72, 148);

  ctx.fillStyle = accent;
  ctx.font = '700 50px Outfit, Inter, system-ui, sans-serif';
  ctx.fillText(aed(product.price), 72, 214);

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '500 30px Inter, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${product.weight} kg  ·  ${product.wheelSize.split('·')[0].trim()}`, W - 48, 212);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Glowing neon sign text. */
export function createSignTexture(text, color, { width = 2048, height = 384, size = 230, sub = '' } = {}) {
  const c = canvas(width, height);
  const ctx = c.getContext('2d');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${size}px Outfit, Inter, system-ui, sans-serif`;
  const cy = sub ? height * 0.42 : height / 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = 50;
  ctx.fillStyle = color;
  ctx.fillText(text, width / 2, cy);
  ctx.shadowBlur = 18;
  ctx.fillText(text, width / 2, cy);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText(text, width / 2, cy);
  if (sub) {
    ctx.font = `600 ${Math.round(size * 0.22)}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = color;
    ctx.fillText(sub, width / 2, height * 0.86);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function fallbackCanvas(product) {
  const c = canvas(PANEL_TEX_WIDTH, Math.round(PANEL_TEX_WIDTH * 0.558));
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ddd';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#333';
  ctx.font = '600 36px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(product.name, c.width / 2, c.height / 2);
  return c;
}

/**
 * Loads all bike photos, downscales them into canvases (compressed GPU footprint)
 * and returns Map<id, { canvas, texture, image? }>. Full-resolution images are
 * kept only for the hero (limited-edition) bikes.
 */
export function loadBikeImages(products, manager, maxAnisotropy = 4) {
  const loader = new THREE.ImageLoader(manager);
  const result = new Map();
  const finish = (p, c, img) => {
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(4, maxAnisotropy);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    result.set(p.id, { canvas: c, texture: tex, image: p.limited ? img : null });
  };
  return Promise.all(
    products.map(
      (p) =>
        new Promise((resolve) => {
          loader.load(
            p.image,
            (img) => {
              const w = PANEL_TEX_WIDTH;
              const h = Math.round((w * img.height) / img.width);
              const c = canvas(w, h);
              const ctx = c.getContext('2d');
              ctx.imageSmoothingQuality = 'high';
              ctx.drawImage(img, 0, 0, w, h);
              finish(p, c, img);
              resolve();
            },
            undefined,
            () => {
              const c = fallbackCanvas(p);
              finish(p, c, null);
              resolve();
            },
          );
        }),
    ),
  ).then(() => result);
}
