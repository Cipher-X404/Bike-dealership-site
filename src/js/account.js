/*
 * account.js, client-side account store (localStorage)
 * -----------------------------------------------------------------
 * Accounts are OPTIONAL. Guests can browse and buy freely; an account
 * unlocks tracking, wishlist, wallet, addresses, garage, tickets & more.
 *
 * Roles: 'customer' | 'admin'. Sessions persist in localStorage. All store
 * data (users, orders, wishlist, wallet, addresses, cards, garage, tickets,
 * notifications, prefs, referral + the admin dataset) is seeded with
 * believable demo content so both dashboards render immediately and every
 * action is functional.
 */
import { addToCart } from './cartstore.js';

const USERS_KEY = 'soko-users-v1';
const SESSION_KEY = 'soko-session-v1';
const ORDERS_KEY = 'soko-orders-v1';
const WISHLIST_KEY = 'soko-wishlist-v1';
const WALLET_KEY = 'soko-wallet-v1';
const NOTIF_KEY = 'soko-notifs-v1';
const VERIFY_KEY = 'soko-verify-v1';
const ADDR_KEY = 'soko-addr-v1';
const CARDS_KEY = 'soko-cards-v1';
const GARAGE_KEY = 'soko-garage-v1';
const TICKETS_KEY = 'soko-tickets-v1';
const PREFS_KEY = 'soko-prefs-v1';
const REFS_KEY = 'soko-refs-v1';
const A_ORDERS = 'soko-a-orders-v1';
const A_INV = 'soko-a-inventory-v1';
const A_CUST = 'soko-a-customers-v1';
const A_SETTINGS = 'soko-a-settings-v1';

export const money = (n) => '₦' + Number(n || 0).toLocaleString('en-NG');

const load = (key, fallback) => {
  try { const v = localStorage.getItem(key); if (v) return JSON.parse(v); } catch (_) {}
  return fallback;
};
const save = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch (_) {} };
const uid = (prefix) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const safeUser = (u) => (u ? { id: u.id, name: u.name, email: u.email, role: u.role, joined: u.joined, phone: u.phone || '', city: u.city || '' } : null);

/* ── Catalogue ─────────────────────────────────────────────────── */
export const PRODUCTS = [
  { id: '0001-commuter', name: 'SOKO 01 · Commuter', cat: 'Commuter', price: 1350000, img: '/images/bike-commuter.webp', stock: 24, sku: 'SM-001-C' },
  { id: '0001-deluxe', name: 'SOKO 01 Deluxe', cat: 'Commuter', price: 1520000, img: '/images/bike-commuter.webp', stock: 11, sku: 'SM-001-D' },
  { id: '0002-cargo', name: 'SOKO 02 · Cargo', cat: 'Delivery', price: 1650000, img: '/images/bike-delivery.webp', stock: 6, sku: 'SM-002-C' },
  { id: '0003-trail', name: 'SOKO 03 · Trail', cat: 'Adventure', price: 1890000, img: '/images/bike-adventure.webp', stock: 0, sku: 'SM-003-T' },
  { id: '0001-pro', name: 'SOKO Pro · Performance', cat: 'Performance', price: 2450000, img: '/images/bike-pro.webp', stock: 3, sku: 'SM-001-P' },
  { id: 'acc-battery', name: 'SOKO Swap Battery', cat: 'Accessory', price: 320000, img: '/images/accessory-battery.webp', stock: 18, sku: 'SM-AC-B' },
  { id: 'acc-helmet', name: 'SOKO Aero Helmet', cat: 'Accessory', price: 85000, img: '/images/accessory-helmet.webp', stock: 5, sku: 'SM-AC-H' },
  { id: 'acc-charger', name: 'SOKO Fast Charger', cat: 'Accessory', price: 145000, img: '/images/accessory-battery.webp', stock: 9, sku: 'SM-AC-C' },
  { id: 'acc-lock', name: 'SOKO Smart Lock + GPS', cat: 'Accessory', price: 65000, img: '/images/accessory-helmet.webp', stock: 12, sku: 'SM-AC-L' },
];

export const ORDER_FLOW = ['paid', 'processing', 'shipped', 'delivered'];

