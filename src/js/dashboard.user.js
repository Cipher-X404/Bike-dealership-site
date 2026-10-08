/* ============================================================================
   SOKO MOTO · RIDER DESK (Member Dashboard · iOS Spatial Edition)
   Orders, 5-leg crossing roadbook, live Guangzhou bench verifications,
   saved rides, Apple Wallet pass, Split-in-3 calculator, garage & support.
   ============================================================================ */
import { hydrateIcons } from '/src/js/icons.js';
import {
  ensureSeeded, currentUser, logout, updateProfile, changePassword, deleteAccount,
  getOrders, cancelOrder, getWishlistProducts, toggleWishlist,
  getWallet, topUpWallet, getCards, addCard, removeCard, setDefaultCard,
  getAddresses, saveAddress, removeAddress, setDefaultAddress,
  getGarage, registerBike, removeBike, getTickets, addTicket,
  getNotifs, markAllRead, markNotifRead, deleteNotif,
  getPrefs, setPrefs, getReferral, PRODUCTS, formatNGN,
  getVerifications, bookVerification, cancelVerification, getAdminSettings,
} from '/src/js/account.js';
import { addToCart, cartCount, loadCart, setQty, removeItem, cartTotal } from '/src/js/cartstore.js';
import { CATALOG } from '/src/js/catalog.js';
const getProduct = (id) => CATALOG.find((p) => p.id === id) || PRODUCTS.find((p) => p.id === id);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const VIEW_LABELS = {
  overview: 'Overview',
  orders: 'Orders',
  wishlist: 'Saved rides',
  wallet: 'Wallet & cards',
  garage: 'Garage',
  addresses: 'Addresses',
  support: 'Support',
  notifications: 'Notifications',
  settings: 'Settings',
};

const ROUTE_STEPS = [
  { key: 'bench', label: 'Bench checked', sub: 'Guangzhou workshop' },
  { key: 'packed', label: 'Packed for export', sub: 'Sealed & documented' },
  { key: 'sea', label: 'On the water', sub: 'South China Sea to Atlantic' },
  { key: 'port', label: 'Port cleared', sub: 'Apapa, Lagos' },
  { key: 'door', label: 'At your door', sub: 'Handed over ready to ride' },
];

const STATUS_STAGE = { paid: 1, processing: 2, shipped: 3, delivered: 5, cancelled: 0 };

const STATUS_COPY = {
  paid: 'Order confirmed · Queued for bench check',
  processing: 'On the Guangzhou bench · 40-point check',
  shipped: 'In transit · Guangzhou to Nigeria',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

/* ── Apple HIG Physics Helpers (Rubber-band & Momentum Projection) ── */
function rubberband(distance, dimension, constant = 0.55) {
  if (dimension <= 0) return 0;
  return (distance * dimension * constant) / (dimension + constant * Math.abs(distance));
}

function project(velocity, decelerationRate = 0.998) {
  return (velocity / 1000) * decelerationRate / (1 - decelerationRate);
}

let toastTimer = null;
function toast(msg) {
  const el = $('.js-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('is-shown');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-shown'), 2800);
}

function startClock() {
  const nodes = $$('.js-dash-clock');
  if (!nodes.length) return;
  const tick = () => {
    try {
      const text = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Africa/Lagos',
      }).format(new Date());
      nodes.forEach((n) => { n.textContent = text; });
    } catch {
      const d = new Date();
      const fallback = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      nodes.forEach((n) => { n.textContent = fallback; });
    }
  };
  tick();
  setInterval(tick, 30000);
}

function syncCartBadge() {
  const count = cartCount();
  $$('.js-cart-count').forEach((badge) => {
    badge.textContent = String(count);
    badge.hidden = count <= 0;
  });
  const bagMeta = $('.js-island-bag-meta');
  if (bagMeta) {
    bagMeta.textContent = count > 0 ? `${count} item${count === 1 ? '' : 's'} · ${formatNGN(cartTotal())}` : 'View cart & Split-in-3';
  }
}

function syncUnreadBadge(userId) {
  const unread = getNotifs(userId).filter((n) => n.unread).length;
  $$('.js-unread-count').forEach((el) => {
    el.textContent = String(unread);
    el.hidden = unread <= 0;
  });
}

function productForOrderItem(item = {}) {
  const needle = String(item.name || '').toLowerCase();
  return CATALOG.find((p) => p.id === item.id || needle.includes(p.name.toLowerCase().replace('soko ', '')))
    || PRODUCTS.find((p) => p.id === item.id || needle.includes(p.name.toLowerCase().replace('soko ', '')))
    || PRODUCTS[0];
}

function warrantyProgress(bike) {
  const start = Date.parse(bike.registered || '2026-01-01');
  const end = Date.parse(bike.warrantyUntil || '2028-01-01');
  const now = Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return { pct: 82, daysLeft: 520 };
  const remaining = Math.max(0, end - now);
  const total = end - start;
  const pct = Math.max(8, Math.min(100, Math.round((remaining / total) * 100)));
  const daysLeft = Math.max(0, Math.round(remaining / 86400000));
  return { pct, daysLeft };
}

/* ── iOS Dock Sliding Pill Indicator ────────────────────────────── */
function syncDockPill() {
  const nav = $('.dash-nav');
  const pill = $('.js-dock-pill', nav || document);
  const active = $('.dash-nav [data-view].is-active');
  if (!nav || !pill || !active) return;
  const navRect = nav.getBoundingClientRect();
  const actRect = active.getBoundingClientRect();
  if (navRect.width <= 0 || actRect.width <= 0) return;
  const x = actRect.left - navRect.left + nav.scrollLeft;
  const y = actRect.top - navRect.top + nav.scrollTop;
  pill.style.width = `${actRect.width}px`;
  pill.style.height = `${actRect.height}px`;
  pill.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  pill.classList.add('is-ready');
}

/* ── iOS Theme Appearance (Light / Dark) ───────────────────────── */
function initTheme() {
  const root = $('.dash');
  if (!root) return;
  const saved = localStorage.getItem('soko-rider-theme');
  if (saved === 'dark' || saved === 'light') {
    root.dataset.iosTheme = saved;
  }
  const updateIcons = () => {
    const isDark = root.dataset.iosTheme === 'dark';
    $$('.js-theme-toggle').forEach((btn) => {
      btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
      btn.innerHTML = `<i data-lucide="${isDark ? 'sun' : 'moon'}" class="icon-14"></i>`;
      hydrateIcons(btn);
    });
  };
  updateIcons();
  $$('.js-theme-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = root.dataset.iosTheme === 'dark' ? 'light' : 'dark';
      root.dataset.iosTheme = next;
      localStorage.setItem('soko-rider-theme', next);
      updateIcons();
      toast(`Appearance set to iOS ${next} mode.`);
    });
  });
}

/* ── iOS Dynamic Island ────────────────────────────────────────── */
function renderDynamicIsland(user) {
  const orders = getOrders(user.id);
  const verifications = getVerifications(user.id).filter((v) => v.status === 'booked');
  const activeOrder = orders.find((o) => o.status === 'shipped' || o.status === 'processing' || o.status === 'paid') || orders[0];
  const summaryEl = $('.js-island-summary');
  const activityEl = $('.js-island-activity');

  if (summaryEl) {
    if (activeOrder && activeOrder.status !== 'delivered' && activeOrder.status !== 'cancelled') {
      summaryEl.textContent = `${activeOrder.id} · ${STATUS_COPY[activeOrder.status]?.split('·')[0]?.trim() || 'In transit'}`;
    } else if (verifications.length) {
      summaryEl.textContent = `${verifications[0].ref} · Bench check ${verifications[0].slot} WAT`;
    } else {
      summaryEl.textContent = 'Guangzhou · Lagos Corridor';
    }
  }

  if (activityEl) {
    if (activeOrder) {
      const stage = STATUS_STAGE[activeOrder.status] ?? 2;
      const pct = Math.min(100, Math.max(15, Math.round((stage / 5) * 100)));
      activityEl.innerHTML = `
        <div class="ios-live-card">
          <div class="ios-live-card__row">
            <span class="ios-live-card__badge"><i data-lucide="ship" class="icon-14"></i> ${esc(activeOrder.id)}</span>
            <span class="ios-live-card__eta">${esc(activeOrder.eta || 'Scheduled')}</span>
          </div>
          <div class="ios-live-card__title">${esc(activeOrder.items?.[0]?.name || 'SOKO Moto order')}</div>
          <div class="ios-live-card__bar" aria-hidden="true"><span style="width:${pct}%"></span></div>
          <div class="ios-live-card__stops">
            <span>Guangzhou Bench</span>
            <span>Apapa Port</span>
            <span>${esc(user.city || 'Lagos')} Doorstep</span>
          </div>
        </div>
      `;
      hydrateIcons(activityEl);
    } else {
      activityEl.innerHTML = `
        <div class="ios-live-card">
          <div class="ios-live-card__title">No active crossing in transit</div>
          <p class="ios-live-card__sub">Every bike is 40-point inspected in Guangzhou before crating for Nigeria.</p>
        </div>
      `;
    }
  }
}

function initDynamicIsland() {
  const island = $('.js-dynamic-island');
  const toggleBtn = $('.js-island-toggle');
  const drawer = $('.js-island-drawer');
  if (!island || !toggleBtn || !drawer) return;

  const setExpanded = (open) => {
    island.dataset.expanded = open ? 'true' : 'false';
    toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    drawer.hidden = !open;
  };

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = island.dataset.expanded === 'true';
    setExpanded(!isOpen);
  });

  document.addEventListener('click', (e) => {
    if (island.dataset.expanded === 'true' && !island.contains(e.target)) {
      setExpanded(false);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && island.dataset.expanded === 'true') {
      setExpanded(false);
    }
  });
}

