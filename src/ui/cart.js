import { store, VAT_RATE } from './store.js';
import { PRODUCT_BY_ID } from '../data/products.js';
import { audio } from './audio.js';
import { aed, escapeHtml } from './format.js';

/** Slide-in cart drawer with checkout form and demo order confirmation. */
export function createCart({ onBrowse }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'drawer-backdrop';
  backdrop.hidden = true;
  const el = document.createElement('aside');
  el.className = 'drawer glass';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'drawerTitle');
  el.hidden = true;
  document.getElementById('app').append(backdrop, el);

  let view = 'cart'; // 'cart' | 'checkout' | 'confirmed'
  let lastOrder = null;
  let lastFocus = null;

  const totalsHtml = () => {
    const t = store.totals();
    return `
      <div class="totals">
        <div><span>Subtotal</span><span>${aed(t.subtotal, true)}</span></div>
        <div><span>VAT (${Math.round(VAT_RATE * 100)}%)</span><span>${aed(t.vat, true)}</span></div>
        <div class="grand"><span>Total</span><span>${aed(t.total, true)}</span></div>
      </div>`;
  };

  function render() {
    const n = store.count();
    let body = '';
    let title = 'Your Cart';
    if (view === 'cart') {
      if (!store.cart.length) {
        body = `
          <div class="empty">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"/></svg>
            <p>Your cart is empty.</p>
            <button class="btn-outline" data-act="browse">Browse the showroom</button>
          </div>`;
      } else {
        body = `
          <ul class="lines">
            ${store.cart
              .map((i) => {
                const p = PRODUCT_BY_ID.get(i.id);
                const key = `data-id="${i.id}" data-size="${i.size}"`;
                return `
                <li class="line">
                  <img src="${p.image}" alt="" width="96" height="54" loading="lazy" decoding="async" />
                  <div class="line-info">
                    <strong>${escapeHtml(p.name)}</strong>
                    <span>${p.categoryLabel} · Size ${i.size}</span>
                    <span class="line-price">${aed(p.price * i.qty)}</span>
                  </div>
                  <div class="qty" role="group" aria-label="Quantity for ${escapeHtml(p.name)}">
                    <button ${key} data-act="dec" aria-label="Decrease quantity">−</button>
                    <output aria-live="polite">${i.qty}</output>
                    <button ${key} data-act="inc" aria-label="Increase quantity">+</button>
                  </div>
                  <button class="icon-btn sm remove" ${key} data-act="remove" aria-label="Remove ${escapeHtml(p.name)}">
                    <svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg>
                  </button>
                </li>`;
              })
              .join('')}
          </ul>
          ${totalsHtml()}
          <button class="btn-primary block" data-act="checkout">Checkout</button>
          <p class="fine">Prices include free delivery &amp; assembly in the UAE.</p>`;
      }
    } else if (view === 'checkout') {
      title = 'Checkout';
      body = `
        <form class="checkout" novalidate>
          <label>Full name<input name="name" autocomplete="name" required minlength="2" /></label>
          <label>Email<input name="email" type="email" autocomplete="email" required /></label>
          <label>Phone (optional)<input name="phone" type="tel" autocomplete="tel" /></label>
          <label>Delivery address<textarea name="address" rows="3" autocomplete="street-address" required minlength="6"></textarea></label>
          <label>Emirate
            <select name="emirate" required>
              ${['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain']
                .map((e) => `<option>${e}</option>`)
                .join('')}
            </select>
          </label>
          ${totalsHtml()}
          <p class="fine demo">Demo store – no payment will be taken.</p>
          <button class="btn-primary block" type="submit">Place order · ${aed(store.totals().total, true)}</button>
          <button class="link-btn" type="button" data-act="back">← Back to cart</button>
        </form>`;
    } else {
      title = 'Order confirmed';
      body = `
        <div class="confirmed">
          <div class="check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
          <h3>Thank you, ${escapeHtml(lastOrder.name.split(' ')[0])}!</h3>
          <p>Your order <strong>${lastOrder.id}</strong> is confirmed.</p>
          <p class="fine">A confirmation was "sent" to ${escapeHtml(lastOrder.email)}. Delivery to ${escapeHtml(lastOrder.emirate)} within 3–5 days.</p>
          <div class="totals"><div class="grand"><span>Paid (demo)</span><span>${aed(lastOrder.total, true)}</span></div></div>
          <button class="btn-primary block" data-act="browse">Continue shopping</button>
        </div>`;
    }

    el.innerHTML = `
      <header class="drawer-head">
        <h2 id="drawerTitle">${title}${view === 'cart' && n ? ` <span class="pill">${n}</span>` : ''}</h2>
        <button class="icon-btn" data-act="close" aria-label="Close cart"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      </header>
      <div class="drawer-body">${body}</div>`;

    const form = el.querySelector('form.checkout');
    if (form) form.addEventListener('submit', onSubmit);
  }

  function onSubmit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    let ok = true;
    for (const input of form.querySelectorAll('input, textarea, select')) {
      const valid = input.checkValidity();
      input.setAttribute('aria-invalid', String(!valid));
      if (!valid && ok) {
        input.focus();
        ok = false;
      }
    }
    if (!ok) {
      audio.click();
      return;
    }
    const data = Object.fromEntries(new FormData(form));
    lastOrder = {
      ...data,
      id: `VVR-${Date.now().toString(36).toUpperCase().slice(-6)}`,
      total: store.totals().total,
    };
    view = 'confirmed';
    store.clearCart();
    audio.success();
    render();
    el.querySelector('.drawer-body').focus?.();
  }

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const { act, id, size } = b.dataset;
    audio.click();
    const line = id && store.cart.find((i) => i.id === id && i.size === size);
    if (act === 'close') api.close();
    else if (act === 'inc' && line) store.setQty(id, size, line.qty + 1);
    else if (act === 'dec' && line) store.setQty(id, size, line.qty - 1);
    else if (act === 'remove') store.remove(id, size);
    else if (act === 'checkout') {
      view = 'checkout';
      render();
      el.querySelector('input')?.focus();
    } else if (act === 'back') {
      view = 'cart';
      render();
    } else if (act === 'browse') {
      api.close();
      onBrowse?.();
    }
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      api.close();
    }
  });
  backdrop.addEventListener('click', () => api.close());
  store.subscribe((r) => {
    if (r === 'cart' && !el.hidden && view === 'cart') {
      const focusedAct = document.activeElement?.dataset?.act;
      const focusedId = document.activeElement?.dataset?.id;
      const focusedSize = document.activeElement?.dataset?.size;
      render();
      if (focusedAct && focusedId)
        el.querySelector(`[data-act="${focusedAct}"][data-id="${focusedId}"][data-size="${focusedSize}"]`)?.focus();
    }
  });

  const api = {
    get isOpen() {
      return !el.hidden;
    },
    open() {
      lastFocus = document.activeElement;
      if (view === 'confirmed') view = 'cart';
      render();
      el.hidden = backdrop.hidden = false;
      requestAnimationFrame(() => {
        el.classList.add('show');
        backdrop.classList.add('show');
      });
      audio.whoosh(0.4);
      setTimeout(() => el.querySelector('[data-act="close"]')?.focus(), 60);
    },
    close() {
      if (el.hidden) return;
      el.classList.remove('show');
      backdrop.classList.remove('show');
      setTimeout(() => {
        if (!el.classList.contains('show')) el.hidden = backdrop.hidden = true;
      }, 320);
      if (view !== 'checkout') view = 'cart';
      lastFocus?.focus?.({ preventScroll: true });
    },
    toggle() {
      this.isOpen && el.classList.contains('show') ? this.close() : this.open();
    },
  };
  return api;
}
