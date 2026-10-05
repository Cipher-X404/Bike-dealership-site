// smoke.mjs — full localStorage store contract bench (account.js + cartstore.js).
// Pure Node: Map-based storage shims, no DOM. ~54 assertions.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => void store.set(String(k), String(v)),
  removeItem: (k) => void store.delete(String(k)),
  clear: () => void store.clear(),
};
globalThis.sessionStorage = {
  getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {},
};

const A = await import(path.join(ROOT, 'src/js/account.js'));
const C = await import(path.join(ROOT, 'src/js/cartstore.js'));

let pass = 0; let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log('  ok  ' + label); }
  else { fail++; console.log('  FAIL ' + label); }
};
const raw = (k) => JSON.parse(store.get(k) || 'null');

// ── 1. Seeding ──────────────────────────────────────────────────
console.log('── seeding ──');
A.ensureSeeded();
const users = raw('soko-users-v1');
ok(users.length === 2, 'seeds exactly 2 users');
ok(users.find((u) => u.id === 'u-demo')?.role === 'customer', 'demo user is customer');
ok(users.find((u) => u.id === 'u-admin')?.role === 'admin', 'admin user is admin');
ok(raw('soko-orders-v1').filter((o) => o.userId === 'u-demo').length === 3, 'demo has 3 seeded orders');
ok(raw('soko-wishlist-v1')['u-demo'].length === 3, 'demo wishlist seeded (3 ids)');
const w0 = raw('soko-wallet-v1')['u-demo'];
ok(w0.balance === 48500 && w0.transactions.length === 3, 'demo wallet 48,500 + 3 tx');
ok(raw('soko-refs-v1')['u-demo'].code === 'SOKO-CHIDI', 'referral code SOKO-CHIDI');
ok(raw('soko-a-orders-v1').length === 8, 'admin orders seeded (8)');
A.ensureSeeded();
ok(users.length === raw('soko-users-v1').length, 'ensureSeeded idempotent');

// ── 2. Cart ─────────────────────────────────────────────────────
console.log('── cart ──');
C.saveCart([]);
C.addToCart({ id: 'x1', name: 'Bike X', shortName: 'Bike X', price: 100, img: '', color: 'Sand' }, 2);
ok(C.loadCart().length === 1 && C.loadCart()[0].qty === 2, 'addToCart inserts with qty');
C.addToCart({ id: 'x1', name: 'Bike X', price: 100, img: '', color: 'Sand' }, 3);
ok(C.loadCart()[0].qty === 5, 'addToCart merges qty');
C.addToCart({ id: 'x1', name: 'Bike X', price: 100, img: '', color: 'Sand' }, 9);
ok(C.loadCart()[0].qty === 9, 'qty clamps at 9');
C.setQty('x1', 0);
ok(C.loadCart()[0].qty === 0, 'setQty clamps at 0');
C.setQty('x1', 4);
ok(C.cartCount() === 4 && C.cartTotal() === 400, 'count + total after setQty');
ok(C.money(1350000) === '₦1,350,000', 'money formats ₦ with grouping');
C.removeItem('x1');
ok(C.loadCart().length === 0, 'removeItem clears line');

