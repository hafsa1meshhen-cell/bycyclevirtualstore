const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Format a number as UAE Dirham. */
export const aed = (n, decimals = false) => `AED ${decimals ? nf2.format(n) : nf0.format(n)}`;

/** Short price, e.g. 28500 → "28.5k". */
export const aedShort = (n) => `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);