/* ── Seed ──────────────────────────────────────────────────────── */
export function ensureSeeded() {
  if (!load(USERS_KEY, null)) {
    const users = [
      { id: 'u-demo', name: 'Chidi Okeke', email: 'chidi@example.com', password: 'demo1234', role: 'customer', joined: '2024-11-02', phone: '+234 801 234 5678', city: 'Lagos' },
      { id: 'u-admin', name: 'Store Manager', email: 'admin@sokomoto.ng', password: 'admin1234', role: 'admin', joined: '2021-03-15', phone: '+86 138 0000 0000', city: 'Guangzhou' },
    ];
    save(USERS_KEY, users);

    save(ORDERS_KEY, [
      { id: 'ORD-1061', userId: 'u-demo', ref: 'SM-2533', date: '2026-09-18', status: 'shipped', eta: 'Arriving in ~2 days',
        items: [{ name: 'SOKO Swap Battery', qty: 1, price: 320000, img: '/images/accessory-battery.webp' }], total: 320000, address: { name: 'Chidi Okeke', phone: '+234 801 234 5678', line1: '14 Adeola Close, Yaba', city: 'Lagos', state: 'Lagos', country: 'Nigeria' } },
      { id: 'ORD-1042', userId: 'u-demo', ref: 'SM-2481', date: '2026-08-30', status: 'delivered', eta: 'Delivered 30 Aug',
        items: [{ name: 'SOKO 01 · Commuter', qty: 1, price: 1350000, img: '/images/bike-commuter.webp' }], total: 1350000, address: { name: 'Chidi Okeke', phone: '+234 801 234 5678', line1: '14 Adeola Close, Yaba', city: 'Lagos', state: 'Lagos', country: 'Nigeria' } },
      { id: 'ORD-1037', userId: 'u-demo', ref: 'SM-2407', date: '2026-08-02', status: 'delivered', eta: 'Delivered 2 Aug',
        items: [{ name: 'SOKO Aero Helmet', qty: 1, price: 85000, img: '/images/accessory-helmet.webp' }], total: 85000, address: { name: 'Chidi Okeke', phone: '+234 801 234 5678', line1: '14 Adeola Close, Yaba', city: 'Lagos', state: 'Lagos', country: 'Nigeria' } },
    ]);

    save(WISHLIST_KEY, { 'u-demo': ['0002-cargo', '0003-trail', 'acc-helmet'] });
    save(WALLET_KEY, { 'u-demo': {
      balance: 48500,
      transactions: [
        { id: 'tx-3', type: 'debit', label: 'Payment · SOKO Swap Battery', amount: 320000, date: '2026-09-17' },
        { id: 'tx-2', type: 'credit', label: 'Referral bonus · invited Amara', amount: 25000, date: '2026-08-11' },
        { id: 'tx-1', type: 'debit', label: 'Payment · SOKO 01 · Commuter', amount: 1350000, date: '2026-08-30' },
      ],
    }});
    save(NOTIF_KEY, { 'u-demo': [
      { id: 'n1', title: 'Order on the move', body: 'Your Swap Battery (SM-2533) is out for delivery.', time: '2h ago', unread: true },
      { id: 'n2', title: 'Welcome to the garage', body: 'Your SOKO 01 has been registered to your account.', time: '3w ago', unread: false },
      { id: 'n3', title: 'Warranty reminder', body: 'Book your 1,000 km service to keep warranty valid.', time: '1mo ago', unread: true },
    ]});
    save(ADDR_KEY, { 'u-demo': [
      { id: 'a1', label: 'Home', name: 'Chidi Okeke', phone: '+234 801 234 5678', line1: '14 Adeola Close, Yaba', line2: '', city: 'Lagos', state: 'Lagos', country: 'Nigeria', isDefault: true },
      { id: 'a2', label: 'Office', name: 'Chidi Okeke', phone: '+234 801 234 5678', line1: '3B Marina Road', line2: 'Victoria Island', city: 'Lagos', state: 'Lagos', country: 'Nigeria', isDefault: false },
    ]});
    save(CARDS_KEY, { 'u-demo': [
      { id: 'c1', brand: 'Visa', last4: '4402', exp: '11/27', isDefault: true },
      { id: 'c2', brand: 'Mastercard', last4: '8810', exp: '03/26', isDefault: false },
    ]});
    save(GARAGE_KEY, { 'u-demo': [
      { id: 'g1', model: 'SOKO 01 · Commuter', serial: 'SM1-2026-04812', registered: '2026-09-01', warrantyUntil: '2028-09-01', fromOrder: 'ORD-1042' },
    ]});
    save(TICKETS_KEY, { 'u-demo': [
      { id: 't1', type: 'service', subject: 'Book 1,000 km service', status: 'open', date: '2026-09-15', detail: 'First scheduled maintenance for my SOKO 01.' },
      { id: 't2', type: 'returns', subject: 'Swap battery charge query', status: 'resolved', date: '2026-08-20', detail: 'Battery drained faster than expected, resolved after swap-tip guidance.' },
    ]});
    save(PREFS_KEY, { 'u-demo': { orderUpdates: true, promos: true, sms: false } });
    save(REFS_KEY, { 'u-demo': { code: 'SOKO-CHIDI', invited: 2, earned: 25000 } });
  }

  // Admin dataset, seeded independently (idempotent)
  if (!load(A_ORDERS, null)) {
    save(A_ORDERS, [
      { id: 'ORD-1066', customer: 'Amara Eze', email: 'amara@example.com', items: 1, total: 2450000, status: 'processing', date: '2026-09-21' },
      { id: 'ORD-1065', customer: 'Tunde Alabi', email: 'tunde@example.com', items: 2, total: 380000, status: 'paid', date: '2026-09-21' },
      { id: 'ORD-1064', customer: 'Ngozi Umeh', email: 'ngozi@example.com', items: 1, total: 1350000, status: 'shipped', date: '2026-09-20' },
      { id: 'ORD-1063', customer: 'Guest #1182', email: '', items: 1, total: 1650000, status: 'paid', date: '2026-09-20' },
      { id: 'ORD-1062', customer: 'Sarah Bello', email: 'sarah@example.com', items: 1, total: 85000, status: 'delivered', date: '2026-09-19' },
      { id: 'ORD-1061', customer: 'Chidi Okeke', email: 'chidi@example.com', items: 1, total: 320000, status: 'shipped', date: '2026-09-18' },
      { id: 'ORD-1060', customer: 'Guest #1174', email: '', items: 1, total: 65000, status: 'cancelled', date: '2026-09-17' },
      { id: 'ORD-1059', customer: 'Ibrahim Musa', email: 'ibrahim@example.com', items: 1, total: 1890000, status: 'delivered', date: '2026-09-16' },
    ]);
  }
  if (!load(A_INV, null)) {
    const SOLD_30 = { '0001-commuter': 14, '0001-deluxe': 6, '0002-cargo': 9, '0003-trail': 5, '0001-pro': 4, 'acc-battery': 21, 'acc-helmet': 17, 'acc-charger': 13, 'acc-lock': 8 };
    save(A_INV, PRODUCTS.map((p) => ({ ...p, sold: SOLD_30[p.id] || 0, status: p.stock === 0 ? 'out' : p.stock <= 6 ? 'low' : 'in' })));
  }
  if (!load(A_CUST, null)) {
    save(A_CUST, [
      { name: 'Chidi Okeke', email: 'chidi@example.com', joined: '2024-11-02', orders: 3, spent: 1755000, city: 'Lagos' },
      { name: 'Amara Eze', email: 'amara@example.com', joined: '2025-01-14', orders: 5, spent: 6120000, city: 'Abuja' },
      { name: 'Ibrahim Musa', email: 'ibrahim@example.com', joined: '2025-03-02', orders: 4, spent: 4710000, city: 'Kano' },
      { name: 'Tunde Alabi', email: 'tunde@example.com', joined: '2025-06-20', orders: 2, spent: 920000, city: 'Ibadan' },
      { name: 'Ngozi Umeh', email: 'ngozi@example.com', joined: '2025-08-09', orders: 1, spent: 1350000, city: 'Port Harcourt' },
      { name: 'Sarah Bello', email: 'sarah@example.com', joined: '2026-01-05', orders: 1, spent: 85000, city: 'Lagos' },
    ]);
  }
  if (!load(A_SETTINGS, null)) {
    save(A_SETTINGS, { storeName: 'SOKO Moto', supportEmail: 'support@sokomoto.ng', gateway: 'Paystack', currency: '₦', taxRate: 7.5, ordersEnabled: true, lowStockThreshold: 6, notifyNewOrder: true, notifyLowStock: true });
  }
}