// ── 3. Auth ─────────────────────────────────────────────────────
console.log('── auth ──');
ok(A.login('chidi@example.com', 'nope').error !== undefined, 'wrong password rejected');
const lg = A.login('chidi@example.com', 'demo1234');
ok(lg.user?.id === 'u-demo' && A.isLoggedIn(), 'demo login works');
ok(A.currentUser().email === 'chidi@example.com', 'currentUser resolves session');
ok(A.isAdmin() === false, 'customer is not admin');
A.updateProfile({ phone: '+234 999 000 111', city: 'Port Harcourt' });
ok(A.currentUser().city === 'Port Harcourt', 'updateProfile persists city');
ok(A.changePassword('wrong', 'newpass123').error !== undefined, 'changePassword rejects wrong current');
ok(A.changePassword('demo1234', 'demo1234x').ok === true, 'changePassword succeeds');
A.logout();
ok(!A.isLoggedIn(), 'logout clears session');
A.login('chidi@example.com', 'demo1234x');
ok(A.currentUser().id === 'u-demo', 'login with new password works');
A.logout();
const su = A.signup({ name: 'Smoke Tester', email: 'smoke@test.ng', password: 'short' });
ok(su.error !== undefined, 'signup rejects short password');
const su2 = A.signup({ name: 'Smoke Tester', email: 'smoke@test.ng', password: 'password1' });
ok(su2.user?.id !== undefined, 'signup creates user');
ok(A.currentUser().email === 'smoke@test.ng', 'signup auto-sessions');
ok(A.signup({ name: 'Dup', email: 'smoke@test.ng', password: 'password1' }).error !== undefined, 'duplicate email rejected');
A.logout();

// ── 4. Orders (as demo user) ────────────────────────────────────
console.log('── orders ──');
A.login('chidi@example.com', 'demo1234x');
const before = A.ordersFor('u-demo').length;
const stockBeforeOrder = A.adminInventory().find((p) => p.id === '0001-commuter').stock;
const no = A.addOrder({ ref: 'SM-9000', status: 'processing', paymentStatus: 'simulated', eta: '3–5 days', items: [{ id: '0001-commuter', name: 'SOKO 01 · Commuter', qty: 1, price: 1350000, img: 'images/bike-commuter.webp' }], total: 1350000, address: { name: 'Chidi Okeke', line1: '14 Adeola Close', city: 'Lagos' } });
ok(/^ORD-\d+$/.test(no.id) && no.userId === 'u-demo', 'addOrder stamps id + userId');
ok(A.ordersFor('u-demo').length === before + 1, 'ordersFor sees new order');
ok(A.adminOrders().some((o) => o.id === no.id && o.customer === 'Chidi Okeke'), 'new member order also appears in the workshop desk');
ok(A.adminInventory().find((p) => p.id === '0001-commuter').stock === stockBeforeOrder - 1, 'new order decrements matching inventory');
A.cancelOrder(no.id);
ok(A.ordersFor('u-demo').find((o) => o.id === no.id).status === 'cancelled', 'cancelOrder cancels processing order');
ok(A.adminOrders().find((o) => o.id === no.id).status === 'cancelled', 'member cancellation syncs to workshop desk');
ok(A.adminInventory().find((p) => p.id === '0001-commuter').stock === stockBeforeOrder, 'cancelling the order restores stock');
A.setOrderStatus(no.id, 'processing');
ok(A.adminInventory().find((p) => p.id === '0001-commuter').stock === stockBeforeOrder - 1, 'reopening a cancelled order reapplies inventory once');
A.setOrderStatus(no.id, 'cancelled');
ok(A.ordersFor('u-demo').find((o) => o.id === no.id).status === 'cancelled', 'admin cancellation syncs back to the member order');
ok(A.adminInventory().find((p) => p.id === '0001-commuter').stock === stockBeforeOrder, 'admin cancellation restores stock exactly once');
const deliv = A.ordersFor('u-demo').find((o) => o.status === 'delivered');
A.cancelOrder(deliv.id);
ok(A.ordersFor('u-demo').find((o) => o.id === deliv.id).status === 'delivered', 'cancelOrder refuses delivered');
const tl = A.orderTimeline('shipped');
ok(tl.length === 4 && tl.filter((s) => s.done).length === 3, 'orderTimeline(shipped) 3/4 done');
ok(A.orderTimeline('cancelled').length === 2, 'orderTimeline(cancelled) 2 steps');
C.saveCart([]);
ok(A.reorderOrder('ORD-1042') === true && C.loadCart().some((i) => i.id === '0001-commuter'), 'reorder adds line back to cart');
const inv = A.orderInvoiceHTML(no, A.currentUser());
ok(inv.includes(no.id) && inv.includes('₦1,350,000'), 'invoice HTML has id + total');

