const host = () => document.getElementById('toastHost');

/** Show a small transient notification. */
export function toast(message, { icon = '✓', duration = 2400 } = {}) {
  const el = document.createElement('div');
  el.className = 'toast glass';
  el.innerHTML = `<span class="ti" aria-hidden="true"></span><span class="tm"></span>`;
  el.querySelector('.ti').textContent = icon;
  el.querySelector('.tm').textContent = message;
  host().appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 400);
  }, duration);
}
