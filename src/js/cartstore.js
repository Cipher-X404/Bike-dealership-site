/*
 * cartstore.js, tiny client-side cart (localStorage).
 * -----------------------------------------------------------------
 * Feeds the nav badge + cart line items so the cart page reflects
 * "add to cart" actions from the product/shop pages. Lightweight by
 * design: totals are recomputed here and on the checkout summary.
 */

const KEY = 'soko-cart-v1';

export const mockProduct = {
  id: '0001-commuter',
  name: 'SOKO 01 · City Commuter',
  shortName: 'SOKO 01',
  price: 1350000,
  img: '/images/bike-commuter.webp',
};

export function loadCart() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {
    /* ignore */
  }
  return [];
}

export function saveCart(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch (_) {
    /* ignore */
  }
}

export function addToCart(item, qty = 1) {
  const items = loadCart();
  const existing = items.find((i) => i.id === item.id);
  if (existing) {
    existing.qty = Math.min(9, existing.qty + qty);
  } else {
    items.push({
      id: item.id,
      name: item.shortName || item.name,
      price: item.price,
      img: item.img,
      color: item.color || 'Graphite',
      qty: Math.min(9, qty),
    });
  }
  saveCart(items);
  return items;
}

export function setQty(id, qty) {
  const items = loadCart();
  const it = items.find((i) => i.id === id);
  if (!it) return items;
  it.qty = Math.max(0, Math.min(9, qty));
  saveCart(items);
  return items;
}

export function removeItem(id) {
  const items = loadCart().filter((i) => i.id !== id);
  saveCart(items);
  return items;
}

export function cartTotal(items = loadCart()) {
  return items.reduce((sum, i) => sum + i.price * i.qty, 0);
}

export function cartCount(items = loadCart()) {
  return items.reduce((sum, i) => sum + i.qty, 0);
}

export function money(n) {
  return '₦' + Number(n).toLocaleString('en-NG');
}