/* ── Auth ──────────────────────────────────────────────────────── */
const getUsers = () => load(USERS_KEY, []);

export function signup({ name, email, password }) {
  ensureSeeded();
  const users = getUsers();
  const em = String(email || '').trim().toLowerCase();
  if (!name || !em || !password) return { error: 'Please fill every field.' };
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' };
  if (users.some((u) => u.email === em)) return { error: 'An account with this email already exists.' };
  const user = { id: 'u-' + Date.now(), name: name.trim(), email: em, password, role: 'customer', joined: new Date().toISOString().slice(0, 10), phone: '', city: '' };
  users.push(user);
  save(USERS_KEY, users);
  save(SESSION_KEY, { userId: user.id, name: user.name, email: user.email, role: user.role });
  return { user: safeUser(user) };
}

export function login(email, password) {
  ensureSeeded();
  const em = String(email || '').trim().toLowerCase();
  const user = getUsers().find((u) => u.email === em && u.password === password);
  if (!user) return { error: 'Email or password is incorrect.' };
  save(SESSION_KEY, { userId: user.id, name: user.name, email: user.email, role: user.role });
  return { user: safeUser(user) };
}

export function logout() { localStorage.removeItem(SESSION_KEY); }
export const getSession = () => load(SESSION_KEY, null);
export function currentUser() {
  const s = getSession();
  if (!s) return null;
  const u = getUsers().find((x) => x.id === s.userId);
  return safeUser(u) || (s && { id: s.userId, name: s.name, email: s.email, role: s.role, joined: '', phone: '', city: '' });
}
export const isLoggedIn = () => !!getSession();
export const isAdmin = () => (getSession() || {}).role === 'admin';