/* ── iOS Draggable Sheet Modal System ──────────────────────────── */
let activeModalCleanup = null;
function closeActiveModal() {
  if (activeModalCleanup) activeModalCleanup();
}

function attachSheetDrag(modal, card) {
  const handle = $('.ios-sheet__grabber-area', card);
  if (!handle) return;
  let startY = 0;
  let currentY = 0;
  let lastY = 0;
  let lastT = 0;
  let velocity = 0;
  let dragging = false;

  handle.addEventListener('pointerdown', (e) => {
    if (e.button && e.button !== 0) return;
    dragging = true;
    startY = e.clientY;
    lastY = e.clientY;
    lastT = performance.now();
    velocity = 0;
    card.style.transition = 'none';
    try { handle.setPointerCapture(e.pointerId); } catch {}
  });

  handle.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const now = performance.now();
    const dt = now - lastT;
    const dy = e.clientY - startY;
    if (dt > 0) velocity = ((e.clientY - lastY) / dt) * 1000;
    lastY = e.clientY;
    lastT = now;
    currentY = dy < 0 ? -rubberband(-dy, 180) : dy;
    card.style.transform = `translate3d(0, ${currentY}px, 0)`;
  });

  const finishDrag = () => {
    if (!dragging) return;
    dragging = false;
    card.style.transition = 'transform 360ms cubic-bezier(0.32, 0.72, 0, 1), opacity 240ms ease';
    const projected = currentY + project(velocity, 0.996);
    if (projected > 130 || velocity > 950) {
      card.style.transform = 'translate3d(0, 100%, 0)';
      card.style.opacity = '0';
      setTimeout(() => closeActiveModal(), 180);
    } else {
      card.style.transform = '';
    }
  };

  handle.addEventListener('pointerup', finishDrag);
  handle.addEventListener('pointercancel', finishDrag);
}

function openModal(html, { wide = false } = {}) {
  closeActiveModal();
  const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const m = document.createElement('div');
  m.className = 'dash-modal';
  m.setAttribute('role', 'dialog');
  m.setAttribute('aria-modal', 'true');
  m.innerHTML = `
    <div class="dash-modal__card${wide ? ' dash-modal__card--wide' : ''}">
      <div class="ios-sheet__grabber-area" aria-hidden="true"><span class="ios-sheet__grabber"></span></div>
      <button class="dash-modal__close" type="button" aria-label="Close dialog">&times;</button>
      ${html}
    </div>
  `;
  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeActiveModal();
    }
  };
  activeModalCleanup = () => {
    document.removeEventListener('keydown', onKey);
    m.remove();
    activeModalCleanup = null;
    if (trigger && document.contains(trigger)) trigger.focus();
  };
  m.addEventListener('click', (e) => {
    if (e.target === m || e.target.closest('.dash-modal__close')) closeActiveModal();
  });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(m);
  hydrateIcons(m);
  const card = $('.dash-modal__card', m);
  if (card) attachSheetDrag(m, card);
  const heading = $('h3, h2', m);
  if (heading && !heading.id) heading.id = 'dash-modal-title';
  if (heading) m.setAttribute('aria-labelledby', heading.id);
  const focusTarget = $('input, select, textarea, .btn--primary, .dash-modal__close', m);
  focusTarget?.focus();
  return m;
}

/* ── Navigation & View Switching ───────────────────────────────── */
function activateView(name, { focusHeading = false } = {}) {
  const valid = Object.prototype.hasOwnProperty.call(VIEW_LABELS, name) ? name : 'overview';
  $$('[data-view-panel]').forEach((p) => {
    const isTarget = p.dataset.viewPanel === valid;
    p.hidden = !isTarget;
    if (isTarget) {
      p.classList.remove('is-entering');
      void p.offsetWidth;
      p.classList.add('is-entering');
    }
  });
  $$('.dash-nav [data-view]').forEach((a) => {
    const active = a.dataset.view === valid;
    a.classList.toggle('is-active', active);
    if (active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  const label = VIEW_LABELS[valid] || 'Overview';
  const title = $('.js-view-title');
  const path = $('.js-view-path');
  if (title) title.textContent = label;
  if (path) path.textContent = label.toUpperCase();
  if (focusHeading && title) title.focus({ preventScroll: true });
  requestAnimationFrame(syncDockPill);
}

/* ── Main Initialization ───────────────────────────────────────── */
function init() {
  ensureSeeded();
  const user = currentUser();
  const guard = $('.js-guest-guard');
  const app = $('.js-app');

  if (!user) {
    if (guard) guard.hidden = false;
    if (app) app.hidden = true;
    hydrateIcons();
    return;
  }
  if (guard) guard.hidden = true;
  if (app) app.hidden = false;

  $$('.js-user-name').forEach((n) => { n.textContent = user.name; });
  $$('.js-user-email').forEach((n) => { n.textContent = user.email; });
  $$('.js-user-initial').forEach((n) => { n.textContent = (user.name || 'S')[0].toUpperCase(); });

  initTheme();
  initDynamicIsland();

  $$('.dash-nav [data-view]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const target = a.dataset.view;
      history.replaceState(null, '', '#' + target);
      activateView(target, { focusHeading: true });
    });
  });

  document.addEventListener('click', (e) => {
    const goto = e.target.closest('[data-goto]');
    if (!goto) return;
    e.preventDefault();
    const target = goto.dataset.goto;
    history.replaceState(null, '', '#' + target);
    activateView(target, { focusHeading: true });
    const island = $('.js-dynamic-island');
    if (island && island.dataset.expanded === 'true') {
      island.dataset.expanded = 'false';
      const drawer = $('.js-island-drawer');
      if (drawer) drawer.hidden = true;
    }
  });

  window.addEventListener('resize', () => requestAnimationFrame(syncDockPill));

  const initial = (location.hash || '#overview').slice(1);
  activateView(initial);

  $$('[data-logout], .js-logout').forEach((b) => b.addEventListener('click', () => {
    logout();
    location.href = '/';
  }));

  /* Global quick triggers: Book Verification, Open Bag, Spotlight Search */
  document.addEventListener('click', (e) => {
    if (e.target.closest('.js-book-verification')) {
      e.preventDefault();
      openVerificationModal(user);
    } else if (e.target.closest('.js-open-bag')) {
      e.preventDefault();
      openBagModal(user);
    } else if (e.target.closest('.js-open-spotlight')) {
      e.preventDefault();
      openSpotlightModal(user);
    } else if (e.target.closest('.js-browse-lineup')) {
      e.preventDefault();
      openLineupModal(user);
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openSpotlightModal(user);
    }
  });

  startClock();
  syncCartBadge();
  renderAll(user);
}

let userOrderSegment = 'all';
let userOrderQuery = '';
let selectedPlanMonths = 3;
let selectedSimBikeId = '0001-commuter';

function renderAll(user) {
  renderDynamicIsland(user);
  renderOverview(user);
  renderOrders(user);
  renderWishlist(user);
  renderWallet(user);
  renderAddresses(user);
  renderGarage(user);
  renderSupport(user);
  renderNotifications(user);
  renderSettings(user);
  syncUnreadBadge(user.id);
  syncCartBadge();
  hydrateIcons();
  requestAnimationFrame(syncDockPill);
}

