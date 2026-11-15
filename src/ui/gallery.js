import { filters } from './filters.js';
import { store } from './store.js';
import { audio } from './audio.js';
import { aed, escapeHtml } from './format.js';
import { toast } from './toast.js';

const HEART = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-9.2-9A5 5 0 0 1 12 6a5 5 0 0 1 9.2 5C19 15.6 12 20 12 20z"/></svg>`;

/** Responsive 2D grid of all bikes (for visitors without VR / WebGL). */
export function createGallery({ onView, onLocate }) {
  const el = document.createElement('section');
  el.className = 'gallery';
  el.setAttribute('aria-label', '2D bike gallery');
  el.hidden = true;
  el.innerHTML = `
    <div class="gallery-inner">
      <div class="gallery-head">
        <h2>The Collection</h2>
        <p class="gallery-count" aria-live="polite"></p>
      </div>
      <div class="grid"></div>
    </div>`;
  document.getElementById('app').appendChild(el);
  const grid = el.querySelector('.grid');
  const count = el.querySelector('.gallery-count');

  function render() {
    const list = filters.apply();
    count.textContent = `${list.length} of 30 bikes`;
    if (!list.length) {
      grid.innerHTML = `<p class="no-results">No bikes match your filters. Try widening the price range or clearing the search.</p>`;
      return;
    }
    grid.innerHTML = list
      .map((p, i) => {
        const wished = store.isWished(p.id);
        return `
        <article class="card glass" style="--i:${Math.min(i, 12)}" data-id="${p.id}">
          <button class="card-media" data-act="view" aria-label="View ${escapeHtml(p.name)}">
            <img src="${p.image}" alt="${escapeHtml(p.name)}" loading="lazy" decoding="async" width="1376" height="768" />
            ${p.limited ? '<span class="badge-gold">LIMITED</span>' : ''}
          </button>
          <button class="icon-btn heart card-heart" data-act="wish" aria-pressed="${wished}" aria-label="${wished ? 'Remove' : 'Add'} ${escapeHtml(p.name)} ${wished ? 'from' : 'to'} wishlist">${HEART}</button>
          <div class="card-body">
            <p class="card-cat" data-cat="${p.category}">${p.categoryLabel} · ${p.weight} kg</p>
            <h3>${escapeHtml(p.name)}</h3>
            <p class="card-spec">${escapeHtml(p.groupset)}</p>
            <div class="card-foot">
              <span class="card-price">${aed(p.price)}</span>
              <span class="card-btns">
                <button class="btn-ghost sm" data-act="locate" aria-label="Find ${escapeHtml(p.name)} in the 3D showroom">3D</button>
                <button class="btn-primary sm" data-act="view">View</button>
              </span>
            </div>
          </div>
        </article>`;
      })
      .join('');
  }

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const id = b.closest('.card').dataset.id;
    const { act } = b.dataset;
    if (act === 'view') onView(id);
    else if (act === 'locate') {
      audio.click();
      onLocate(id);
    } else if (act === 'wish') {
      audio.click();
      const on = store.toggleWish(id);
      toast(on ? 'Saved to wishlist' : 'Removed from wishlist', { icon: on ? '♥' : '♡' });
    }
  });

  filters.subscribe(() => !el.hidden && render());
  store.subscribe((r) => {
    if (r !== 'wishlist' || el.hidden) return;
    if (filters.state.wishlistOnly) return render();
    // update hearts in place (keeps scroll + focus)
    for (const card of grid.querySelectorAll('.card')) {
      const on = store.isWished(card.dataset.id);
      const h = card.querySelector('.card-heart');
      h.setAttribute('aria-pressed', String(on));
    }
  });

  return {
    get isOpen() {
      return !el.hidden;
    },
    show() {
      render();
      el.hidden = false;
      el.scrollTop = 0;
      requestAnimationFrame(() => el.classList.add('show'));
    },
    hide() {
      el.classList.remove('show');
      el.hidden = true;
    },
  };
}
