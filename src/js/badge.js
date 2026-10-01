/*
 * badge.js, cart count badge in the navbar
 * Shared by main.js (initial paint) and cart/product pages (after mutate).
 */
import { loadCart, cartCount } from './cartstore.js';

export function hydrateCartBadge() {
  const badges = document.querySelectorAll('.js-cart-count');
  const n = typeof cartCount === 'function' ? cartCount(loadCart()) : 0;
  badges.forEach((b) => {
    if (n > 0) {
      b.textContent = n;
      b.hidden = false;
    } else {
      b.hidden = true;
    }
  });
}
