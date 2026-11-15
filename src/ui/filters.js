import { PRODUCTS } from '../data/products.js';
import { store } from './store.js';

const prices = PRODUCTS.map((p) => p.price);
export const PRICE_MIN = Math.floor(Math.min(...prices) / 1000) * 1000;
export const PRICE_MAX = Math.ceil(Math.max(...prices) / 1000) * 1000;
export const PRICE_STEP = 500;

const listeners = new Set();

export const filters = {
  state: { category: 'all', query: '', min: PRICE_MIN, max: PRICE_MAX, sort: 'featured', wishlistOnly: false },

  set(patch) {
    Object.assign(this.state, patch);
    listeners.forEach((fn) => fn(this.state));
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  /** Products matching the current filters, in the current sort order. */
  apply(list = PRODUCTS) {
    const { category, query, min, max, sort, wishlistOnly } = this.state;
    const q = query.trim().toLowerCase();
    const out = list.filter(
      (p) =>
        (category === 'all' || p.category === category) &&
        p.price >= min &&
        p.price <= max &&
        (!wishlistOnly || store.isWished(p.id)) &&
        (!q ||
          `${p.name} ${p.categoryLabel} ${p.frame} ${p.groupset} ${p.wheelSize}`.toLowerCase().includes(q)),
    );
    const by = {
      'price-asc': (a, b) => a.price - b.price,
      'price-desc': (a, b) => b.price - a.price,
      'name-asc': (a, b) => a.name.localeCompare(b.name),
      'name-desc': (a, b) => b.name.localeCompare(a.name),
    }[sort];
    return by ? out.sort(by) : out;
  },
};