// ── 5. Wishlist ─────────────────────────────────────────────────
console.log('── wishlist ──');
ok(A.isWishlisted('u-demo', '0002-cargo'), 'seeded item wishlisted');
A.toggleWishlist('u-demo', '0002-cargo');
ok(!A.isWishlisted('u-demo', '0002-cargo'), 'toggle removes');
A.toggleWishlist('u-demo', '0002-cargo');
ok(A.isWishlisted('u-demo', '0002-cargo'), 'toggle adds back');
C.saveCart([]);
A.moveWishlistToCart('u-demo', '0002-cargo');
ok(!A.isWishlisted('u-demo', '0002-cargo') && C.loadCart().some((i) => i.id === '0002-cargo'), 'moveWishlistToCart moves line');

// ── 6. Wallet / cards / addresses ───────────────────────────────
console.log('── wallet·cards·addresses ──');
const wb = A.getWallet('u-demo').balance;
const w1 = A.topUpWallet('u-demo', 10000, 'Test top-up');
ok(w1.balance === wb + 10000 && w1.transactions[0].type === 'credit', 'topUp credits + records tx');
const cards = A.getCards('u-demo');
A.addCard('u-demo', { brand: 'Verve', last4: '7788', exp: '09/28' });
ok(A.getCards('u-demo').length === cards.length + 1, 'addCard appends');
const newCard = A.getCards('u-demo')[A.getCards('u-demo').length - 1];
A.setDefaultCard('u-demo', newCard.id);
ok(A.getCards('u-demo').filter((c) => c.isDefault).length === 1 && A.getCards('u-demo').find((c) => c.id === newCard.id).isDefault, 'setDefaultCard switches default');
A.removeCard('u-demo', newCard.id);
ok(A.getCards('u-demo').length === cards.length, 'removeCard deletes');
ok(A.getCards('u-demo').filter((c) => c.isDefault).length === 1, 'removing the default card promotes its successor');
const addrs = A.getAddresses('u-demo');
const after = A.saveAddress('u-demo', { label: 'Test', name: 'Chidi Okeke', phone: '+234 801 234 5678', line1: '1 Test St', line2: 'Unit 3', city: 'Lagos', state: 'Lagos', country: 'Nigeria' });
const na = after[after.length - 1];
ok(after.length === addrs.length + 1 && na.id && na.line2 === 'Unit 3', 'saveAddress appends and preserves line 2');
A.setDefaultAddress('u-demo', na.id);
ok(A.getAddresses('u-demo').find((a) => a.id === na.id).isDefault, 'setDefaultAddress works');
A.removeAddress('u-demo', na.id);
ok(A.getAddresses('u-demo').length === addrs.length, 'removeAddress deletes');
ok(A.getAddresses('u-demo').filter((a) => a.isDefault).length === 1, 'removing the default address promotes its successor');

// ── 7. Garage / tickets / notifs / prefs / referral ────────────
console.log('── garage·tickets·notifs·prefs ──');
const gar = A.getGarage('u-demo');
const gb = A.registerBike('u-demo', { model: 'SOKO 02 · Cargo', serial: 'SM2-2026-77777' });
ok(gb.length === gar.length + 1 && /2028/.test(gb[0].warrantyUntil), 'registerBike + 2y warranty (unshifted)');
const tk = A.getTickets('u-demo');
A.addTicket('u-demo', { type: 'service', subject: 'Smoke ticket', detail: 'bench test' });
ok(A.getTickets('u-demo').length === tk.length + 1 && A.getTickets('u-demo')[0].status === 'open', 'addTicket appends open');
const n0 = A.getNotifs('u-demo');
ok(n0.length === 3 && n0.some((n) => n.unread), 'seeded notifs (3, some unread)');
A.markNotifRead('u-demo', n0[0].id);
ok(!A.getNotifs('u-demo').find((n) => n.id === n0[0].id).unread, 'markNotifRead clears flag');
A.markAllRead('u-demo');
ok(A.getNotifs('u-demo').every((n) => !n.unread), 'markAllRead clears all');
A.deleteNotif('u-demo', n0[2].id);
ok(!A.getNotifs('u-demo').some((n) => n.id === n0[2].id), 'deleteNotif removes');
A.setPrefs('u-demo', { orderUpdates: false, promos: true, sms: true });
ok(A.getPrefs('u-demo').sms === true && A.getPrefs('u-demo').orderUpdates === false, 'setPrefs persists');
ok(A.getReferral('u-demo').code === 'SOKO-CHIDI', 'getReferral returns code');

