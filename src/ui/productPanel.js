import { store } from './store.js';
import { audio } from './audio.js';
import { aed, escapeHtml } from './format.js';
import { toast } from './toast.js';

const HEART = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-9.2-9A5 5 0 0 1 12 6a5 5 0 0 1 9.2 5C19 15.6 12 20 12 20z"/></svg>`;

/** Desktop / mobile glassmorphism product overlay. */
export function createProductPanel({ onTestRide, onLocate, onClose }) {
  const root = document.createElement('div');
  root.className = 'pp-backdrop';
  root.hidden = true;
  root.innerHTML = `
    <div class="pp glass" role="dialog" aria-modal="true" aria-labelledby="ppName">
      <button class="icon-btn pp-close" aria-label="Close product details">
        <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>
      </button>
      <div class="pp-media">
        <img alt="" width="1376" height="768" decoding="async" />
        <span class="pp-tag"></span>
      </div>
      <div class="pp-body">
        <p class="pp-cat"></p>
        <h2 id="ppName"></h2>
        <p class="pp-price"></p>
        <p class="pp-desc"></p>
        <dl class="pp-specs"></dl>
        <fieldset class="pp-sizes">
          <legend>Frame size</legend>
          <div class="sizes" role="radiogroup" aria-label="Frame size"></div>
        </fieldset>
        <div class="pp-actions">
          <button class="btn-primary" data-act="cart">Add to Cart</button>
          <button class="btn-outline" data-act="ride">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-7h5l3 7M10 9l3 7"/></svg>
            Test Ride
          </button>
          <button class="icon-btn heart" data-act="wish" aria-pressed="false" aria-label="Add to wishlist">${HEART}</button>
        </div>
        <button class="link-btn" data-act="locate">Find it in the showroom →</button>
      </div>
    </div>`;
  document.getElementById('app').appendChild(root);

  const $ = (s) => root.querySelector(s);
  const img = $('.pp-media img');
  let product = null;
  let size = 'M';
  let lastFocus = null;

  const paintWish = () => {
    if (!product) return;
    const on = store.isWished(product.id);
    const b = $('[data-act="wish"]');
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', on ? 'Remove from wishlist' : 'Add to wishlist');
  };
  store.subscribe((r) => r === 'wishlist' && paintWish());

  const renderSizes = () => {
    $('.sizes').innerHTML = product.sizes
      .map(
        (s) =>
          `<button role="radio" aria-checked="${s === size}" data-size="${s}" tabindex="${s === size ? 0 : -1}">${s}</button>`,
      )
      .join('');
  };

  root.addEventListener('click', (e) => {
    if (e.target === root) return api.close();
    const t = e.target.closest('button');
    if (!t) return;
    if (t.classList.contains('pp-close')) return api.close();
    if (t.dataset.size) {
      size = t.dataset.size;
      audio.click();
      renderSizes();
      $(`[data-size="${size}"]`).focus();
      return;
    }
    const act = t.dataset.act;
    if (act === 'cart') {
      store.addToCart(product.id, size, 1);
      audio.success();
      toast(`${product.name} · size ${size} added to cart`);
      t.classList.add('done');
      t.textContent = 'Added ✓';
      setTimeout(() => {
        t.classList.remove('done');
        t.textContent = 'Add to Cart';
      }, 1400);
    } else if (act === 'wish') {
      audio.click();
      const on = store.toggleWish(product.id);
      toast(on ? 'Saved to wishlist' : 'Removed from wishlist', { icon: on ? '♥' : '♡' });
    } else if (act === 'ride') {
      const p = product;
      api.close(false);
      onTestRide(p);
    } else if (act === 'locate') {
      const p = product;
      api.close(false);
      onLocate(p);
    }
  });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      api.close();
    }
    if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && e.target.dataset.size) {
      const i = product.sizes.indexOf(size);
      const n = product.sizes.length;
      size = product.sizes[(i + (e.key === 'ArrowRight' ? 1 : n - 1)) % n];
      renderSizes();
      $(`[data-size="${size}"]`).focus();
    }
    // simple focus trap
    if (e.key === 'Tab') {
      const f = [...root.querySelectorAll('button:not([tabindex="-1"])')];
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  const api = {
    get isOpen() {
      return !root.hidden;
    },
    open(p) {
      product = p;
      size = 'M';
      lastFocus = document.activeElement;
      img.src = p.image;
      img.alt = `${p.name} – ${p.categoryLabel} bike`;
      $('.pp-tag').textContent = p.limited ? 'LIMITED EDITION' : `${p.categoryLabel} · No. ${String(p.number).padStart(2, '0')}`;
      $('.pp-tag').classList.toggle('gold', p.limited);
      $('.pp-cat').textContent = `${p.categoryLabel} bike`;
      $('.pp-cat').dataset.cat = p.category;
      $('#ppName').textContent = p.name;
      $('.pp-price').textContent = aed(p.price);
      $('.pp-desc').innerHTML = p.description.map(escapeHtml).join('<br />');
      $('.pp-specs').innerHTML = [
        ['Frame', p.frame],
        ['Weight', `${p.weight} kg`],
        ['Groupset', p.groupset],
        ['Wheel size', p.wheelSize],
        ['Sizes', p.sizes.join(' / ')],
      ]
        .map(([k, v]) => `<div><dt>${k}</dt><dd>${escapeHtml(v)}</dd></div>`)
        .join('');
      renderSizes();
      paintWish();
      root.hidden = false;
      requestAnimationFrame(() => root.classList.add('show'));
      audio.whoosh(0.45);
      setTimeout(() => $('.pp-close').focus({ preventScroll: true }), 50);
    },
    close(notify = true) {
      if (root.hidden) return;
      root.classList.remove('show');
      root.hidden = true;
      product = null;
      if (lastFocus && document.body.contains(lastFocus)) lastFocus.focus?.({ preventScroll: true });
      if (notify) onClose?.();
    },
  };
  return api;
}
