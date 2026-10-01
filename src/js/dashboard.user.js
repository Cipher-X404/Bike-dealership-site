/*
 * dashboard.user.js, complete member dashboard controller
 * -----------------------------------------------------------------
 * Gated by session. Views (hash-routed): overview, orders, wishlist,
 * wallet, addresses, garage, support, notifications, settings.
 * Every action in the UI is backed by account.js and persisted.
 */
import {
  currentUser, logout, money, ensureSeeded,
  ordersFor, cancelOrder, reorderOrder, orderTimeline, orderInvoiceHTML,
  wishlistProducts, toggleWishlist, moveWishlistToCart,
  getWallet, topUpWallet, getCards, addCard, removeCard, setDefaultCard,
  getAddresses, saveAddress, removeAddress, setDefaultAddress,
  getGarage, registerBike,
  getTickets, addTicket,
  getNotifs, markAllRead, markNotifRead, deleteNotif,
  getPrefs, setPrefs, getReferral,
  updateProfile, changePassword, deleteAccount,
} from '/src/js/account.js';
import { hydrateIcons } from '/src/js/icons.js';
import { hydrateCartBadge } from '/src/js/badge.js';

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

ensureSeeded();
const user = currentUser();

/* ── helpers ───────────────────────────────────────────────────── */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