export function updateProfile({ name, phone, city }) {
  const s = getSession();
  if (!s) return;
  const users = getUsers();
  const u = users.find((x) => x.id === s.userId);
  if (u) {
    if (name) u.name = name.trim();
    if (phone !== undefined) u.phone = phone.trim();
    if (city !== undefined) u.city = city.trim();
    save(USERS_KEY, users);
    save(SESSION_KEY, { ...s, name: u.name });
  }
  return currentUser();
}

export function changePassword(current, next) {
  const s = getSession();
  if (!s) return { error: 'Not signed in.' };
  const users = getUsers();
  const u = users.find((x) => x.id === s.userId);
  if (!u) return { error: 'Account not found.' };
  if (u.password !== current) return { error: 'Current password is incorrect.' };
  if (!next || next.length < 8) return { error: 'New password must be at least 8 characters.' };
  u.password = next;
  save(USERS_KEY, users);
  return { ok: true };
}

export function deleteAccount() {
  const userId = (getSession() || {}).userId;
  if (!userId) return;
  save(USERS_KEY, getUsers().filter((u) => u.id !== userId));
  const scrape = (key) => { const m = load(key, {}); if (m && typeof m === 'object') { delete m[userId]; save(key, m); } };
  [WISHLIST_KEY, WALLET_KEY, NOTIF_KEY, ADDR_KEY, CARDS_KEY, GARAGE_KEY, TICKETS_KEY, PREFS_KEY, REFS_KEY].forEach(scrape);
  save(ORDERS_KEY, load(ORDERS_KEY, []).filter((o) => o.userId !== userId));
  logout();
}