// ── 8. Admin ────────────────────────────────────────────────────
console.log('── admin ──');
const kpi = A.adminKPIs();
ok(kpi.orders === 512 && kpi.revenue === 26900000, 'adminKPIs seeded shape');
ok(A.adminRevenue(6).length === 6 && A.adminOrdersTrend().length === 12, 'revenue + trend series');
ok(A.adminOrders().length === 9, 'adminOrders includes the new member order');
A.setOrderStatus('ORD-1065', 'shipped');
ok(A.adminOrders().find((o) => o.id === 'ORD-1065').status === 'shipped', 'setOrderStatus updates');
ok(A.adminCustomers().length === 6, 'adminCustomers 6');
const inv0 = A.adminInventory();
ok(inv0.length === A.PRODUCTS.length, 'adminInventory mirrors PRODUCTS');
ok(inv0.find((p) => p.id === '0003-trail').status === 'out' && inv0.find((p) => p.id === '0002-cargo').status === 'low', 'stock status derived (out/low)');
const lowBefore = A.adminLowStock();
ok(lowBefore.some((p) => p.id === '0003-trail') && lowBefore.some((p) => p.id === '0001-pro'), 'adminLowStock lists low items');
A.adjustAdminStock('0003-trail', 10);
ok(A.adminInventory().find((p) => p.id === '0003-trail').status === 'in', 'adjustAdminStock restores stock');
A.updateAdminPrice('acc-helmet', 90000);
ok(A.adminInventory().find((p) => p.id === 'acc-helmet').price === 90000, 'updateAdminPrice');
const invN = A.addAdminProduct({ name: 'Smoke Product', price: 12000, stock: 7 });
const added = invN[invN.length - 1];
ok(invN.length === inv0.length + 1 && /^p/.test(added.id), 'addAdminProduct appends');
A.removeAdminProduct(added.id);
ok(A.adminInventory().length === inv0.length, 'removeAdminProduct deletes');
const cb = A.adminStatusBreakdown();
ok(cb.length === 5 && cb.reduce((s, x) => s + x.count, 0) === A.adminOrders().length, 'statusBreakdown counts match');
const cv = A.adminCategoryValue();
ok(cv.length > 0 && cv[0].value >= cv[cv.length - 1].value, 'categoryValue sorted desc');
const tp = A.adminTopProducts();
ok(tp.length === 5 && tp[0].sold >= tp[1].sold, 'topProducts 5, sorted by sold');
A.setAdminSetting('taxRate', 7.8);
ok(A.getAdminSettings().taxRate === 7.8, 'setAdminSetting persists');
A.resetAdminData();
ok(A.adminOrders().length === 8 && A.getAdminSettings().taxRate === 7.5, 'resetAdminData restores seeds');

// ── 9. deleteAccount ────────────────────────────────────────────
console.log('── deleteAccount ──');
A.login('smoke@test.ng', 'password1');
A.deleteAccount();
ok(!A.isLoggedIn() && !raw('soko-users-v1').some((u) => u.email === 'smoke@test.ng'), 'deleteAccount removes user + session');

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