let toastTimer;
function toast(msg) {
  const t = $('.js-toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

let modalTimer;
function openModal(html) {
  closeModal();
  const el = document.createElement('div');
  el.className = 'dash-modal';
  el.innerHTML = `<div class="dash-modal__card">${html}</div>`;
  el.addEventListener('click', (e) => { if (e.target === el) closeModal(); });
  document.body.appendChild(el);
  hydrateIcons(el);
  return el;
}
function closeModal() { $$('.dash-modal').forEach((m) => m.remove()); clearTimeout(modalTimer); }

/* ── view routing ─────────────────────────────────────────────── */
const hideAll = () => $$('.js-view').forEach((v) => (v.hidden = true));
function showView(name) {
  hideAll();
  const panel = $(`[data-view-panel="${esc(name)}"]`);
  if (panel) panel.hidden = false;
  $$('.dash-nav [data-view]').forEach((a) => a.classList.toggle('is-active', a.dataset.view === name));
  const titles = { overview: 'Overview', orders: 'My orders', wishlist: 'Wishlist', wallet: 'Wallet & cards', addresses: 'Addresses', garage: 'My garage', support: 'Support', notifications: 'Notifications', settings: 'Settings' };
  $('.js-view-title').textContent = titles[name] || 'Overview';
  const path = $('.js-view-path'); if (path) path.textContent = name.toUpperCase();
  if (window.lenis) window.lenis.scrollTo(0, { immediate: true });
  else window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── guest guard ──────────────────────────────────────────────── */
if (!user) {
  $('.js-guest-guard').hidden = false;
  $('.js-app').hidden = true;
  hydrateIcons();
} else {
  $('.js-app').hidden = false;

  const initials = user.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  $('.js-user-initial').textContent = initials;
  $('.js-user-name').textContent = user.name;
  $('.js-user-email').textContent = user.email;
  $('.js-welcome-heading').textContent = `Welcome back, ${user.name.split(' ')[0]}.`;
  $('.js-welcome-body').textContent = 'Your garage is on file and your latest manifest is tracked from the Guangzhou bench to your door.';

  const renderAll = () => {
    renderOverview();
    renderOrders();
    renderWishlist();
    renderWallet();
    renderAddresses();
    renderGarage();
    renderTickets();
    renderNotifs();
    renderSettings();
    hydrateIcons();
  };

  /* ── Overview ───────────────────────────────────────────────── */
  function renderOverview() {
    const orders = ordersFor(user.id);
    const wallet = getWallet(user.id);
    const wish = wishlistProducts(user.id);
    const garage = getGarage(user.id);
    const kpis = [
      { label: 'Total orders', value: String(orders.length), icon: 'package' },
      { label: 'Saved rides', value: String(wish.length), icon: 'heart' },
      { label: 'Wallet credit', value: money(wallet.balance), icon: 'wallet' },
      { label: 'Garage', value: String(garage.length) + ' bike' + (garage.length === 1 ? '' : 's'), icon: 'gauge' },
    ];
    $('.js-kpis').innerHTML = kpis.map((k) => `<div class="kpi"><span class="kpi__label"><i data-lucide="${k.icon}" class="icon-16"></i> ${k.label}</span><div class="kpi__value">${k.value}</div></div>`).join('');

    $('.js-recent-orders').innerHTML = orders.length
      ? manifest(orders[0])
      : emptyBlock('No orders yet. Your first unit will show its route here, from the Guangzhou bench to your door.');

    const notifs = getNotifs(user.id).slice(0, 3);
    const ov = $('.js-overview-notifs');
    if (ov) ov.innerHTML = notifs.length ? notifs.map((n) => `<div class="notif ${n.unread ? 'unread' : ''}"><span class="notif__dot"></span><div style="flex:1"><b>${esc(n.title)}</b><p>${esc(n.body)}</p></div><time>${n.time}</time></div>`).join('') : `<p class="muted">Nothing new.</p>`;

    $('.js-quick-actions').innerHTML = [
      `<a class="chip-btn" href="#orders" data-goto="orders"><i data-lucide="package" class="icon-16"></i> Track orders</a>`,
      `<a class="chip-btn" href="/pages/shop.html"><i data-lucide="shopping-bag" class="icon-16"></i> Shop the lineup</a>`,
      `<a class="chip-btn" href="#garage" data-goto="garage"><i data-lucide="wrench" class="icon-16"></i> Book a service</a>`,
      `<a class="chip-btn" href="#support" data-goto="support"><i data-lucide="life-buoy" class="icon-16"></i> Get help</a>`,
    ].join('');
  }

  /* ── Shipping manifest (latest order, Guangzhou → your door) ─── */
  const ROUTE = ['Verified · Guangzhou', 'Packed', 'At sea', 'Cleared · Apapa', 'Delivered'];
  const ROUTE_POS = { paid: 0, processing: 1, shipped: 3, delivered: 4 };
  function manifest(o) {
    const cancelled = o.status === 'cancelled';
    const pos = cancelled ? -1 : (ROUTE_POS[o.status] ?? 0);
    const items = o.items || [];
    const qty = items.reduce((a, i) => a + (i.qty || 1), 0);
    return `<article class="manifest ${cancelled ? 'is-cancelled' : ''}" data-manifest>
      <div class="manifest__head">
        <div class="manifest__id">
          <span class="manifest__kicker">LATEST MANIFEST</span>
          <span class="manifest__ref">${esc(o.id)}</span>
          <span class="pill ${o.status}">${o.status}</span>
        </div>
        <div class="manifest__items">
          ${items.slice(0, 3).map((it) => `<span class="manifest__thumb"><img src="${it.img}" alt="" /></span>`).join('')}
          <b>${qty} item${qty === 1 ? '' : 's'}</b>
        </div>
        <div class="manifest__total"><span>TOTAL</span><b>${money(o.total)}</b></div>
      </div>
      <div class="manifest__route" aria-label="Shipping route">
        <span class="mr-line"></span>
        <span class="mr-progress" style="width:${cancelled ? 0 : Math.min(80, (pos / 4) * 80)}%"></span>
        ${ROUTE.map((label, i) => `<div class="mr-node ${i < pos ? 'done' : ''} ${i === pos ? (o.status === 'delivered' ? 'done' : 'doing') : ''}"><span class="mr-dot"></span><span class="mr-label">${label}</span></div>`).join('')}
      </div>
      ${cancelled ? '<p class="muted" style="margin-top:14px;font-size:0.85rem">This order was cancelled and refunded.</p>' : ''}
      <div class="card-actions" style="margin-top:20px">
        <button class="chip-btn js-order-detail" data-id="${esc(o.id)}" type="button" data-goto-detail><i data-lucide="eye" class="icon-16"></i> Details</button>
        <a class="chip-btn" href="#orders" data-goto="orders"><i data-lucide="package" class="icon-16"></i> All orders</a>
      </div>
    </article>`;
  }

  /* ── Orders ─────────────────────────────────────────────────── */
  function orderCard(o) {
    const tl = orderTimeline(o.status);
    const active = Math.max(0, tl.findIndex((s) => !s.done));
    return `<article class="order-card">
      <div class="order-card__head">
        <div><b>${esc(o.id)}</b><div class="meta">Ref ${esc(o.ref)} · ${o.date}</div></div>
        <span class="pill ${o.status}">${o.status}</span>
      </div>
      <div class="order-card__items">
        ${o.items.map((it) => `<div class="order-card__item"><span class="thumb" style="width:40px;height:40px;border-radius:10px;overflow:hidden;border:1px solid var(--color-line);background:var(--color-secondary)"><img src="${it.img}" alt="" /></span><span><b>${esc(it.name)}</b><small>${money(it.price)} × ${it.qty}</small></span></div>`).join('')}
      </div>
      ${o.status !== 'cancelled' && o.status !== 'delivered' ? `<div class="timeline-h" style="padding:0.4rem 0 0.2rem">${tl.map((s, i) => `<div class="tl-step ${s.done ? 'done' : ''} ${i === active ? 'doing' : ''}"><span class="tl-dot"></span><span class="tl-label">${s.label}</span></div>`).join('')}</div>` : `<div class="muted" style="font-size:0.85rem">${o.status === 'cancelled' ? 'This order was cancelled.' : 'Delivered, enjoy the ride.'}</div>`}
      <div class="order-card__foot">
        <div class="card-actions">
          <button class="chip-btn js-order-detail" data-id="${esc(o.id)}" type="button"><i data-lucide="eye" class="icon-16"></i> Details</button>
          <button class="chip-btn js-order-invoice" data-id="${esc(o.id)}" type="button"><i data-lucide="receipt-text" class="icon-16"></i> Invoice</button>
          ${['paid', 'processing'].includes(o.status) ? `<button class="chip-btn js-order-cancel" data-id="${esc(o.id)}" type="button"><i data-lucide="x" class="icon-16"></i> Cancel</button>` : ''}
          <button class="chip-btn js-order-reorder" data-id="${esc(o.id)}" type="button"><i data-lucide="rotate-ccw" class="icon-16"></i> Reorder</button>
        </div>
        <span class="total">${money(o.total)}</span>
      </div>
    </article>`;
  }

  function renderOrders() {
    const orders = ordersFor(user.id);
    $('.js-orders').innerHTML = orders.length ? orders.map(orderCard).join('') : emptyBlock('No orders yet.');
    $('.js-order-count').textContent = `${orders.length} order${orders.length === 1 ? '' : 's'}`;
  }

  const ordersRoot = $('.js-orders');
  $('.js-recent-orders').addEventListener('click', (e) => {
    const btn = e.target.closest('.js-order-detail');
    if (!btn) return;
    ordersRoot.dispatchEvent(Object.assign(new window.CustomEvent('open-detail', { bubbles: false }), { detailId: btn.dataset.id }));
  });
  ordersRoot.addEventListener('open-detail', (e) => {
    const o = ordersFor(user.id).find((x) => x.id === e.detailId);
    if (o) openDetail(o);
  });
  function openDetail(o) {
    const tl = orderTimeline(o.status);
    openModal(`
        <div class="dash-modal__head"><h3>${esc(o.id)}</h3><button class="dash-modal__close" type="button"><i data-lucide="x" class="icon-18"></i></button></div>
        <dl class="detail-list">
          <div class="detail-row"><dt>Reference</dt><dd>${esc(o.ref)}</dd></div>
          <div class="detail-row"><dt>Date</dt><dd>${o.date}</dd></div>
          <div class="detail-row"><dt>Status</dt><dd><span class="pill ${o.status}">${o.status}</span></dd></div>
          <div class="detail-row"><dt>Payment</dt><dd>Paystack · ${o.status === 'cancelled' ? 'Refunded' : 'Paid'}</dd></div>
          <div class="detail-row"><dt>Total</dt><dd>${money(o.total)}</dd></div>
          <div class="detail-row"><dt>Ship to</dt><dd>${esc(o.address ? o.address.line1 + ', ' + o.address.city : user.city || '-')}</dd></div>
        </dl>
        <div class="timeline-h" style="margin-top:1.2rem">${tl.map((s, i) => `<div class="tl-step ${s.done ? 'done' : ''} ${i === Math.max(0, tl.findIndex((x) => !x.done)) ? 'doing' : ''}"><span class="tl-dot"></span><span class="tl-label">${s.label}</span></div>`).join('')}</div>`);
    $('.dash-modal__close').addEventListener('click', closeModal);
  }
  ordersRoot.addEventListener('click', (e) => {
    const btn = e.target.closest('[class*="js-order-"]');
    if (!btn) return;
    const id = btn.dataset.id;
    const o = ordersFor(user.id).find((x) => x.id === id);
    if (!o) return;
    if (btn.classList.contains('js-order-detail')) {
      openDetail(o);
    } else if (btn.classList.contains('js-order-invoice')) {
      // Blob URL instead of document.write: no script access between the two windows
      const url = URL.createObjectURL(new Blob([orderInvoiceHTML(o, user)], { type: 'text/html' }));
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } else if (btn.classList.contains('js-order-cancel')) {
      cancelOrder(id);
      renderOrders(); renderOverview(); hydrateIcons();
      toast('Order cancelled. Refund headed back to your card.');
    } else if (btn.classList.contains('js-order-reorder')) {
      reorderOrder(id);
      hydrateCartBadge();
      toast('Items added to your cart.');
    }
  });

  /* ── Wishlist ───────────────────────────────────────────────── */
  function renderWishlist() {
    const list = wishlistProducts(user.id);
    $('.js-wishlist').innerHTML = list.length
      ? list.map((p) => `<article class="wish-card">
          <div class="media"><img src="${p.img}" alt="${esc(p.name)}" loading="lazy" />
          ${p.stock === 0 ? '<span class="pill out">Out of stock</span>' : p.stock <= 6 ? '<span class="pill low">Low stock</span>' : '<span class="pill in">In stock</span>'}</div>
          <div class="body"><h3>${esc(p.name)}</h3><span class="price">${money(p.price)}</span>
            <div class="row">
              <a class="btn btn--primary btn--sm" href="/pages/product.html">View</a>
              <button class="btn btn--secondary btn--sm js-wish-cart" data-id="${p.id}" type="button"><i data-lucide="shopping-bag" class="icon-16"></i> Move to cart</button>
              <button class="btn btn--secondary btn--sm js-wish-remove" data-id="${p.id}" type="button"><i data-lucide="heart" class="icon-16"></i> Unsave</button>
            </div>
          </div>
        </article>`).join('')
      : emptyBlock('Nothing saved yet. Tap the heart on any bike to keep it here.');
  }
  $('.js-wishlist').addEventListener('click', (e) => {
    const rm = e.target.closest('.js-wish-remove');
    const mv = e.target.closest('.js-wish-cart');
    if (rm) { toggleWishlist(user.id, rm.dataset.id); renderWishlist(); renderOverview(); }
    if (mv) { moveWishlistToCart(user.id, mv.dataset.id); renderWishlist(); hydrateCartBadge(); toast('Moved to cart.'); }
  });

  /* ── Wallet & cards ─────────────────────────────────────────── */
  function renderWallet() {
    const wallet = getWallet(user.id);
    $('.js-wallet-balance').textContent = money(wallet.balance);
    $('.js-wallet-txns tbody').innerHTML = wallet.transactions.map((t) => `<tr>
      <td style="white-space:nowrap">${t.date}</td><td>${t.label}</td>
      <td><span class="pill ${t.type === 'credit' ? 'in' : 'debit'}">${t.type}</span></td>
      <td style="text-align:right;font-weight:600;white-space:nowrap">${t.type === 'credit' ? '+' : '−'}${money(t.amount)}</td></tr>`).join('');
    const cards = getCards(user.id);
    $('.js-cards').innerHTML = cards.length ? cards.map((c) => `<div class="card-card">
        ${c.isDefault ? '<span class="default-tag pill in">Default</span>' : ''}
        <b>${c.brand} •••• ${c.last4}</b>
        <span class="muted">Expires ${c.exp}</span>
        <div class="card-actions" style="margin-top:0.5rem">
          ${!c.isDefault ? `<button class="chip-btn js-card-default" data-id="${c.id}" type="button">Make default</button>` : ''}
          <button class="chip-btn js-card-remove" data-id="${c.id}" type="button"><i data-lucide="trash-2" class="icon-14"></i> Remove</button>
        </div>
      </div>`).join('') : `<p class="muted">No saved cards yet.</p>`;
    const ref = getReferral(user.id, user.name);
    $('.js-ref-code').textContent = ref.code;
    $('.js-ref-stats').innerHTML = `${ref.invited} referred · ${money(ref.earned)} earned`;
  }
  $('.js-topup').addEventListener('click', () => {
    openModal(`<div class="dash-modal__head"><h3>Top up wallet</h3><button class="dash-modal__close" type="button"><i data-lucide="x" class="icon-18"></i></button></div>
      <div class="dash-view__grid" style="gap:0.8rem">
        ${[10000, 25000, 50000, 100000].map((a) => `<button class="btn btn--secondary js-topup-amt" data-amt="${a}" type="button">${money(a)}</button>`).join('')}
        <div class="field"><label>Custom amount</label><input class="input js-topup-custom" inputmode="numeric" placeholder="₦ amount" /></div>
        <button class="btn btn--primary js-topup-go" type="button">Add funds</button>
      </div>`);
    $('.dash-modal__close').addEventListener('click', closeModal);
    $$('.js-topup-amt').forEach((b) => b.addEventListener('click', () => { $('.js-topup-custom').value = b.dataset.amt; }));
    $('.js-topup-go').addEventListener('click', () => {
      const amt = Number($('.js-topup-custom').value);
      if (!amt || amt < 100) return toast('Enter a top-up amount.');
      topUpWallet(user.id, amt);
      closeModal(); renderWallet(); renderOverview(); toast('Wallet topped up.');
    });
  });
  $('.js-add-card').addEventListener('click', () => {
    openModal(`<div class="dash-modal__head"><h3>Add payment method</h3><button class="dash-modal__close" type="button"><i data-lucide="x" class="icon-18"></i></button></div>
      <div class="dash-view__grid" style="gap:1rem">
        <div class="field"><label>Card brand</label><select class="select js-card-brand"><option>Visa</option><option>Mastercard</option><option>Verve</option></select></div>
        <div class="field"><label>Last 4 digits</label><input class="input js-card-last4" inputmode="numeric" maxlength="4" placeholder="0000" /></div>
        <div class="field"><label>Expiry</label><input class="input js-card-exp" placeholder="MM/YY" /></div>
        <button class="btn btn--primary js-card-save" type="button">Save card</button>
      </div>`);
    $('.dash-modal__close').addEventListener('click', closeModal);
    $('.js-card-save').addEventListener('click', () => {
      addCard(user.id, { brand: $('.js-card-brand').value, last4: $('.js-card-last4').value || '0000', exp: $('.js-card-exp').value || '01/28' });
      closeModal(); renderWallet(); toast('Card added.');
    });
  });
  $('.js-cards').addEventListener('click', (e) => {
    if (e.target.closest('.js-card-remove')) { removeCard(user.id, e.target.closest('.js-card-remove').dataset.id); renderWallet(); }
    if (e.target.closest('.js-card-default')) { setDefaultCard(user.id, e.target.closest('.js-card-default').dataset.id); renderWallet(); }
  });

  /* ── Addresses ──────────────────────────────────────────────── */
  function renderAddresses() {
    const list = getAddresses(user.id);
    $('.js-addresses').innerHTML = list.length ? list.map((a) => `<div class="addr-card">
        ${a.isDefault ? '<span class="default-tag pill in">Default</span>' : ''}
        <b>${esc(a.label)}</b>
        <span class="muted">${esc(a.line1)}${a.line2 ? ', ' + a.line2 : ''} · ${esc(a.city)}, ${a.state} · ${a.country}</span>
        <span class="muted">${esc(a.name)} · ${esc(a.phone)}</span>
        <div class="card-actions" style="margin-top:0.5rem">
          <button class="chip-btn js-addr-edit" data-id="${a.id}" type="button">Edit</button>
          ${!a.isDefault ? `<button class="chip-btn js-addr-default" data-id="${a.id}" type="button">Make default</button>` : ''}
          <button class="chip-btn js-addr-remove" data-id="${a.id}" type="button">Remove</button>
        </div>
      </div>`).join('') : `<p class="muted">No saved addresses yet.</p>`;
  }
  const addrForm = (a = {}) => `<div class="dash-modal__head"><h3>${a.id ? 'Edit' : 'New'} address</h3><button class="dash-modal__close" type="button"><i data-lucide="x" class="icon-18"></i></button></div>
    <input type="hidden" class="js-addr-id" value="${a.id || ''}" />
    <div class="dash-view__grid" style="gap:1rem">
      <div class="field"><label>Label</label><input class="input js-addr-label" value="${a.label || ''}" placeholder="Home / Office" /></div>
      <div class="field"><label>Full name</label><input class="input js-addr-name" value="${a.name || user.name}" /></div>
      <div class="field"><label>Phone</label><input class="input js-addr-phone" value="${a.phone || user.phone || ''}" /></div>
      <div class="field"><label>Street address</label><input class="input js-addr-line1" value="${a.line1 || ''}" /></div>
      <div class="field"><label>City</label><input class="input js-addr-city" value="${a.city || ''}" /></div>
      <div class="field"><label>State</label><input class="input js-addr-state" value="${a.state || ''}" /></div>
      <div class="field"><label>Country</label><input class="input js-addr-country" value="${a.country || 'Nigeria'}" /></div>
    </div>
    <button class="btn btn--primary js-addr-save" style="margin-top:1rem" type="button">Save address</button>`;
  $('.js-add-addr').addEventListener('click', () => { openModal(addrForm()); bindAddrModal(); });
  $('.js-addresses').addEventListener('click', (e) => {
    const edit = e.target.closest('.js-addr-edit');
    const def = e.target.closest('.js-addr-default');
    const rm = e.target.closest('.js-addr-remove');
    if (edit) { const a = getAddresses(user.id).find((x) => x.id === edit.dataset.id); openModal(addrForm(a)); bindAddrModal(); }
    if (def) { setDefaultAddress(user.id, def.dataset.id); renderAddresses(); }
    if (rm) { removeAddress(user.id, rm.dataset.id); renderAddresses(); toast('Address removed.'); }
  });
  function bindAddrModal() {
    $('.dash-modal__close').addEventListener('click', closeModal);
    $('.js-addr-save').addEventListener('click', () => {
      saveAddress(user.id, {
        id: $('.js-addr-id').value || undefined,
        label: $('.js-addr-label').value || 'Address',
        name: $('.js-addr-name').value,
        phone: $('.js-addr-phone').value,
        line1: $('.js-addr-line1').value,
        line2: '',
        city: $('.js-addr-city').value,
        state: $('.js-addr-state').value,
        country: $('.js-addr-country').value || 'Nigeria',
      });
      closeModal(); renderAddresses(); toast('Address saved.');
    });
  }

  /* ── Garage ─────────────────────────────────────────────────── */
  function renderGarage() {
    const list = getGarage(user.id);
    $('.js-garage').innerHTML = list.length ? list.map((g) => {
      const days = Math.max(0, Math.round((new Date(g.warrantyUntil) - new Date()) / 86400000));
      const pct = Math.min(100, Math.round((days / 730) * 100));
      return `<div class="garage-card">
        <div class="garage-head"><span class="garage-icon"><i data-lucide="zap" class="icon-20"></i></span>
          <div><b>${g.model}</b><small>VIN ${g.serial} · registered ${g.registered}${g.fromOrder ? ' · from ' + g.fromOrder : ''}</small></div></div>
        <div class="warranty-bar">
          <i data-lucide="shield-check" class="icon-18" style="color:var(--color-success)"></i>
          <div class="progress" style="flex:1"><i style="width:${pct}%"></i></div>
          <span class="muted" style="font-size:0.8rem;white-space:nowrap">Warranty · ${days} days left</span>
        </div>
        <div class="card-actions">
          <a class="chip-btn" href="#support" data-goto="support"><i data-lucide="wrench" class="icon-16"></i> Book service</a>
          <a class="chip-btn" href="/pages/faq.html"><i data-lucide="life-buoy" class="icon-16"></i> Manual &amp; guide</a>
        </div>
      </div>`;
    }).join('') : emptyBlock('No bikes registered yet. Register yours for warranty + service history.');
  }
  $('.js-register-bike').addEventListener('click', () => {
    openModal(`<div class="dash-modal__head"><h3>Register a bike</h3><button class="dash-modal__close" type="button"><i data-lucide="x" class="icon-18"></i></button></div>
      <div class="dash-view__grid" style="gap:1rem">
        <div class="field"><label>Model</label><select class="select js-reg-model"><option>SOKO 01 · Commuter</option><option>SOKO 02 · Cargo</option><option>SOKO 03 · Trail</option><option>SOKO Pro · Performance</option></select></div>
        <div class="field"><label>Serial / VIN</label><input class="input js-reg-serial" placeholder="SM1-0000-00000" /></div>
        <button class="btn btn--primary js-reg-save" type="button">Register</button>
      </div>`);
    $('.dash-modal__close').addEventListener('click', closeModal);
    $('.js-reg-save').addEventListener('click', () => {
      registerBike(user.id, { model: $('.js-reg-model').value, serial: $('.js-reg-serial').value });
      closeModal(); renderGarage(); hydrateCartBadge(); toast('Bike registered. Warranty activated.');
    });
  });

  /* ── Support tickets ────────────────────────────────────────── */
  function renderTickets() {
    const list = getTickets(user.id);
    $('.js-tickets').innerHTML = list.length ? list.map((t) => `<div class="ticket">
        <div class="ticket__head"><b>${esc(t.subject)}</b><span class="pill ${t.status === 'open' ? 'processing' : 'delivered'}">${t.status}</span></div>
        <span class="muted" style="font-size:0.78rem">${t.type} · ${t.date}</span>
        <p>${esc(t.detail)}</p>
      </div>`).join('') : `<p class="muted">No tickets yet. We're here if you need us.</p>`;
  }
  $('.js-tk-submit').addEventListener('click', () => {
    const subject = $('.js-tk-subject').value.trim();
    if (!subject) return toast('Give your ticket a subject.');
    addTicket(user.id, { type: $('.js-tk-type').value, subject, detail: $('.js-tk-detail').value.trim() });
    $('.js-tk-subject').value = ''; $('.js-tk-detail').value = '';
    renderTickets(); toast('Ticket submitted. We reply within 24h.');
  });

  /* ── Notifications ──────────────────────────────────────────── */
  function renderNotifs() {
    const list = getNotifs(user.id);
    $('.js-notifs').innerHTML = list.length ? list.map((n) => `<div class="notif ${n.unread ? 'unread' : ''}" data-id="${n.id}">
        <span class="notif__dot"></span>
        <div style="flex:1"><b>${esc(n.title)}</b><p>${esc(n.body)}</p></div>
        <time>${n.time}</time>
        ${n.unread ? `<button class="chip-btn js-notif-read" data-id="${n.id}" type="button" style="align-self:center">Read</button>` : ''}
        <button class="chip-btn js-notif-del" data-id="${n.id}" type="button" style="align-self:center"><i data-lucide="x" class="icon-14"></i></button>
      </div>`).join('') : `<p class="muted">You're all caught up.</p>`;
  }
  $('.js-notifs').addEventListener('click', (e) => {
    if (e.target.closest('.js-notif-read')) { markNotifRead(user.id, e.target.closest('.js-notif-read').dataset.id); renderNotifs(); }
    if (e.target.closest('.js-notif-del')) { deleteNotif(user.id, e.target.closest('.js-notif-del').dataset.id); renderNotifs(); }
  });
  $('.js-mark-read').addEventListener('click', () => { markAllRead(user.id); renderNotifs(); toast('All notifications marked read.'); });

  /* ── Settings ───────────────────────────────────────────────── */
  function renderSettings() {
    $('.js-set-name').value = user.name;
    $('.js-set-email').value = user.email;
    $('.js-set-phone').value = user.phone || '';
    $('.js-set-city').value = user.city || '';
    const prefs = getPrefs(user.id);
    $('.js-pref-order').checked = !!prefs.orderUpdates;
    $('.js-pref-promo').checked = !!prefs.promos;
    $('.js-pref-sms').checked = !!prefs.sms;
  }
  $('.js-save-profile').addEventListener('click', () => {
    updateProfile({ name: $('.js-set-name').value, phone: $('.js-set-phone').value, city: $('.js-set-city').value });
    $('.js-user-name').textContent = currentUser().name;
    toast('Profile saved.');
  });
  $('.js-pw-change').addEventListener('click', () => {
    const res = changePassword($('.js-pw-cur').value, $('.js-pw-new').value);
    toast(res.error || 'Password updated.');
    if (!res.error) { $('.js-pw-cur').value = ''; $('.js-pw-new').value = ''; }
  });
  const savePrefs = () => setPrefs(user.id, { orderUpdates: $('.js-pref-order').checked, promos: $('.js-pref-promo').checked, sms: $('.js-pref-sms').checked });
  $('.js-pref-order').addEventListener('change', () => { savePrefs(); toast('Preferences saved.'); });
  $('.js-pref-promo').addEventListener('change', savePrefs);
  $('.js-pref-sms').addEventListener('change', savePrefs);
  $('.js-delete-account').addEventListener('click', () => {
    openModal(`<div class="dash-modal__head"><h3>Delete account?</h3><button class="dash-modal__close" type="button"><i data-lucide="x" class="icon-18"></i></button></div>
      <p class="muted">This removes your profile, orders, garage and wallet from this browser. You can keep shopping as a guest afterwards. This can't be undone.</p>
      <div class="card-actions" style="margin-top:1.2rem">
        <button class="btn btn--secondary js-del-confirm" type="button" style="color:var(--color-accent);border-color:var(--color-accent-dim)">Delete account</button>
      </div>`);
    $('.dash-modal__close').addEventListener('click', closeModal);
    $('.js-del-confirm').addEventListener('click', () => { deleteAccount(); window.location.href = '/'; });
  });

  /* ── sign out + routing ─────────────────────────────────────── */
  $$('[data-logout], .js-logout').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); logout(); window.location.href = '/'; }));

  document.addEventListener('click', (e) => {
    const got = e.target.closest('[data-goto]');
    if (got) { e.preventDefault(); const v = got.dataset.goto; history.replaceState(null, '', '#' + v); showView(v); }
  });
  $$('.dash-nav [data-view]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault(); const v = a.dataset.view; history.replaceState(null, '', '#' + v); showView(v);
  }));

  const clock = $('.js-dash-clock');
  const tick = () => { if (clock) clock.textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' }); };
  tick(); setInterval(tick, 30000);

  const VIEWS = ['overview', 'orders', 'wishlist', 'wallet', 'addresses', 'garage', 'support', 'notifications', 'settings'];
  const initial = (location.hash || '#overview').slice(1);
  showView(VIEWS.includes(initial) ? initial : 'overview');

  renderAll();
}

function emptyBlock(msg) {
  return `<div class="empty-state" style="padding:2rem 1rem"><p>${msg}</p></div>`;
}

hydrateCartBadge();
