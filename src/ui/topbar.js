import { filters, PRICE_MIN, PRICE_MAX, PRICE_STEP } from './filters.js';
import { store } from './store.js';
import { audio } from './audio.js';
import { aedShort } from './format.js';

const $ = (id) => document.getElementById(id);

/** Wires the static top bar markup (index.html) to filters, cart, wishlist and actions. */
export function initTopbar({ onToggleGallery, onOpenCart, onEnterVR }) {
  // ---------------- category
  const segButtons = [...document.querySelectorAll('.seg [data-cat]')];
  segButtons.forEach((b) =>
    b.addEventListener('click', () => {
      audio.click();
      filters.set({ category: b.dataset.cat });
    }),
  );

  // ---------------- search
  const search = $('searchInput');
  let st;
  search.addEventListener('input', () => {
    clearTimeout(st);
    st = setTimeout(() => filters.set({ query: search.value }), 120);
  });
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      search.value = '';
      filters.set({ query: '' });
      search.blur();
    }
  });

  // ---------------- price range (dual thumb)
  const minEl = $('priceMin');
  const maxEl = $('priceMax');
  const out = $('priceOut');
  const track = $('priceTrack');
  for (const el of [minEl, maxEl]) {
    el.min = PRICE_MIN;
    el.max = PRICE_MAX;
    el.step = PRICE_STEP;
  }
  minEl.value = PRICE_MIN;
  maxEl.value = PRICE_MAX;
  const paintRange = () => {
    const a = ((minEl.value - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * 100;
    const b = ((maxEl.value - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * 100;
    track.style.setProperty('--a', `${a}%`);
    track.style.setProperty('--b', `${b}%`);
    out.textContent = `AED ${aedShort(+minEl.value)} – ${aedShort(+maxEl.value)}`;
    minEl.setAttribute('aria-valuetext', `AED ${(+minEl.value).toLocaleString('en-US')}`);
    maxEl.setAttribute('aria-valuetext', `AED ${(+maxEl.value).toLocaleString('en-US')}`);
  };
  const onRange = (e) => {
    let lo = +minEl.value;
    let hi = +maxEl.value;
    if (lo > hi - PRICE_STEP) {
      if (e.target === minEl) lo = minEl.value = hi - PRICE_STEP;
      else hi = maxEl.value = lo + PRICE_STEP;
    }
    paintRange();
    filters.set({ min: lo, max: hi });
  };
  minEl.addEventListener('input', onRange);
  maxEl.addEventListener('input', onRange);
  paintRange();

  // ---------------- sort
  $('sortSelect').addEventListener('change', (e) => filters.set({ sort: e.target.value }));

  // ---------------- wishlist filter
  const wishBtn = $('wishFilter');
  wishBtn.addEventListener('click', () => {
    audio.click();
    filters.set({ wishlistOnly: !filters.state.wishlistOnly });
  });

  // ---------------- mobile filters toggle
  const ft = $('filtersToggle');
  const panel = $('tbFilters');
  ft.addEventListener('click', () => {
    const open = !panel.classList.contains('open');
    panel.classList.toggle('open', open);
    ft.setAttribute('aria-expanded', String(open));
    audio.click();
  });

  // ---------------- actions
  $('galleryToggle').addEventListener('click', () => {
    audio.click();
    onToggleGallery();
  });
  $('cartBtn').addEventListener('click', () => {
    audio.click();
    onOpenCart();
  });
  $('vrTopBtn').addEventListener('click', () => onEnterVR());
  const mute = $('muteBtn');
  mute.addEventListener('click', () => {
    audio.init();
    audio.toggleMute();
  });
  const paintMute = (m) => {
    mute.setAttribute('aria-pressed', String(m));
    mute.setAttribute('aria-label', m ? 'Unmute sound' : 'Mute sound');
    mute.classList.toggle('muted', m);
  };
  audio.onChange(paintMute);
  paintMute(audio.muted);

  // ---------------- reactive state
  const paintFilters = (s) => {
    segButtons.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.cat === s.category)));
    wishBtn.setAttribute('aria-pressed', String(s.wishlistOnly));
  };
  filters.subscribe(paintFilters);
  paintFilters(filters.state);

  const badge = $('cartBadge');
  const cartBtn = $('cartBtn');
  const wishCount = $('wishCount');
  const paintStore = (reason) => {
    const n = store.count();
    badge.textContent = n > 99 ? '99+' : String(n);
    badge.hidden = n === 0;
    cartBtn.setAttribute('aria-label', `Open cart, ${n} item${n === 1 ? '' : 's'}`);
    if (reason === 'cart') {
      badge.classList.remove('bump');
      void badge.offsetWidth;
      badge.classList.add('bump');
    }
    wishCount.textContent = String(store.wishlist.size);
  };
  store.subscribe(paintStore);
  paintStore();

  return {
    setGalleryActive(on) {
      $('galleryToggle').setAttribute('aria-pressed', String(on));
      $('galleryToggle').querySelector('.lbl').textContent = on ? '3D Showroom' : '2D Gallery';
    },
    showVR(on) {
      $('vrTopBtn').hidden = !on;
    },
  };
}