/* ── Overview ──────────────────────────────────────────────────── */
function renderOverview(user) {
  const orders = getOrders(user.id);
  const wish = getWishlistProducts(user.id);
  const wallet = getWallet(user.id);
  const garage = getGarage(user.id);
  const notifs = getNotifs(user.id);

  const firstName = (user.name || 'Rider').split(' ')[0];
  const activeOrders = orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled');
  const welcomeHeading = $('.js-welcome-heading');
  const welcomeBody = $('.js-welcome-body');
  if (welcomeHeading) welcomeHeading.textContent = `Welcome back, ${firstName}.`;
  if (welcomeBody) {
    welcomeBody.textContent = activeOrders.length
      ? `You have ${activeOrders.length} active order${activeOrders.length === 1 ? '' : 's'} moving between the Guangzhou workshop and ${user.city || 'Nigeria'}, plus ${formatNGN(wallet.balance)} in wallet credit.`
      : `Your garage has ${garage.length} registered bike${garage.length === 1 ? '' : 's'} and ${formatNGN(wallet.balance)} in wallet credit ready for your next ride.`;
  }

  const kpis = $('.js-kpis');
  if (kpis) {
    kpis.innerHTML = `
      <div class="kpi">
        <div class="kpi__top"><span class="kpi__label">Orders</span><span class="kpi__icon kpi__icon--orange"><i data-lucide="package-check" class="icon-16"></i></span></div>
        <div class="kpi__val">${orders.length}</div>
        <div class="kpi__delta">${activeOrders.length ? `${activeOrders.length} in transit` : 'All delivered'}</div>
      </div>
      <div class="kpi">
        <div class="kpi__top"><span class="kpi__label">Saved rides</span><span class="kpi__icon kpi__icon--pink"><i data-lucide="heart" class="icon-16"></i></span></div>
        <div class="kpi__val">${wish.length}</div>
        <div class="kpi__delta">${wish.length ? 'Ready to add to cart' : 'Save bikes from the shop'}</div>
      </div>
      <div class="kpi">
        <div class="kpi__top"><span class="kpi__label">Wallet credit</span><span class="kpi__icon kpi__icon--green"><i data-lucide="wallet" class="icon-16"></i></span></div>
        <div class="kpi__val">${formatNGN(wallet.balance)}</div>
        <div class="kpi__delta">Referral &amp; top-up credit</div>
      </div>
      <div class="kpi">
        <div class="kpi__top"><span class="kpi__label">Bikes in your garage</span><span class="kpi__icon kpi__icon--blue"><i data-lucide="bike" class="icon-16"></i></span></div>
        <div class="kpi__val">${garage.length}</div>
        <div class="kpi__delta">${garage[0] ? `Covered until ${esc(garage[0].warrantyUntil)}` : 'Register your VIN'}</div>
      </div>
    `;
  }

  const recent = $('.js-recent-orders');
  if (recent) {
    const active = orders.find((o) => o.status === 'shipped' || o.status === 'processing' || o.status === 'paid') || orders[0];
    if (!active) {
      recent.innerHTML = `<div class="dash-empty">You haven’t placed an order yet. <a href="/pages/shop.html">Explore the lineup</a> to start your first build.</div>`;
    } else {
      const stage = STATUS_STAGE[active.status] ?? 2;
      const item = active.items?.[0] || { name: 'SOKO Moto order', qty: 1 };
      const prod = productForOrderItem(item);
      const extraCount = Math.max(0, (active.items?.length || 1) - 1);
      recent.innerHTML = `
        <article class="manifest-card" data-manifest="${esc(active.id)}">
          <div class="manifest-card__top">
            <div>
              <span class="manifest-card__code">ORDER ${esc(active.id)} · PLACED ${esc(active.date)}</span>
              <h3>${esc(item.name)}${extraCount ? ` <span>+${extraCount} more</span>` : ''}</h3>
              <p class="manifest-card__sub">${esc(STATUS_COPY[active.status] || active.status)} · ${formatNGN(active.total)}</p>
            </div>
            <span class="status status--${esc(active.status)}">${esc(active.status)}</span>
          </div>
          <div class="manifest-card__body">
            <div class="manifest-card__visual">
              <img src="${esc(prod.img)}" alt="${esc(prod.name)}" loading="lazy" width="640" height="420" />
              <span>${esc(prod.cat)} · ${esc(prod.spec)}</span>
            </div>
            <div class="manifest-route" role="list" aria-label="Order journey from Guangzhou to your door">
              ${ROUTE_STEPS.map((s, i) => {
                const idx = i + 1;
                const state = active.status === 'cancelled'
                  ? 'idle'
                  : idx < stage ? 'done' : idx === stage ? (active.status === 'delivered' ? 'done' : 'doing') : 'idle';
                return `
                  <div class="mr-node ${state}" role="listitem">
                    <span class="mr-node__dot" aria-hidden="true">${state === 'done' ? '✓' : idx}</span>
                    <div class="mr-node__copy">
                      <b>${esc(s.label)}</b>
                      <small>${esc(s.sub)}</small>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
          <div class="manifest-card__foot">
            <div class="manifest-card__eta">
              <span>Estimated arrival</span>
              <strong>${esc(active.eta || 'Scheduled')}</strong>
            </div>
            <div class="manifest-card__actions">
              <button class="btn btn--quiet btn--sm js-order-detail" data-id="${esc(active.id)}" type="button">Order details</button>
              <button class="btn btn--quiet btn--sm js-order-invoice" data-id="${esc(active.id)}" type="button"><i data-lucide="download" class="icon-14"></i> Invoice</button>
              <a class="btn btn--primary btn--sm" href="#orders" data-goto="orders">All orders <i data-lucide="arrow-right" class="icon-14"></i></a>
            </div>
          </div>
        </article>
      `;
      recent.querySelectorAll('.js-order-detail').forEach((b) => b.addEventListener('click', () => showOrderModal(user, b.dataset.id)));
      recent.querySelectorAll('.js-order-invoice').forEach((b) => b.addEventListener('click', () => downloadInvoice(user, b.dataset.id)));
    }
  }

  /* Overview Live Bench Verification Widget */
  const verifyBox = $('.js-overview-verify');
  if (verifyBox) {
    const verifications = getVerifications(user.id);
    if (!verifications.length) {
      verifyBox.innerHTML = `
        <div class="ios-verify-empty">
          <div>
            <b>Watch your bike pass the 40-point Guangzhou bench check</b>
            <p>Book a live 20-minute video session before your crate is sealed. We send the link on WhatsApp 10 minutes before your slot.</p>
          </div>
          <button type="button" class="btn btn--primary btn--sm js-book-verification"><i data-lucide="video" class="icon-14"></i> Schedule video check</button>
        </div>
      `;
    } else {
      verifyBox.innerHTML = `
        <div class="ios-verify-stack">
          ${verifications.slice(0, 2).map((v) => `
            <div class="ios-verify-row">
              <span class="ios-verify-row__icon"><i data-lucide="video" class="icon-18"></i></span>
              <div class="ios-verify-row__copy">
                <div class="ios-verify-row__top">
                  <b>${esc(v.model)}</b>
                  <span class="status status--${v.status === 'booked' ? 'shipped' : v.status === 'completed' ? 'delivered' : 'cancelled'}">${esc(v.status)}</span>
                </div>
                <small>Ref ${esc(v.ref)} · ${esc(v.date)} at ${esc(v.slot)} WAT · WhatsApp (${esc(v.phone || user.phone || 'linked')})</small>
              </div>
              ${v.status === 'booked' ? `<button type="button" class="btn btn--quiet btn--sm js-cancel-verify" data-ref="${esc(v.ref)}">Cancel</button>` : ''}
            </div>
          `).join('')}
        </div>
      `;
      verifyBox.querySelectorAll('.js-cancel-verify').forEach((b) => b.addEventListener('click', () => {
        cancelVerification(b.dataset.ref);
        renderAll(user);
        toast(`Bench verification ${b.dataset.ref} cancelled.`);
      }));
    }
  }

  const overviewNotifs = $('.js-overview-notifs');
  if (overviewNotifs) {
    const topNotifs = notifs.slice(0, 3);
    overviewNotifs.innerHTML = topNotifs.length
      ? topNotifs.map((n) => `
        <div class="notif ${n.unread ? 'is-unread' : ''}">
          <span class="notif__dot" aria-hidden="true"></span>
          <div class="notif__body">
            <div class="notif__title">${esc(n.title)}</div>
            <div class="notif__copy">${esc(n.body)}</div>
          </div>
          <div class="notif__time">${esc(n.time)}</div>
        </div>
      `).join('')
      : `<div class="dash-empty">You’re all caught up.</div>`;
  }

  const overviewGarage = $('.js-overview-garage');
  if (overviewGarage) {
    const bike = garage[0];
    if (!bike) {
      overviewGarage.innerHTML = `
        <p class="garage-peek__empty">Register your SOKO VIN to track warranty coverage and service reminders.</p>
        <a class="btn btn--light btn--sm" href="#garage" data-goto="garage"><i data-lucide="plus" class="icon-14"></i> Register a bike</a>
      `;
    } else {
      const { pct, daysLeft } = warrantyProgress(bike);
      overviewGarage.innerHTML = `
        <div class="garage-peek__bike">
          <div class="garage-peek__model">${esc(bike.model)}</div>
          <div class="garage-peek__vin">VIN · ${esc(bike.serial)}</div>
          <div class="garage-peek__meter" aria-label="Warranty remaining">
            <span style="width:${pct}%"></span>
          </div>
          <div class="garage-peek__dates">
            <span>90-day guarantee + Factory cover</span>
            <b>${daysLeft} days left · until ${esc(bike.warrantyUntil)}</b>
          </div>
        </div>
      `;
    }
  }

  /* Overview Active Bag & Paystack Split-in-3 Preview */
  renderOverviewBag();

  const quick = $('.js-quick-actions');
  if (quick) {
    quick.innerHTML = `
      <div class="quick-grid">
        <a class="quick-tile" href="#orders" data-goto="orders">
          <i data-lucide="truck" class="icon-18"></i>
          <span><b>Track an order</b><small>Follow every stage from Guangzhou</small></span>
          <i data-lucide="arrow-up-right" class="icon-16 quick-tile__go"></i>
        </a>
        <button class="quick-tile js-book-verification" type="button">
          <i data-lucide="video" class="icon-18"></i>
          <span><b>Bench video check</b><small>Watch your 40-point inspection live</small></span>
          <i data-lucide="arrow-up-right" class="icon-16 quick-tile__go"></i>
        </button>
        <a class="quick-tile" href="#support" data-goto="support">
          <i data-lucide="wrench" class="icon-18"></i>
          <span><b>Book a service</b><small>Schedule maintenance with the crew</small></span>
          <i data-lucide="arrow-up-right" class="icon-16 quick-tile__go"></i>
        </a>
        <a class="quick-tile" href="/pages/shop.html">
          <i data-lucide="shopping-bag" class="icon-18"></i>
          <span><b>Browse bikes &amp; kit</b><small>Commuters, cargo, trail and spares</small></span>
          <i data-lucide="arrow-up-right" class="icon-16 quick-tile__go"></i>
        </a>
      </div>
    `;
  }
}

function renderOverviewBag() {
  const bagEl = $('.js-overview-bag');
  if (!bagEl) return;
  const items = loadCart();
  const total = cartTotal();
  const split3 = Math.round(total / 3);
  if (!items.length) {
    bagEl.innerHTML = `
      <div class="ios-bag-empty">
        <p>Your bag is currently empty. Add a bike or spare battery to preview Paystack Split-in-3 (0% over 3 months).</p>
        <div class="ios-bag-empty__actions">
          <button type="button" class="btn btn--quiet btn--sm js-quick-add-battery"><i data-lucide="battery-charging" class="icon-14"></i> + Swap Battery</button>
          <a class="btn btn--primary btn--sm" href="/pages/shop.html">Shop lineup</a>
        </div>
      </div>
    `;
    bagEl.querySelector('.js-quick-add-battery')?.addEventListener('click', () => {
      const bat = getProduct('acc-battery') || PRODUCTS.find((p) => p.id === 'acc-battery');
      if (bat) {
        addToCart({ id: bat.id, name: bat.name, price: bat.price, img: bat.img, variant: '60V 30Ah' }, 1);
        syncCartBadge();
        renderOverviewBag();
        hydrateIcons(bagEl);
        toast(`${bat.name} added to your bag.`);
      }
    });
    return;
  }
  bagEl.innerHTML = `
    <div class="ios-bag-mini">
      <div class="ios-bag-mini__items">
        ${items.slice(0, 2).map((it) => `
          <div class="ios-bag-mini__row">
            <span><b>${esc(it.name)}</b> <small>× ${it.qty || 1}</small></span>
            <b>${formatNGN((it.price || 0) * (it.qty || 1))}</b>
          </div>
        `).join('')}
        ${items.length > 2 ? `<small class="ios-bag-mini__more">+${items.length - 2} more item(s) in bag</small>` : ''}
      </div>
      <div class="ios-bag-mini__split">
        <div><span>Bag subtotal</span><strong>${formatNGN(total)}</strong></div>
        <div><span>Paystack Split-in-3 (0%)</span><strong>${formatNGN(split3)} / mo</strong></div>
      </div>
      <div class="ios-bag-mini__actions">
        <button type="button" class="btn btn--quiet btn--sm js-open-bag">Manage bag</button>
        <a class="btn btn--primary btn--sm" href="/pages/checkout.html">Checkout <i data-lucide="arrow-right" class="icon-14"></i></a>
      </div>
    </div>
  `;
}

/* ── Orders ────────────────────────────────────────────────────── */
function renderOrders(user) {
  const allOrders = getOrders(user.id);
  const count = $('.js-order-count');
  if (count) count.textContent = `${allOrders.length} ${allOrders.length === 1 ? 'order' : 'orders'}`;

  /* Wire segmented filter & search */
  $$('.js-user-order-segments [data-order-seg]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.orderSeg === userOrderSegment);
    btn.setAttribute('aria-selected', btn.dataset.orderSeg === userOrderSegment ? 'true' : 'false');
    btn.onclick = () => {
      userOrderSegment = btn.dataset.orderSeg;
      renderOrders(user);
      hydrateIcons($('[data-view-panel="orders"]'));
    };
  });

  const searchInput = $('.js-user-order-search');
  if (searchInput && !searchInput.dataset.bound) {
    searchInput.dataset.bound = '1';
    searchInput.addEventListener('input', () => {
      userOrderQuery = searchInput.value.trim().toLowerCase();
      renderOrders(user);
      hydrateIcons($('[data-view-panel="orders"]'));
    });
  }

  const orders = allOrders.filter((o) => {
    if (userOrderSegment === 'active' && (o.status === 'delivered' || o.status === 'cancelled')) return false;
    if (userOrderSegment === 'delivered' && o.status !== 'delivered') return false;
    if (userOrderSegment === 'cancelled' && o.status !== 'cancelled') return false;
    if (userOrderQuery) {
      const hay = `${o.id} ${o.tracking || ''} ${(o.items || []).map((i) => i.name).join(' ')}`.toLowerCase();
      if (!hay.includes(userOrderQuery)) return false;
    }
    return true;
  });

  const host = $('.js-orders');
  if (!host) return;
  if (!orders.length) {
    host.innerHTML = `<div class="dash-empty">${allOrders.length ? 'No orders match this filter.' : 'No orders yet. <a href="/pages/shop.html">Browse the lineup</a>.'}</div>`;
    return;
  }
  host.innerHTML = orders.map((o) => {
    const step = STATUS_STAGE[o.status] ?? 2;
    return `
      <article class="order-card" data-order-id="${esc(o.id)}">
        <div class="order-card__head">
          <div>
            <div class="order-card__id">${esc(o.id)} · <span class="order-card__date">${esc(o.date)}</span></div>
            <div class="order-card__meta">Ref ${esc(o.tracking)} · ETA ${esc(o.eta)}</div>
          </div>
          <span class="status status--${esc(o.status)}">${esc(o.status)}</span>
        </div>
        <div class="order-card__items">
          ${(o.items || []).map((it) => {
            const p = productForOrderItem(it);
            return `
              <div class="order-item">
                <img src="${esc(p.img)}" alt="${esc(it.name)}" loading="lazy" width="56" height="56" />
                <div>
                  <b>${esc(it.name)}</b>
                  <small>Qty ${esc(it.qty)}${it.color ? ` · ${esc(it.color)}` : ''}</small>
                </div>
                <strong>${formatNGN((it.price || 0) * (it.qty || 1))}</strong>
              </div>
            `;
          }).join('')}
        </div>
        ${o.status !== 'cancelled' ? `
          <div class="timeline" aria-label="Order progress">
            ${ROUTE_STEPS.map((s, i) => `
              <div class="tl-step ${i + 1 < step ? 'done' : i + 1 === step ? (o.status === 'delivered' ? 'done' : 'doing') : ''}">
                <div class="tl-dot">${i + 1 <= step ? '✓' : i + 1}</div>
                <div class="tl-label">${esc(s.label)}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}
        <div class="order-card__foot">
          <div>
            <span class="order-card__total-label">Order total</span>
            <strong class="order-card__total">${formatNGN(o.total)}</strong>
          </div>
          <div class="order-card__actions">
            <button class="btn btn--quiet btn--sm js-order-detail" data-id="${esc(o.id)}" type="button">Details</button>
            <button class="btn btn--quiet btn--sm js-order-invoice" data-id="${esc(o.id)}" type="button"><i data-lucide="download" class="icon-14"></i> Invoice</button>
            ${(o.status === 'paid' || o.status === 'processing') ? `<button class="btn btn--danger btn--sm js-order-cancel" data-id="${esc(o.id)}" type="button">Cancel order</button>` : ''}
            <button class="btn btn--primary btn--sm js-order-reorder" data-id="${esc(o.id)}" type="button">Reorder</button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  host.querySelectorAll('.js-order-detail').forEach((b) => b.addEventListener('click', () => showOrderModal(user, b.dataset.id)));
  host.querySelectorAll('.js-order-invoice').forEach((b) => b.addEventListener('click', () => downloadInvoice(user, b.dataset.id)));
  host.querySelectorAll('.js-order-cancel').forEach((b) => b.addEventListener('click', () => {
    cancelOrder(b.dataset.id);
    renderAll(user);
    toast(`Order ${b.dataset.id} cancelled.`);
  }));
  host.querySelectorAll('.js-order-reorder').forEach((b) => b.addEventListener('click', () => {
    const ord = getOrders(user.id).find((x) => x.id === b.dataset.id);
    if (!ord) return;
    (ord.items || []).forEach((it) => {
      const p = productForOrderItem(it);
      addToCart({ id: p.id, name: it.name, price: it.price, img: p.img, variant: it.color || 'Graphite' }, it.qty || 1);
    });
    syncCartBadge();
    renderOverviewBag();
    toast(`Added ${ord.items.length} item(s) from ${ord.id} to your cart.`);
  }));
}

function showOrderModal(user, orderId) {
  const o = getOrders(user.id).find((x) => x.id === orderId);
  if (!o) return;
  openModal(`
    <p class="modal-eyebrow">ORDER ROADBOOK · ${esc(o.id)}</p>
    <h3>${esc(STATUS_COPY[o.status] || o.status)}</h3>
    <p class="modal-sub">Placed ${esc(o.date)} · Reference ${esc(o.tracking)} · ETA ${esc(o.eta)}${o.paymentMethod ? ` · ${esc(o.paymentMethod)}` : ''}</p>
    <table class="dash-table" style="margin:14px 0">
      <thead><tr><th>Item</th><th>Qty</th><th class="align-right">Subtotal</th></tr></thead>
      <tbody>${(o.items || []).map((it) => `<tr><td>${esc(it.name)}</td><td>${esc(it.qty)}</td><td class="align-right"><b>${formatNGN((it.price || 0) * (it.qty || 1))}</b></td></tr>`).join('')}</tbody>
    </table>
    <div class="modal-total-row"><span>Total</span><strong>${formatNGN(o.total)}</strong></div>
    <div class="dash-modal__actions">
      <button class="btn btn--quiet btn--sm js-modal-invoice" type="button"><i data-lucide="download" class="icon-14"></i> Download invoice</button>
      <button class="btn btn--primary btn--sm dash-modal__close" type="button">Done</button>
    </div>
  `);
  $('.js-modal-invoice')?.addEventListener('click', () => downloadInvoice(user, o.id));
}

function downloadInvoice(user, orderId) {
  const o = getOrders(user.id).find((x) => x.id === orderId);
  if (!o) return;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${esc(o.id)}</title>
  <style>body{font-family:system-ui,sans-serif;padding:40px;color:#111;max-width:720px;margin:0 auto}h1{margin:0}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{text-align:left;padding:10px;border-bottom:1px solid #ddd}.tot{font-size:20px;font-weight:700;text-align:right;padding-top:16px}</style></head>
  <body><h1>SOKO MOTO · Invoice ${esc(o.id)}</h1><p>Date: ${esc(o.date)} · Customer: ${esc(user.name)} (${esc(user.email)}) · Status: ${esc(o.status).toUpperCase()}</p>
  <p>Tracking: ${esc(o.tracking)} · Origin: Guangzhou Hub</p>
  <table><thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead><tbody>
  ${(o.items || []).map((it) => `<tr><td>${esc(it.name)}</td><td>${esc(it.qty)}</td><td>${formatNGN(it.price)}</td><td>${formatNGN((it.price || 0) * (it.qty || 1))}</td></tr>`).join('')}
  </tbody></table><div class="tot">Total: ${formatNGN(o.total)}</div></body></html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `SOKO-Invoice-${o.id}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(`Downloaded invoice ${o.id}.`);
}

/* ── Saved rides (Wishlist) ────────────────────────────────────── */
function renderWishlist(user) {
  const items = getWishlistProducts(user.id);
  const count = $('.js-wishlist-count');
  if (count) count.textContent = `${items.length} saved`;

  const host = $('.js-wishlist');
  if (!host) return;
  if (!items.length) {
    host.innerHTML = `<div class="dash-empty">Nothing saved yet. Tap <b>Add from lineup</b> above or head to the <a href="/pages/shop.html">shop</a> to bookmark rides you want to compare.</div>`;
    return;
  }
  host.innerHTML = items.map((p) => `
    <article class="wish-card">
      <div class="wish-card__media">
        <img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy" width="640" height="420" />
        <span class="wish-card__tag">${esc(p.cat)}</span>
      </div>
      <div class="wish-card__body">
        <div class="wish-card__spec">${esc(p.spec)} · ${p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}</div>
        <h3>${esc(p.name)}</h3>
        <div class="wish-card__price">${formatNGN(p.price)}</div>
        <div class="wish-card__actions">
          <button class="btn btn--primary btn--sm js-wish-cart" data-id="${esc(p.id)}" type="button"><i data-lucide="shopping-bag" class="icon-14"></i> Add to cart</button>
          <button class="btn btn--quiet btn--sm js-wish-remove" data-id="${esc(p.id)}" type="button">Unsave</button>
        </div>
      </div>
    </article>
  `).join('');

  host.querySelectorAll('.js-wish-cart').forEach((b) => b.addEventListener('click', () => {
    const p = PRODUCTS.find((x) => x.id === b.dataset.id) || getProduct(b.dataset.id);
    if (!p) return;
    addToCart({ id: p.id, name: p.name, price: p.price, img: p.img, variant: 'Graphite' }, 1);
    syncCartBadge();
    renderOverviewBag();
    toast(`${p.name} added to cart.`);
  }));
  host.querySelectorAll('.js-wish-remove').forEach((b) => b.addEventListener('click', () => {
    toggleWishlist(user.id, b.dataset.id);
    renderAll(user);
    toast('Removed from saved rides.');
  }));
}

function openLineupModal(user) {
  const savedIds = new Set(getWishlistProducts(user.id).map((p) => p.id));
  const m = openModal(`
    <p class="modal-eyebrow">SOKO LINEUP · QUICK PICKER</p>
    <h3>Save rides or add to bag</h3>
    <p class="modal-sub">Bookmark models from the SOKO workshop catalogue to compare specs in your Rider OS.</p>
    <div class="ios-lineup-picker">
      ${PRODUCTS.map((p) => {
        const isSaved = savedIds.has(p.id);
        return `
          <div class="ios-lineup-item">
            <img src="${esc(p.img)}" alt="${esc(p.name)}" width="64" height="48" loading="lazy" />
            <div class="ios-lineup-item__meta">
              <b>${esc(p.name)}</b>
              <small>${esc(p.cat)} · ${esc(p.spec)} · ${formatNGN(p.price)}</small>
            </div>
            <div class="ios-lineup-item__actions">
              <button type="button" class="btn ${isSaved ? 'btn--primary' : 'btn--quiet'} btn--sm js-picker-save" data-id="${esc(p.id)}">
                ${isSaved ? 'Saved' : 'Save'}
              </button>
              <button type="button" class="btn btn--quiet btn--sm js-picker-cart" data-id="${esc(p.id)}">+ Bag</button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `, { wide: true });

  m.querySelectorAll('.js-picker-save').forEach((btn) => btn.addEventListener('click', () => {
    toggleWishlist(user.id, btn.dataset.id);
    renderAll(user);
    closeActiveModal();
    toast('Updated saved rides.');
  }));
  m.querySelectorAll('.js-picker-cart').forEach((btn) => btn.addEventListener('click', () => {
    const p = PRODUCTS.find((x) => x.id === btn.dataset.id);
    if (!p) return;
    addToCart({ id: p.id, name: p.name, price: p.price, img: p.img, variant: 'Graphite' }, 1);
    syncCartBadge();
    renderOverviewBag();
    toast(`${p.name} added to bag.`);
  }));
}

/* ── Wallet, Cards & Split-in-3 Estimator ─────────────────────── */
function renderWallet(user) {
  const w = getWallet(user.id);
  const bal = $('.js-wallet-balance');
  if (bal) bal.textContent = formatNGN(w.balance);

  const tbody = $('.js-wallet-txns tbody');
  if (tbody) {
    const txList = w.transactions || w.tx || [];
    tbody.innerHTML = txList.map((t) => `
      <tr>
        <td>${esc(t.date)}</td>
        <td><b>${esc(t.label || t.note)}</b></td>
        <td><span class="status status--${t.type === 'credit' ? 'delivered' : 'cancelled'}">${esc(t.type)}</span></td>
        <td class="align-right" style="font-weight:700;color:${t.amount > 0 ? 'var(--u-ok)' : 'var(--u-danger)'}">${t.amount > 0 ? '+' : ''}${formatNGN(t.amount)}</td>
      </tr>
    `).join('');
  }

  const ref = getReferral(user.id, user.name);
  const refCode = $('.js-ref-code');
  const refStats = $('.js-ref-stats');
  if (refCode) refCode.textContent = ref.code;
  if (refStats) refStats.innerHTML = `<span><b>${ref.invited}</b> friends invited</span><span><b>${formatNGN(ref.earned)}</b> earned</span>`;

  const copyBtn = $('.js-ref-copy');
  if (copyBtn) {
    copyBtn.onclick = () => {
      navigator.clipboard?.writeText(ref.code);
      toast(`Copied referral code ${ref.code}.`);
    };
  }

  const topup = $('.js-topup');
  if (topup) {
    topup.onclick = () => {
      const m = openModal(`
        <p class="modal-eyebrow">DEMO WALLET</p>
        <h3>Add sample credit</h3>
        <p class="modal-sub">Pick an amount or type your own. This updates your local demo balance only; no payment is collected.</p>
        <div class="chip-group">
          ${[10000, 25000, 50000, 100000].map((a) => `<button type="button" class="btn btn--quiet btn--sm js-topup-amt" data-amt="${a}">${formatNGN(a)}</button>`).join('')}
        </div>
        <div class="field"><label for="topup-custom">Custom amount (₦)</label><input id="topup-custom" class="input js-topup-custom" type="number" value="25000" min="1000" step="1000" /></div>
        <div class="dash-modal__actions">
          <button class="btn btn--primary js-topup-go" type="button">Add demo credit</button>
        </div>
      `);
      m.querySelectorAll('.js-topup-amt').forEach((b) => b.addEventListener('click', () => { m.querySelector('.js-topup-custom').value = b.dataset.amt; }));
      m.querySelector('.js-topup-go').addEventListener('click', () => {
        const amt = Number(m.querySelector('.js-topup-custom').value || 0);
        if (amt < 500) { toast('Minimum top-up is ₦500.'); return; }
        topUpWallet(user.id, amt, 'Card top-up · Paystack');
        closeActiveModal();
        renderAll(user);
        toast(`Added ${formatNGN(amt)} to your wallet.`);
      });
    };
  }

  /* Paystack Split-in-3 & Instalment Estimator */
  renderFinanceSimulator(user, w.balance);

  const cardsHost = $('.js-cards');
  const cards = getCards(user.id);
  if (cardsHost) {
    cardsHost.innerHTML = cards.length
      ? cards.map((c) => {
        const isDef = !!(c.isDefault || c.default);
        return `
        <div class="pay-card pay-card--${esc(String(c.brand || 'visa').toLowerCase())}">
          <div class="pay-card__top">
            <span class="pay-card__brand">${esc(c.brand)}</span>
            ${isDef ? `<span class="pay-card__badge">Default</span>` : ''}
          </div>
          <div class="pay-card__num">•••• •••• •••• ${esc(c.last4)}</div>
          <div class="pay-card__meta"><span>${esc(c.holder || user.name)}</span><span>Exp ${esc(c.exp)}</span></div>
          <div class="pay-card__actions">
            ${!isDef ? `<button class="btn btn--light btn--sm js-card-default" data-id="${esc(c.id)}" type="button">Make default</button>` : ''}
            <button class="btn btn--light btn--sm js-card-remove" data-id="${esc(c.id)}" type="button">Remove</button>
          </div>
        </div>
      `;
      }).join('')
      : `<div class="dash-empty">No saved cards yet.</div>`;

    cardsHost.querySelectorAll('.js-card-default').forEach((b) => b.addEventListener('click', () => {
      setDefaultCard(user.id, b.dataset.id);
      renderWallet(user);
      toast('Default card updated.');
    }));
    cardsHost.querySelectorAll('.js-card-remove').forEach((b) => b.addEventListener('click', () => {
      removeCard(user.id, b.dataset.id);
      renderWallet(user);
      toast('Card removed.');
    }));
  }

  const addCardBtn = $('.js-add-card');
  if (addCardBtn) {
    addCardBtn.onclick = () => {
      const m = openModal(`
        <p class="modal-eyebrow">DEMO PAYMENT METHOD</p>
        <h3>Save a card label</h3>
        <p class="modal-sub">Enter the card brand, last four digits and expiry only. Never enter a full card number or CVV in this demo.</p>
        <div class="dash-view__grid dash-grid-form">
          <div class="field"><label for="card-holder">Cardholder name</label><input id="card-holder" class="input js-card-holder" value="${esc(user.name)}" autocomplete="cc-name" /></div>
          <div class="field"><label for="card-brand">Card network</label>
            <select id="card-brand" class="select js-card-brand">
              <option value="Visa">Visa</option>
              <option value="Mastercard">Mastercard</option>
              <option value="Verve">Verve</option>
            </select>
          </div>
          <div class="field"><label for="card-last4">Last 4 digits (demo)</label><input id="card-last4" class="input js-card-last4" placeholder="4821" inputmode="numeric" maxlength="4" autocomplete="off" /></div>
          <div class="field"><label for="card-exp">Expiry (MM/YY)</label><input id="card-exp" class="input js-card-exp" placeholder="09/28" maxlength="5" autocomplete="cc-exp" /></div>
        </div>
        <p class="form-note" style="margin-top:10px">Stored in this browser’s localStorage only. No payment processor is contacted.</p>
        <div class="dash-modal__actions"><button class="btn btn--primary js-card-save" type="button">Save demo card</button></div>
      `);
      m.querySelector('.js-card-save').addEventListener('click', () => {
        const last4 = m.querySelector('.js-card-last4').value.replace(/\D/g, '').slice(-4);
        const brand = m.querySelector('.js-card-brand').value || 'Visa';
        const holder = m.querySelector('.js-card-holder').value.trim();
        const exp = m.querySelector('.js-card-exp').value.trim();
        if (last4.length !== 4 || !holder || !exp) { toast('Enter cardholder name, 4 digits and expiry.'); return; }
        addCard(user.id, { brand, last4, exp, holder });
        closeActiveModal();
        renderWallet(user);
        toast(`Saved ${brand} ending in ${last4}.`);
      });
    };
  }
}

function renderFinanceSimulator(user, walletBalance = 0) {
  const simHost = $('.js-finance-sim');
  if (!simHost) return;
  const bikes = PRODUCTS.filter((p) => p.cat !== 'Accessory');
  const bike = bikes.find((b) => b.id === selectedSimBikeId) || bikes[0];
  const rates = { 1: 0, 3: 0, 6: 0.045, 12: 0.085 };
  const rate = rates[selectedPlanMonths] ?? 0;
  const netPrincipal = Math.max(0, bike.price - walletBalance);
  const totalFinanced = Math.round(netPrincipal * (1 + rate));
  const monthly = Math.round(totalFinanced / selectedPlanMonths);

  $$('.js-wallet-plan-seg [data-plan-months]').forEach((btn) => {
    const m = Number(btn.dataset.planMonths);
    btn.classList.toggle('is-active', m === selectedPlanMonths);
    btn.onclick = () => {
      selectedPlanMonths = m;
      renderFinanceSimulator(user, walletBalance);
    };
  });

  simHost.innerHTML = `
    <div class="finance-sim-grid">
      <div class="field">
        <label for="sim-bike-select">Select SOKO model</label>
        <select id="sim-bike-select" class="select js-sim-bike-select">
          ${bikes.map((b) => `<option value="${esc(b.id)}" ${b.id === bike.id ? 'selected' : ''}>${esc(b.name)} · ${formatNGN(b.price)}</option>`).join('')}
        </select>
      </div>
      <div class="finance-sim-readout">
        <div><span>Retail price</span><b>${formatNGN(bike.price)}</b></div>
        <div><span>Less SOKO Pass credit</span><b class="u-text-ok">-${formatNGN(walletBalance)}</b></div>
        <div><span>${selectedPlanMonths === 1 ? 'Due at checkout' : `${selectedPlanMonths} monthly payments`}</span><strong class="finance-sim-monthly">${formatNGN(monthly)}${selectedPlanMonths > 1 ? '/mo' : ''}</strong></div>
      </div>
    </div>
  `;
  simHost.querySelector('.js-sim-bike-select')?.addEventListener('change', (e) => {
    selectedSimBikeId = e.target.value;
    renderFinanceSimulator(user, walletBalance);
  });
}

/* ── Addresses ─────────────────────────────────────────────────── */
function renderAddresses(user) {
  const host = $('.js-addresses');
  if (!host) return;
  const list = getAddresses(user.id);
  host.innerHTML = list.length
    ? list.map((a) => {
      const isDef = !!(a.isDefault || a.default);
      const isLagos = /lagos/i.test(`${a.city || ''} ${a.state || ''}`);
      return `
        <div class="addr-card ${isDef ? 'is-default' : ''}">
          <div class="addr-card__top">
            <span class="addr-card__label"><i data-lucide="map-pin" class="icon-14"></i> ${esc(a.label)}</span>
            ${isDef ? `<span class="status status--delivered">Default</span>` : ''}
          </div>
          <h4>${esc(a.name)}</h4>
          <p>${esc(a.line1)}${a.line2 ? ', ' + esc(a.line2) : ''}<br>${esc(a.city)}${a.state ? ', ' + esc(a.state) : ''} · ${esc(a.country || 'Nigeria')}<br>${esc(a.phone)}</p>
          <div class="addr-card__freight">${isLagos ? 'Free Lagos doorstep delivery' : 'Nationwide crate delivery · ₦25,000'}</div>
          <div class="addr-card__actions">
            ${!isDef ? `<button class="btn btn--quiet btn--sm js-addr-default" data-id="${esc(a.id)}" type="button">Make default</button>` : ''}
            <button class="btn btn--quiet btn--sm js-addr-edit" data-id="${esc(a.id)}" type="button">Edit</button>
            <button class="btn btn--danger btn--sm js-addr-remove" data-id="${esc(a.id)}" type="button">Remove</button>
          </div>
        </div>
      `;
    }).join('')
    : `<div class="dash-empty">No saved addresses yet.</div>`;

  host.querySelectorAll('.js-addr-default').forEach((b) => b.addEventListener('click', () => {
    setDefaultAddress(user.id, b.dataset.id);
    renderAddresses(user);
    hydrateIcons(host);
    toast('Default address updated.');
  }));
  host.querySelectorAll('.js-addr-remove').forEach((b) => b.addEventListener('click', () => {
    removeAddress(user.id, b.dataset.id);
    renderAddresses(user);
    hydrateIcons(host);
    toast('Address removed.');
  }));
  host.querySelectorAll('.js-addr-edit').forEach((b) => b.addEventListener('click', () => {
    const a = list.find((x) => x.id === b.dataset.id);
    if (a) openAddressModal(user, a);
  }));

  const addBtn = $('.js-add-addr');
  if (addBtn) addBtn.onclick = () => openAddressModal(user, {});
}

function openAddressModal(user, addr) {
  const m = openModal(`
    <p class="modal-eyebrow">DELIVERY DESTINATION</p>
    <h3>${addr.id ? 'Edit' : 'Add'} address</h3>
    <div class="dash-view__grid dash-grid-form">
      <div class="field"><label for="addr-label">Label (Home, Office)</label><input id="addr-label" class="input js-addr-label" value="${esc(addr.label || 'Home')}" /></div>
      <div class="field"><label for="addr-name">Recipient</label><input id="addr-name" class="input js-addr-name" value="${esc(addr.name || user.name)}" /></div>
      <div class="field"><label for="addr-phone">Phone</label><input id="addr-phone" class="input js-addr-phone" value="${esc(addr.phone || user.phone || '')}" /></div>
      <div class="field"><label for="addr-line1">Street address</label><input id="addr-line1" class="input js-addr-line1" value="${esc(addr.line1 || '')}" /></div>
      <div class="field"><label for="addr-line2">Apartment, suite or landmark (optional)</label><input id="addr-line2" class="input js-addr-line2" value="${esc(addr.line2 || '')}" /></div>
      <div class="field"><label for="addr-city">City</label><input id="addr-city" class="input js-addr-city" value="${esc(addr.city || 'Lagos')}" /></div>
      <div class="field"><label for="addr-state">State / region</label><input id="addr-state" class="input js-addr-state" value="${esc(addr.state || 'Lagos')}" /></div>
      <div class="field"><label for="addr-country">Country</label><input id="addr-country" class="input js-addr-country" value="${esc(addr.country || 'Nigeria')}" /></div>
    </div>
    <div class="dash-modal__actions"><button class="btn btn--primary js-addr-save" type="button">Save address</button></div>
  `);
  m.querySelector('.js-addr-save').addEventListener('click', () => {
    const next = {
      id: addr.id,
      label: m.querySelector('.js-addr-label').value.trim(),
      name: m.querySelector('.js-addr-name').value.trim(),
      phone: m.querySelector('.js-addr-phone').value.trim(),
      line1: m.querySelector('.js-addr-line1').value.trim(),
      line2: m.querySelector('.js-addr-line2').value.trim(),
      city: m.querySelector('.js-addr-city').value.trim(),
      state: m.querySelector('.js-addr-state').value.trim(),
      country: m.querySelector('.js-addr-country').value.trim() || 'Nigeria',
      isDefault: !!(addr.isDefault ?? addr.default),
    };
    if (!next.line1) { toast('Street address is required.'); return; }
    saveAddress(user.id, next);
    closeActiveModal();
    renderAddresses(user);
    hydrateIcons($('[data-view-panel="addresses"]'));
    toast('Address saved.');
  });
}

/* ── Garage & Live Bench Verifications ─────────────────────────── */
function renderGarage(user) {
  const host = $('.js-garage');
  if (!host) return;
  const list = getGarage(user.id);
  host.innerHTML = list.length
    ? list.map((b) => {
      const prod = productForOrderItem({ name: b.model });
      const { pct, daysLeft } = warrantyProgress(b);
      return `
        <article class="garage-card">
          <div class="garage-card__media">
            <img src="${esc(prod.img)}" alt="${esc(b.model)}" loading="lazy" width="640" height="420" />
            <span class="status status--delivered">90-Day Guarantee · Factory Cover</span>
          </div>
          <div class="garage-card__body">
            <div class="garage-card__serial">VIN · ${esc(b.serial)}</div>
            <h3>${esc(b.model)}</h3>
            <p class="garage-card__meta">Registered ${esc(b.registered)} · Covered until ${esc(b.warrantyUntil)} (${daysLeft} days left)</p>
            <div class="garage-card__specs">
              <span><i data-lucide="battery-charging" class="icon-14"></i> Battery 18 mo</span>
              <span><i data-lucide="zap" class="icon-14"></i> Motor 12 mo</span>
              <span><i data-lucide="shield-check" class="icon-14"></i> 40-pt QC passed</span>
            </div>
            <div class="garage-card__bar" aria-hidden="true"><span style="width:${pct}%"></span></div>
            <div class="garage-card__actions">
              <button class="btn btn--primary btn--sm js-bike-service" data-model="${esc(b.model)}" type="button"><i data-lucide="wrench" class="icon-14"></i> Book service</button>
              <a class="btn btn--quiet btn--sm" href="/pages/faq.html">Care guide</a>
              <button class="btn btn--danger btn--sm js-bike-remove" data-id="${esc(b.id)}" type="button">Remove</button>
            </div>
          </div>
        </article>
      `;
    }).join('')
    : `<div class="dash-empty">No bikes registered yet. Add your SOKO VIN to track warranty and service.</div>`;

  host.querySelectorAll('.js-bike-service').forEach((b) => b.addEventListener('click', () => {
    activateView('support');
    history.replaceState(null, '', '#support');
    $('.js-tk-type').value = 'service';
    $('.js-tk-subject').value = `Scheduled service for ${b.dataset.model}`;
    $('.js-tk-detail').focus();
  }));
  host.querySelectorAll('.js-bike-remove').forEach((b) => b.addEventListener('click', () => {
    removeBike(user.id, b.dataset.id);
    renderAll(user);
    toast('Removed from garage.');
  }));

  const regBtn = $('.js-register-bike');
  if (regBtn) {
    regBtn.onclick = () => {
      const m = openModal(`
        <p class="modal-eyebrow">GARAGE REGISTRATION</p>
        <h3>Register a SOKO bike</h3>
        <div class="dash-view__grid dash-grid-form">
          <div class="field"><label for="reg-model">Model</label>
            <select id="reg-model" class="select js-b-model">
              ${PRODUCTS.filter((p) => p.cat !== 'Accessory').map((p) => `<option>${esc(p.name)} · ${esc(p.cat)}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label for="reg-serial">Serial / VIN</label><input id="reg-serial" class="input js-b-serial" placeholder="SM1-2026-XXXXX" /></div>
        </div>
        <div class="dash-modal__actions"><button class="btn btn--primary js-b-save" type="button">Register bike</button></div>
      `);
      m.querySelector('.js-b-save').addEventListener('click', () => {
        const model = m.querySelector('.js-b-model').value;
        const serial = m.querySelector('.js-b-serial').value.trim();
        if (!serial) { toast('Enter your bike serial / VIN.'); return; }
        registerBike(user.id, { model, serial });
        closeActiveModal();
        renderAll(user);
        toast(`${model} registered to your garage.`);
      });
    };
  }

  /* Render Scheduled Bench Verifications in Garage */
  const verifyHost = $('.js-garage-verifications');
  if (verifyHost) {
    const verifications = getVerifications(user.id);
    if (!verifications.length) {
      verifyHost.innerHTML = `<div class="dash-empty">No live bench video verifications scheduled yet. Tap <b>Schedule slot</b> to watch a 40-point inspection live from Guangzhou.</div>`;
    } else {
      verifyHost.innerHTML = `
        <div class="ios-verify-stack">
          ${verifications.map((v) => `
            <div class="ios-verify-row">
              <span class="ios-verify-row__icon"><i data-lucide="video" class="icon-18"></i></span>
              <div class="ios-verify-row__copy">
                <div class="ios-verify-row__top">
                  <b>${esc(v.model)} · <span class="mono">${esc(v.ref)}</span></b>
                  <span class="status status--${v.status === 'booked' ? 'shipped' : v.status === 'completed' ? 'delivered' : 'cancelled'}">${esc(v.status)}</span>
                </div>
                <small>${esc(v.date)} at ${esc(v.slot)} WAT · WhatsApp link to ${esc(v.phone || user.phone || user.email)}</small>
              </div>
              ${v.status === 'booked' ? `<button type="button" class="btn btn--quiet btn--sm js-garage-cancel-verify" data-ref="${esc(v.ref)}">Cancel</button>` : ''}
            </div>
          `).join('')}
        </div>
      `;
      verifyHost.querySelectorAll('.js-garage-cancel-verify').forEach((b) => b.addEventListener('click', () => {
        cancelVerification(b.dataset.ref);
        renderAll(user);
        toast(`Bench verification ${b.dataset.ref} cancelled.`);
      }));
    }
  }
}

/* ── Live Guangzhou Bench Video Verification Modal ─────────────── */
function openVerificationModal(user) {
  const bikes = CATALOG.filter((p) => p.category !== 'Accessory');
  const m = openModal(`
    <p class="modal-eyebrow">GUANGZHOU BENCH · 40-POINT VIDEO CHECK</p>
    <h3>Book a live unit verification</h3>
    <p class="modal-sub">Spend 20 minutes on live video with our Guangzhou bench engineer as your bike passes its 40-point inspection before crating.</p>
    <div class="dash-view__grid dash-grid-form">
      <div class="field">
        <label for="vr-model">Motorcycle model</label>
        <select id="vr-model" class="select js-vr-model">
          ${bikes.map((b) => `<option value="${esc(b.name)} · ${esc(b.category)}">${esc(b.name)} · ${esc(b.category)}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label for="vr-phone">WhatsApp number (for live video link)</label>
        <input id="vr-phone" class="input js-vr-phone" type="tel" value="${esc(user.phone || '+234 801 234 5678')}" />
      </div>
      <div class="field">
        <label for="vr-date">Preferred date</label>
        <input id="vr-date" class="input js-vr-date" type="date" value="2026-10-15" min="2026-10-08" />
      </div>
      <div class="field">
        <label for="vr-slot">WAT time slot (Guangzhou CST -7h)</label>
        <select id="vr-slot" class="select js-vr-slot">
          <option value="09:30">09:30 WAT (16:30 Guangzhou)</option>
          <option value="11:00" selected>11:00 WAT (18:00 Guangzhou)</option>
          <option value="14:00">14:00 WAT (21:00 Guangzhou)</option>
          <option value="16:00">16:00 WAT (23:00 Guangzhou)</option>
        </select>
      </div>
    </div>
    <div class="dash-modal__actions">
      <button type="button" class="btn btn--primary js-vr-submit"><i data-lucide="video" class="icon-16"></i> Confirm bench slot</button>
    </div>
  `);
  m.querySelector('.js-vr-submit')?.addEventListener('click', () => {
    const model = m.querySelector('.js-vr-model').value;
    const phone = m.querySelector('.js-vr-phone').value.trim();
    const date = m.querySelector('.js-vr-date').value || '2026-10-15';
    const slot = m.querySelector('.js-vr-slot').value || '11:00';
    if (!phone) { toast('Please provide a WhatsApp number for the video link.'); return; }
    const rec = bookVerification({ name: user.name, phone, email: user.email, model, date, slot });
    closeActiveModal();
    renderAll(user);
    toast(`Booked ${rec.ref} · ${date} at ${slot} WAT.`);
  });
}

/* ── Active Bag & Split-in-3 Drawer Modal ──────────────────────── */
function openBagModal(user) {
  const items = loadCart();
  const subtotal = cartTotal();
  const settings = getAdminSettings();
  const taxRate = Number(settings.taxRate ?? 7.5);
  const tax = Math.round(subtotal * (taxRate / 100));
  const total = subtotal + tax;
  const split3 = Math.round(total / 3);

  const m = openModal(`
    <p class="modal-eyebrow">SOKO BAG · PAYSTACK SPLIT-IN-3 READY</p>
    <h3>Your active bag</h3>
    ${!items.length ? `
      <div class="dash-empty" style="margin:14px 0">Your bag is empty. Add a bike or accessory from the showroom to preview checkout.</div>
      <div class="dash-modal__actions">
        <a class="btn btn--primary" href="/pages/shop.html">Explore showroom <i data-lucide="arrow-up-right" class="icon-16"></i></a>
      </div>
    ` : `
      <div class="ios-bag-sheet-list">
        ${items.map((it, idx) => `
          <div class="ios-bag-sheet-item">
            <img src="${esc(it.img || '/images/bike-commuter-side.webp')}" alt="${esc(it.name)}" width="56" height="56" />
            <div class="ios-bag-sheet-item__meta">
              <b>${esc(it.name)}</b>
              <small>${esc(it.variant || 'Standard')} · ${formatNGN(it.price)}</small>
            </div>
            <div class="stock-ctrl">
              <button type="button" class="js-bag-minus" data-idx="${idx}" aria-label="Decrease quantity">&minus;</button>
              <span class="stock-num">${it.qty || 1}</span>
              <button type="button" class="js-bag-plus" data-idx="${idx}" aria-label="Increase quantity">+</button>
            </div>
            <button type="button" class="btn btn--quiet btn--sm js-bag-rm" data-idx="${idx}" aria-label="Remove item"><i data-lucide="trash-2" class="icon-14"></i></button>
          </div>
        `).join('')}
      </div>
      <div class="ios-bag-sheet-summary">
        <div><span>Subtotal</span><b>${formatNGN(subtotal)}</b></div>
        <div><span>Estimated VAT (${taxRate}%)</span><b>${formatNGN(tax)}</b></div>
        <div><span>Lagos delivery</span><b class="u-text-ok">Free</b></div>
        <div class="ios-bag-sheet-summary__total"><span>Total</span><strong>${formatNGN(total)}</strong></div>
        <div class="ios-bag-sheet-summary__split"><span>Or Paystack Split-in-3 (0% interest)</span><strong>${formatNGN(split3)} / month × 3</strong></div>
      </div>
      <div class="dash-modal__actions">
        <a class="btn btn--quiet" href="/pages/cart.html">Full cart</a>
        <a class="btn btn--primary" href="/pages/checkout.html">Proceed to checkout <i data-lucide="arrow-right" class="icon-16"></i></a>
      </div>
    `}
  `, { wide: true });

  m.querySelectorAll('.js-bag-minus').forEach((b) => b.addEventListener('click', () => {
    const idx = Number(b.dataset.idx);
    const current = loadCart()[idx];
    if (current) setQty(idx, (current.qty || 1) - 1);
    syncCartBadge();
    renderOverviewBag();
    openBagModal(user);
  }));
  m.querySelectorAll('.js-bag-plus').forEach((b) => b.addEventListener('click', () => {
    const idx = Number(b.dataset.idx);
    const current = loadCart()[idx];
    if (current) setQty(idx, (current.qty || 1) + 1);
    syncCartBadge();
    renderOverviewBag();
    openBagModal(user);
  }));
  m.querySelectorAll('.js-bag-rm').forEach((b) => b.addEventListener('click', () => {
    removeItem(Number(b.dataset.idx));
    syncCartBadge();
    renderOverviewBag();
    openBagModal(user);
  }));
}

/* ── iOS Spotlight Command Search Modal (⌘K) ───────────────────── */
function openSpotlightModal(user) {
  const orders = getOrders(user.id);
  const m = openModal(`
    <p class="modal-eyebrow">RIDER OS · SPOTLIGHT</p>
    <h3>Quick jump &amp; search</h3>
    <div class="field" style="margin-top:10px">
      <label class="sr-only" for="ios-spotlight-input">Search views, orders or bikes</label>
      <input id="ios-spotlight-input" class="input js-spotlight-input" type="search" placeholder="Jump to Orders, Wallet, Garage, Bench Check, or search a bike..." autocomplete="off" />
    </div>
    <div class="ios-spotlight-results js-spotlight-results"></div>
  `);

  const input = m.querySelector('.js-spotlight-input');
  const results = m.querySelector('.js-spotlight-results');

  const renderHits = (q = '') => {
    const needle = q.trim().toLowerCase();
    const views = Object.entries(VIEW_LABELS)
      .filter(([k, label]) => !needle || label.toLowerCase().includes(needle) || k.includes(needle))
      .map(([k, label]) => ({ type: 'View', title: label, sub: `Open ${label} panel`, action: () => { activateView(k, { focusHeading: true }); history.replaceState(null, '', '#' + k); } }));

    const orderHits = orders
      .filter((o) => !needle || o.id.toLowerCase().includes(needle) || (o.items?.[0]?.name || '').toLowerCase().includes(needle))
      .slice(0, 3)
      .map((o) => ({ type: 'Order', title: `${o.id} · ${o.items?.[0]?.name || 'Order'}`, sub: `${o.status.toUpperCase()} · ${formatNGN(o.total)}`, action: () => showOrderModal(user, o.id) }));

    const bikeHits = PRODUCTS
      .filter((p) => !needle || p.name.toLowerCase().includes(needle) || p.cat.toLowerCase().includes(needle))
      .slice(0, 4)
      .map((p) => ({ type: p.cat, title: p.name, sub: `${p.spec} · ${formatNGN(p.price)}`, action: () => { addToCart({ id: p.id, name: p.name, price: p.price, img: p.img, variant: 'Graphite' }, 1); syncCartBadge(); renderOverviewBag(); toast(`${p.name} added to bag.`); } }));

    const combined = [...views, ...orderHits, ...bikeHits].slice(0, 8);
    results.innerHTML = combined.length
      ? combined.map((h, i) => `
          <button type="button" class="ios-spotlight-item" data-hit="${i}">
            <div><b>${esc(h.title)}</b><small>${esc(h.sub)}</small></div>
            <span class="ios-spotlight-item__tag">${esc(h.type)}</span>
          </button>
        `).join('')
      : `<div class="dash-empty">No matching results.</div>`;

    results.querySelectorAll('.ios-spotlight-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const hit = combined[Number(btn.dataset.hit)];
        closeActiveModal();
        hit?.action();
      });
    });
  };

  renderHits('');
  input?.addEventListener('input', () => renderHits(input.value));
}

/* ── Support ───────────────────────────────────────────────────── */
function renderSupport(user) {
  const host = $('.js-tickets');
  if (!host) return;
  const list = getTickets(user.id);
  host.innerHTML = list.length
    ? list.map((t) => `
      <article class="ticket-row">
        <div>
          <div class="ticket-row__meta">${esc(t.type).toUpperCase()} · ${esc(t.date)} · #${esc(t.id)}</div>
          <div class="ticket-row__title">${esc(t.subject)}</div>
          <div class="ticket-row__detail">${esc(t.detail)}</div>
        </div>
        <span class="status status--${t.status === 'resolved' ? 'delivered' : 'processing'}">${esc(t.status)}</span>
      </article>
    `).join('')
    : `<div class="dash-empty">No support requests yet.</div>`;

  const submit = $('.js-tk-submit');
  if (submit) {
    submit.onclick = () => {
      const type = $('.js-tk-type').value;
      const subject = $('.js-tk-subject').value.trim();
      const detail = $('.js-tk-detail').value.trim();
      if (!subject) { toast('Add a short subject so the crew knows where to route this.'); return; }
      addTicket(user.id, { type, subject, detail });
      $('.js-tk-subject').value = '';
      $('.js-tk-detail').value = '';
      renderSupport(user);
      toast('Support request saved to your account.');
    };
  }
}

/* ── Notifications ─────────────────────────────────────────────── */
function renderNotifications(user) {
  const host = $('.js-notifs');
  if (!host) return;
  const list = getNotifs(user.id);
  host.innerHTML = list.length
    ? list.map((n) => `
      <div class="notif ${n.unread ? 'is-unread' : ''}">
        <span class="notif__dot" aria-hidden="true"></span>
        <div class="notif__body">
          <div class="notif__title">${esc(n.title)}</div>
          <div class="notif__copy">${esc(n.body)}</div>
        </div>
        <div class="notif__right">
          <div class="notif__time">${esc(n.time)}</div>
          <div class="notif__actions">
            ${n.unread ? `<button class="btn btn--quiet btn--sm js-n-read" data-id="${esc(n.id)}" type="button">Mark read</button>` : ''}
            <button class="btn btn--quiet btn--sm js-n-del" data-id="${esc(n.id)}" type="button" aria-label="Delete notification">&times;</button>
          </div>
        </div>
      </div>
    `).join('')
    : `<div class="dash-empty">You’re all caught up.</div>`;

  host.querySelectorAll('.js-n-read').forEach((b) => b.addEventListener('click', () => {
    markNotifRead(user.id, b.dataset.id);
    renderNotifications(user);
    renderOverview(user);
    syncUnreadBadge(user.id);
  }));
  host.querySelectorAll('.js-n-del').forEach((b) => b.addEventListener('click', () => {
    deleteNotif(user.id, b.dataset.id);
    renderNotifications(user);
    renderOverview(user);
    syncUnreadBadge(user.id);
  }));

  const markAll = $('.js-mark-read');
  if (markAll) {
    markAll.onclick = () => {
      markAllRead(user.id);
      renderNotifications(user);
      renderOverview(user);
      syncUnreadBadge(user.id);
      toast('All notifications marked read.');
    };
  }
}

/* ── Settings ──────────────────────────────────────────────────── */
function renderSettings(user) {
  $('.js-set-name').value = user.name || '';
  $('.js-set-email').value = user.email || '';
  $('.js-set-phone').value = user.phone || '';
  $('.js-set-city').value = user.city || '';

  $('.js-save-profile').onclick = () => {
    const updated = updateProfile({
      name: $('.js-set-name').value.trim(),
      phone: $('.js-set-phone').value.trim(),
      city: $('.js-set-city').value.trim(),
    });
    if (updated) {
      $$('.js-user-name').forEach((n) => { n.textContent = updated.name; });
      $$('.js-user-initial').forEach((n) => { n.textContent = (updated.name || 'S')[0].toUpperCase(); });
      renderOverview(updated);
      toast('Profile saved.');
    }
  };

  $('.js-pw-change').onclick = () => {
    const res = changePassword($('.js-pw-cur').value, $('.js-pw-new').value);
    if (res.error) { toast(res.error); return; }
    $('.js-pw-cur').value = '';
    $('.js-pw-new').value = '';
    toast('Password updated.');
  };

  const prefs = getPrefs(user.id);
  $('.js-pref-order').checked = !!prefs.orderUpdates;
  $('.js-pref-promo').checked = !!prefs.promos;
  $('.js-pref-sms').checked = !!prefs.sms;
  ['.js-pref-order', '.js-pref-promo', '.js-pref-sms'].forEach((sel) => {
    $(sel).onchange = () => {
      setPrefs(user.id, {
        orderUpdates: $('.js-pref-order').checked,
        promos: $('.js-pref-promo').checked,
        sms: $('.js-pref-sms').checked,
      });
      toast('Preferences saved.');
    };
  });

  $('.js-delete-account').onclick = () => {
    const m = openModal(`
      <p class="modal-eyebrow">REMOVE ACCOUNT</p>
      <h3>Delete this demo account?</h3>
      <p class="modal-sub">This clears your profile, orders, saved rides, garage and wallet from this browser. Guest shopping stays available.</p>
      <div class="dash-modal__actions">
        <button class="btn btn--quiet dash-modal__close" type="button">Keep account</button>
        <button class="btn btn--danger js-confirm-delete" type="button">Delete account</button>
      </div>
    `);
    m.querySelector('.js-confirm-delete').addEventListener('click', () => {
      deleteAccount();
      location.href = '/';
    });
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
