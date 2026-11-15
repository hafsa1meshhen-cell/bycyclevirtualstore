import { PRODUCT_BY_ID } from '../data/products.js';

const CART_KEY = 'velovr.cart.v1';
const WISH_KEY = 'velovr.wishlist.v1';
export const VAT_RATE = 0.05;

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode) – keep in memory only */
  }
}

const sanitizeCart = (items) =>
  Array.isArray(items)
    ? items
        .filter((i) => i && PRODUCT_BY_ID.has(i.id) && typeof i.size === 'string')
        .map((i) => ({ id: i.id, size: i.size, qty: Math.max(1, Math.min(99, Number(i.qty) || 1)) }))
    : [];

const listeners = new Set();

export const store = {
  cart: sanitizeCart(load(CART_KEY, [])),
  wishlist: new Set((load(WISH_KEY, []) || []).filter((id) => PRODUCT_BY_ID.has(id))),

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  emit(reason) {
    save(CART_KEY, this.cart);
    save(WISH_KEY, [...this.wishlist]);
    listeners.forEach((fn) => fn(reason));
  },

  addToCart(id, size, qty = 1) {
    const line = this.cart.find((i) => i.id === id && i.size === size);
    if (line) line.qty = Math.min(99, line.qty + qty);
    else this.cart.push({ id, size, qty });
    this.emit('cart');
  },
  setQty(id, size, qty) {
    const line = this.cart.find((i) => i.id === id && i.size === size);
    if (!line) return;
    if (qty <= 0) return this.remove(id, size);
    line.qty = Math.min(99, qty);
    this.emit('cart');
  },
  remove(id, size) {
    this.cart = this.cart.filter((i) => !(i.id === id && i.size === size));
    this.emit('cart');
  },
  clearCart() {
    this.cart = [];
    this.emit('cart');
  },
  count() {
    return this.cart.reduce((n, i) => n + i.qty, 0);
  },
  totals() {
    const subtotal = this.cart.reduce((s, i) => s + PRODUCT_BY_ID.get(i.id).price * i.qty, 0);
    const vat = Math.round(subtotal * VAT_RATE * 100) / 100;
    return { subtotal, vat, total: subtotal + vat };
  },

  isWished(id) {
    return this.wishlist.has(id);
  },
  toggleWish(id) {
    if (this.wishlist.has(id)) this.wishlist.delete(id);
    else this.wishlist.add(id);
    this.emit('wishlist');
    return this.wishlist.has(id);
  },
};