/* ── Orders (user) ─────────────────────────────────────────────── */
const allOrders = () => load(ORDERS_KEY, []);
export const ordersFor = (userId) => allOrders().filter((o) => o.userId === userId);
export function addOrder(order) {
  const orders = allOrders();
  orders.unshift({ ...order, id: 'ORD-' + (1570 + orders.length), userId: getSession()?.userId, date: new Date().toISOString().slice(0, 10) });
  save(ORDERS_KEY, orders);
  return orders[0];
}
export function cancelOrder(orderId) {
  const orders = allOrders();
  const o = orders.find((x) => x.id === orderId);
  if (o && ['paid', 'processing'].includes(o.status)) {
    o.status = 'cancelled';
    o.eta = 'Cancelled';
    save(ORDERS_KEY, orders);
  }
  return ordersFor((getSession() || {}).userId);
}
export function reorderOrder(orderId) {
  const o = allOrders().find((x) => x.id === orderId);
  if (!o) return false;
  o.items.forEach((it) => {
    const prod = PRODUCTS.find((p) => p.name === it.name);
    addToCart({ id: prod ? prod.id : 'custom-' + Date.now(), name: it.name, shortName: it.name, price: it.price, img: it.img, color: 'Graphite' }, it.qty);
  });
  return true;
}
export function orderTimeline(status) {
  if (status === 'cancelled') return [{ label: 'Order placed', done: true }, { label: 'Cancelled', done: true }];
  const idx = ORDER_FLOW.indexOf(status);
  const labels = ['Payment confirmed', 'Processing', 'Shipped', 'Delivered'];
  return labels.map((label, i) => ({ label, done: i <= idx }));
}
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function orderInvoiceHTML(order, user) {
  const t = new Date(order.date).toDateString();
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ${esc(order.id)}</title>
  <style>body{font-family:system-ui,Segoe UI,sans-serif;color:#14120e;max-width:640px;margin:40px auto;padding:0 20px;line-height:1.5}
  h1{font-size:22px;margin:0}h2{font-size:15px;color:#6d6a62;font-weight:600}
  table{width:100%;border-collapse:collapse;margin:18px 0}td,th{padding:8px 6px;border-bottom:1px solid #e3ddd1;text-align:left;font-size:13px}
  .tot{font-weight:700}.muted{color:#6d6a62}.row{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap}
  .brand{color:#ff5a1f;font-weight:700;letter-spacing:1px}.address{margin:8px 0}</style></head>
  <body><div style="display:flex;justify-content:space-between;align-items:flex-start">
  <div><div class="brand">SOKO·MOTO</div><div class="muted">Invoice</div><h1>${esc(order.id)}</h1></div>
  <div style="text-align:right"><div class="muted">${t}</div><div>Ref ${esc(order.ref)}</div></div></div>
  <div class="row"><div><h2>Billed to</h2><div>${esc(user.name)}</div><div class="muted">${esc(user.email)}</div></div>
  <div><h2>Ship to</h2><div>${esc(order.address ? order.address.name : user.name)}</div><div class="muted">${esc(order.address ? order.address.line1 + ', ' + order.address.city : user.city)}</div></div></div>
  <table><thead><tr><th>Item</th><th>Qty</th><th style="text-align:right">Price</th></tr></thead>
  <tbody>${order.items.map((i) => `<tr><td>${esc(i.name)}</td><td>${i.qty}</td><td style="text-align:right">${money(i.price)}</td></tr>`).join('')}</tbody></table>
  <div style="text-align:right;font-size:15px"><span class="muted">Total&nbsp;</span><span class="tot">${money(order.total)}</span></div>
  <div class="muted" style="margin-top:30px;font-size:12px">SOKO Moto hub · Guangzhou, China · questions: support@sokomoto.ng</div>
  <script>window.onload=()=>window.print()</script></body></html>`;
}

/* ── Wishlist ──────────────────────────────────────────────────── */
const wishMap = () => load(WISHLIST_KEY, {});
const wishIds = (userId) => (wishMap()[userId] || []);
export const isWishlisted = (userId, pid) => wishIds(userId).includes(pid);
export const wishlistProducts = (userId) => PRODUCTS.filter((p) => wishIds(userId).includes(p.id));
export function toggleWishlist(userId, pid) {
  const map = wishMap();
  const list = map[userId] || [];
  map[userId] = list.includes(pid) ? list.filter((x) => x !== pid) : [...list, pid];
  save(WISHLIST_KEY, map);
  return map[userId];
}
export function moveWishlistToCart(userId, pid) {
  const p = PRODUCTS.find((x) => x.id === pid);
  if (p) addToCart({ id: p.id, name: p.name, shortName: p.name, price: p.price, img: p.img, color: 'Graphite' }, 1);
  toggleWishlist(userId, pid);
}

/* ── Wallet & cards ────────────────────────────────────────────── */
export const getWallet = (userId) => (load(WALLET_KEY, {})[userId]) || { balance: 0, transactions: [] };
export function topUpWallet(userId, amount, via = 'Card top-up') {
  const wallets = load(WALLET_KEY, {});
  const w = wallets[userId] || { balance: 0, transactions: [] };
  w.balance += amount;
  w.transactions.unshift({ id: uid('tx'), type: 'credit', label: via, amount, date: new Date().toISOString().slice(0, 10) });
  wallets[userId] = w;
  save(WALLET_KEY, wallets);
  return w;
}
export const getCards = (userId) => (load(CARDS_KEY, {})[userId]) || [];
export function addCard(userId, { brand, last4, exp }) {
  const map = load(CARDS_KEY, {});
  const list = map[userId] || [];
  list.push({ id: uid('c'), brand, last4, exp, isDefault: list.length === 0 });
  map[userId] = list;
  save(CARDS_KEY, map);
  return list;
}
export function removeCard(userId, cardId) {
  const map = load(CARDS_KEY, {});
  map[userId] = (map[userId] || []).filter((c) => c.id !== cardId);
  save(CARDS_KEY, map);
  return map[userId];
}
export function setDefaultCard(userId, cardId) {
  const map = load(CARDS_KEY, {});
  map[userId] = (map[userId] || []).map((c) => ({ ...c, isDefault: c.id === cardId }));
  save(CARDS_KEY, map);
}

/* ── Addresses ─────────────────────────────────────────────────── */
export const getAddresses = (userId) => (load(ADDR_KEY, {})[userId]) || [];
export function saveAddress(userId, addr) {
  const map = load(ADDR_KEY, {});
  const list = map[userId] || [];
  const isNew = !addr.id;
  const id = addr.id || uid('a');
  const rec = { ...addr, id, isDefault: addr.isDefault || list.length === 0 };
  if (rec.isDefault) list.forEach((a) => (a.isDefault = false));
  map[userId] = isNew ? [...list, rec] : list.map((a) => (a.id === id ? rec : a));
  save(ADDR_KEY, map);
  return map[userId];
}
export function removeAddress(userId, addrId) {
  const map = load(ADDR_KEY, {});
  map[userId] = (map[userId] || []).filter((a) => a.id !== addrId);
  save(ADDR_KEY, map);
}
export function setDefaultAddress(userId, addrId) {
  const map = load(ADDR_KEY, {});
  map[userId] = (map[userId] || []).map((a) => ({ ...a, isDefault: a.id === addrId }));
  save(ADDR_KEY, map);
}

/* ── Garage (registered bikes) ─────────────────────────────────── */
export const getGarage = (userId) => (load(GARAGE_KEY, {})[userId]) || [];
export function registerBike(userId, { model, serial }) {
  const map = load(GARAGE_KEY, {});
  const list = map[userId] || [];
  const d = new Date();
  const until = new Date(d); until.setFullYear(until.getFullYear() + 2);
  list.unshift({ id: uid('g'), model, serial: serial || 'SM-' + Math.floor(10000 + Math.random() * 89999), registered: d.toISOString().slice(0, 10), warrantyUntil: until.toISOString().slice(0, 10), fromOrder: null });
  map[userId] = list;
  save(GARAGE_KEY, map);
  return list;
}

/* ── Support tickets ───────────────────────────────────────────── */
export const getTickets = (userId) => (load(TICKETS_KEY, {})[userId]) || [];
export function addTicket(userId, { type, subject, detail }) {
  const map = load(TICKETS_KEY, {});
  map[userId] = [{ id: uid('t'), type, subject, status: 'open', date: new Date().toISOString().slice(0, 10), detail }, ...(map[userId] || [])];
  save(TICKETS_KEY, map);
  return map[userId];
}

/* ── Notifications & prefs ─────────────────────────────────────── */
export const getNotifs = (userId) => (load(NOTIF_KEY, {})[userId]) || [];
export function pushNotif(userId, { title, body }) {
  const map = load(NOTIF_KEY, {});
  map[userId] = [{ id: uid('n'), title, body, time: 'Just now', unread: true }, ...(map[userId] || [])];
  save(NOTIF_KEY, map);
}

/* ── Unit verification bookings (live video at the Guangzhou bench) ── */
export const getVerifications = (userId) => load(VERIFY_KEY, []).filter((v) => !userId || v.userId === userId);
export function bookVerification({ name, phone, email, model, date, slot }) {
  const ref = 'VR-' + String(Math.floor(1000 + Math.random() * 9000));
  const u = currentUser();
  const rec = { ref, userId: u ? u.id : null, name, phone, email, model, date, slot, created: new Date().toISOString(), status: 'booked' };
  save(VERIFY_KEY, [rec, ...load(VERIFY_KEY, [])]);
  if (u) pushNotif(u.id, { title: `Verification booked · ${ref}`, body: `${model} on the Guangzhou bench, ${date} at ${slot} WAT. Your live link arrives by WhatsApp 10 minutes before.` });
  return rec;
}
export function markAllRead(userId) {
  const map = load(NOTIF_KEY, {});
  map[userId] = (map[userId] || []).map((n) => ({ ...n, unread: false }));
  save(NOTIF_KEY, map);
}
export function markNotifRead(userId, nid) {
  const map = load(NOTIF_KEY, {});
  map[userId] = (map[userId] || []).map((n) => (n.id === nid ? { ...n, unread: false } : n));
  save(NOTIF_KEY, map);
}
export function deleteNotif(userId, nid) {
  const map = load(NOTIF_KEY, {});
  map[userId] = (map[userId] || []).filter((n) => n.id !== nid);
  save(NOTIF_KEY, map);
}
export const getPrefs = (userId) => (load(PREFS_KEY, {})[userId]) || { orderUpdates: true, promos: true, sms: false };
export function setPrefs(userId, prefs) {
  const map = load(PREFS_KEY, {});
  map[userId] = prefs;
  save(PREFS_KEY, map);
}

/* ── Referral ──────────────────────────────────────────────────── */
export function getReferral(userId, name = '') {
  const map = load(REFS_KEY, {});
  if (map[userId]) return map[userId];
  const code = 'SOKO-' + String(name || 'RIDER').replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toUpperCase();
  const rec = { code, invited: 0, earned: 0 };
  map[userId] = rec;
  save(REFS_KEY, map);
  return rec;
}

/* ── Admin dataset (persisted) ─────────────────────────────────── */
export const adminKPIs = () => ({
  revenue: 26900000, revenueDelta: 18.2,
  orders: 512, ordersDelta: 9.4,
  aov: 52400, aovDelta: -2.3,
  customers: 1328, newCustomersLast30: 46,
});
export const adminRevenue = (count = 6) => [1.42, 1.61, 1.38, 1.95, 2.24, 2.05, 2.51, 2.78, 2.4, 2.9, 3.1, 2.6].slice(-count);
export const adminOrdersTrend = () => [31, 38, 34, 41, 47, 44, 52, 50, 55, 49, 61, 58].map((v, i) => ({ w: 'W' + (i + 1), v: Math.min(100, Math.round(v / 0.7)) }));
export const orderStatuses = ['all', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'];
export const adminOrders = () => load(A_ORDERS, []);
export function setOrderStatus(orderId, status) {
  const orders = load(A_ORDERS, []);
  const o = orders.find((x) => x.id === orderId);
  if (o) o.status = status;
  save(A_ORDERS, orders);
  return orders;
}
export const adminInventory = () => load(A_INV, []);
export function adjustAdminStock(id, delta) {
  const inv = load(A_INV, []);
  const p = inv.find((x) => x.id === id);
  if (p) {
    p.stock = Math.max(0, p.stock + delta);
    p.status = p.stock === 0 ? 'out' : p.stock <= (getAdminSettings().lowStockThreshold || 6) ? 'low' : 'in';
  }
  save(A_INV, inv);
  return inv;
}
export function updateAdminPrice(id, price) {
  const inv = load(A_INV, []);
  const p = inv.find((x) => x.id === id);
  if (p) p.price = Math.max(0, Number(price) || 0);
  save(A_INV, inv);
  return inv;
}
export function addAdminProduct(p) {
  const inv = load(A_INV, []);
  inv.push({ id: uid('p'), name: p.name, cat: p.cat || p.category || 'Accessory', price: Number(p.price) || 0, img: p.img || '/images/accessory-helmet.webp', stock: Number(p.stock) || 0, sold: 0, sku: p.sku || 'SM-NEW-' + inv.length, status: 'in' });
  save(A_INV, inv);
  return inv;
}
export function removeAdminProduct(id) {
  save(A_INV, load(A_INV, []).filter((p) => p.id !== id));
}
export const adminCustomers = () => load(A_CUST, []);
export const getAdminSettings = () => load(A_SETTINGS, {});
export function setAdminSetting(key, value) {
  const s = load(A_SETTINGS, {});
  s[key] = value;
  save(A_SETTINGS, s);
  return s;
}
export function resetAdminData() {
  [A_ORDERS, A_INV, A_CUST, A_SETTINGS].forEach((k) => localStorage.removeItem(k));
  ensureSeeded();
}
export const adminLowStock = () => {
  const th = getAdminSettings().lowStockThreshold || 6;
  return adminInventory().filter((p) => p.stock <= th);
};
export const adminCategoryValue = () => {
  const map = {};
  adminInventory().forEach((p) => { map[p.cat] = (map[p.cat] || 0) + p.price * p.stock; });
  return Object.entries(map).map(([cat, value]) => ({ name: cat, value })).sort((a, b) => b.value - a.value);
};
export const adminStatusBreakdown = () => {
  const counts = {};
  const statuses = ['paid', 'processing', 'shipped', 'delivered', 'cancelled'];
  const orders = adminOrders();
  statuses.forEach((s) => (counts[s] = orders.filter((o) => o.status === s).length));
  return statuses.map((s) => ({ status: s, count: counts[s], pct: orders.length ? Math.round((counts[s] / orders.length) * 100) : 0 }));
};
export const adminTopProducts = () =>
  [...adminInventory()].sort((a, b) => b.sold - a.sold).slice(0, 5).map((p) => ({ name: p.name, sold: p.sold, value: p.price * p.sold }));

/* ── Navbar account UI ─────────────────────────────────────────── */
export function initAccountUI() {
  const user = currentUser();
  const admin = isAdmin();
  const initials = user
    ? user.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '';

  document.querySelectorAll('.js-account-link').forEach((a) => {
    a.href = user ? '/pages/dashboard.html' : '/pages/login.html';
    a.setAttribute('aria-label', user ? 'Your dashboard' : 'Sign in');
    a.setAttribute('title', user ? 'Dashboard' : 'Sign in');
    // Class-based swap: lucide replaces <i> with <svg>, so attribute flags on
    // the icon element can't be trusted, the anchor class survives that.
    a.classList.toggle('is-authed', !!user);
    const avatar = a.querySelector('.js-account-avatar');
    const icon = a.querySelector('.js-account-icon');
    if (avatar) {
      avatar.hidden = !user;
      avatar.textContent = initials;
    }
    if (icon) {
      if (user) icon.setAttribute('hidden', '');
      else icon.removeAttribute('hidden');
    }
  });
  document.querySelectorAll('.js-account-dot').forEach((d) => { d.hidden = !user; });
  document.querySelectorAll('.js-wish-link').forEach((a) => {
    a.href = user ? '/pages/dashboard.html#wishlist' : '/pages/login.html';
    a.setAttribute('aria-label', user ? 'Your wishlist' : 'Sign in for wishlist');
  });
  document.querySelectorAll('.js-account-link-mobile').forEach((a) => {
    a.href = user ? '/pages/dashboard.html' : '/pages/login.html';
    const small = a.querySelector('small');
    if (small) small.textContent = user ? user.name.split(' ')[0] : 'Sign in';
    const [firstText] = a.childNodes;
    if (firstText && firstText.nodeType === 3) firstText.textContent = user ? 'Dashboard' : 'Account';
  });

  if (admin && !document.querySelector('.js-admin-link')) {
    const btn = document.createElement('a');
    btn.className = 'icon-btn js-admin-link';
    btn.href = '/pages/admin.html';
    btn.setAttribute('aria-label', 'Admin dashboard');
    btn.innerHTML = '<i data-lucide="layout-dashboard" class="icon-18"></i>';
    document.querySelector('.nav-actions')?.prepend(btn);
  }
  if (admin && !document.querySelector('.js-admin-link-mobile')) {
    const a = document.createElement('a');
    a.className = 'mobile-menu__link js-admin-link-mobile';
    a.href = '/pages/admin.html';
    a.innerHTML = 'Admin <small>Store control</small>';
    document.querySelector('.mobile-menu')?.insertBefore(a, document.querySelector('.mobile-menu').firstChild);
  }
}
