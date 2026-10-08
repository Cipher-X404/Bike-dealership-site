/* ============================================================================
   SOKO MOTO · WORKSHOP CONTROL (Admin Dashboard · iOS Spatial Edition)
   Orders, stock, Guangzhou bench verifications, support tickets,
   riders, analytics and store settings.
   ============================================================================ */
import { hydrateIcons } from '/src/js/icons.js';
import {
  ensureSeeded, isAdmin, logout,
  adminKPIs, adminRevenue, adminOrdersTrend, orderStatuses,
  adminOrders, setOrderStatus,
  adminInventory, adjustAdminStock, updateAdminPrice, addAdminProduct, removeAdminProduct,
  adminCustomers, getAdminSettings, setAdminSetting, resetAdminData,
  adminLowStock, adminCategoryValue, adminStatusBreakdown, adminTopProducts,
  adminVerifications, updateVerificationStatus, adminTickets, setTicketStatus,
  formatNGN,
} from '/src/js/account.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const VIEW_LABELS = {
  overview: 'Overview',
  orders: 'Orders',
  inventory: 'Inventory',
  customers: 'Customers',
  analytics: 'Analytics',
  settings: 'Settings',
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

/* ── iOS Theme Appearance Toggle ───────────────────────────────── */
function initTheme() {
  const root = $('.dash');
  if (!root) return;
  const saved = localStorage.getItem('soko-admin-theme');
  if (saved === 'light' || saved === 'dark') {
    root.dataset.iosTheme = saved;
  }
  const updateIcons = () => {
    const isLight = root.dataset.iosTheme === 'light';
    $$('.js-theme-toggle').forEach((btn) => {
      btn.setAttribute('aria-label', isLight ? 'Switch to obsidian dark mode' : 'Switch to daylight mode');
      btn.innerHTML = `<i data-lucide="${isLight ? 'moon' : 'sun'}" class="icon-14"></i>`;
      hydrateIcons(btn);
    });
  };
  updateIcons();
  $$('.js-theme-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = root.dataset.iosTheme === 'light' ? 'dark' : 'light';
      root.dataset.iosTheme = next;
      localStorage.setItem('soko-admin-theme', next);
      updateIcons();
      toast(`Workshop console set to ${next} mode.`);
    });
  });
}

/* ── iOS Dynamic Island for Workshop Ops ───────────────────────── */
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
    setExpanded(island.dataset.expanded !== 'true');
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

  $('.js-quick-toggle-store')?.addEventListener('click', () => {
    const cur = getAdminSettings().ordersEnabled !== false;
    setAdminSetting('ordersEnabled', !cur);
    renderAll();
    toast(!cur ? 'Storefront checkout reopened.' : 'Storefront checkout paused.');
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

function syncChromeCounts() {
  const openOrders = adminOrders().filter((o) => o.status === 'paid' || o.status === 'processing').length;
  const lowStock = adminLowStock().length;
  const verifications = adminVerifications().filter((v) => v.status === 'booked').length;
  const openTickets = adminTickets().filter((t) => t.status !== 'resolved').length;
  const settings = getAdminSettings();
  const enabled = settings.ordersEnabled !== false;

  const openCount = $('.js-open-count');
  if (openCount) openCount.textContent = String(openOrders);

  const islandOpen = $('.js-island-open-num');
  if (islandOpen) islandOpen.textContent = String(openOrders);

  const lowCount = $('.js-low-stock-count');
  if (lowCount) {
    lowCount.textContent = String(lowStock);
    lowCount.hidden = lowStock <= 0;
  }

  const openChip = $('.js-open-chip');
  if (openChip) {
    openChip.innerHTML = `<i class="top-chip__dot" aria-hidden="true"></i> ${openOrders} open order${openOrders === 1 ? '' : 's'}`;
  }

  const storeState = $('.js-rail-store-state');
  const led = $('.rail-status__led');
  if (storeState) storeState.textContent = enabled ? 'Store open' : 'Store paused';
  if (led) led.classList.toggle('is-paused', !enabled);

  const toggleStoreLabel = $('.js-quick-toggle-store-label');
  if (toggleStoreLabel) toggleStoreLabel.textContent = enabled ? 'Pause checkout' : 'Reopen checkout';

  const activityEl = $('.js-island-activity');
  if (activityEl) {
    activityEl.innerHTML = `
      <div class="ios-live-card ios-live-card--admin">
        <div class="ios-live-card__metrics">
          <div><span>Open orders</span><strong>${openOrders}</strong></div>
          <div><span>Low stock</span><strong>${lowStock}</strong></div>
          <div><span>Bench checks</span><strong>${verifications}</strong></div>
          <div><span>Open tickets</span><strong>${openTickets}</strong></div>
        </div>
      </div>
    `;
  }
}

function init() {
  ensureSeeded();
  const guard = $('.js-not-admin-guard');
  const app = $('.js-app');
  if (!isAdmin()) {
    if (guard) guard.hidden = false;
    if (app) app.hidden = true;
    hydrateIcons();
    return;
  }
  if (guard) guard.hidden = true;
  if (app) app.hidden = false;

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

  document.addEventListener('click', (e) => {
    if (e.target.closest('.js-open-spotlight')) {
      e.preventDefault();
      openSpotlightModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openSpotlightModal();
    }
  });

  window.addEventListener('resize', () => requestAnimationFrame(syncDockPill));

  const initial = (location.hash || '#overview').slice(1);
  activateView(initial);

  $$('[data-logout]').forEach((b) => b.addEventListener('click', () => {
    logout();
    location.href = '/';
  }));

  startClock();
  renderAll();
}

function renderAll() {
  syncChromeCounts();
  renderOverview();
  renderOrders();
  renderInventory();
  renderCustomers();
  renderAnalytics();
  renderSettings();
  hydrateIcons();
  requestAnimationFrame(syncDockPill);
}

/* ── Overview ──────────────────────────────────────────────────── */
function renderOverview() {
  const k = adminKPIs();
  const kpiHost = $('.js-kpis');
  if (kpiHost) {
    kpiHost.innerHTML = `
      <div class="kpi">
        <div class="kpi__top"><span class="kpi__label">Revenue · YTD</span><span class="kpi__icon kpi__icon--orange"><i data-lucide="banknote" class="icon-16"></i></span></div>
        <div class="kpi__val">${formatNGN(k.revenue)}</div>
        <div class="kpi__delta"><i data-lucide="trending-up" class="icon-14"></i> +${k.revenueDelta}% vs prior period</div>
      </div>
      <div class="kpi">
        <div class="kpi__top"><span class="kpi__label">Orders</span><span class="kpi__icon kpi__icon--blue"><i data-lucide="clipboard-list" class="icon-16"></i></span></div>
        <div class="kpi__val">${k.orders}</div>
        <div class="kpi__delta"><i data-lucide="trending-up" class="icon-14"></i> +${k.ordersDelta}% vs prior period</div>
      </div>
      <div class="kpi">
        <div class="kpi__top"><span class="kpi__label">Average order</span><span class="kpi__icon kpi__icon--green"><i data-lucide="receipt-text" class="icon-16"></i></span></div>
        <div class="kpi__val">${formatNGN(k.aov)}</div>
        <div class="kpi__delta ${k.aovDelta < 0 ? 'is-down' : ''}">${k.aovDelta > 0 ? '+' : ''}${k.aovDelta}% · Mix includes spares</div>
      </div>
      <div class="kpi">
        <div class="kpi__top"><span class="kpi__label">Customers</span><span class="kpi__icon kpi__icon--pink"><i data-lucide="users" class="icon-16"></i></span></div>
        <div class="kpi__val">${k.customers}</div>
        <div class="kpi__delta">+${k.newCustomersLast30} in the last 30 days</div>
      </div>
    `;
  }

  const drawRevenue = (n) => {
    const data = adminRevenue(n);
    const months = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'].slice(-n);
    const max = Math.max(...data) * 1.15;
    const W = 620, H = 200, pad = 28;
    const stepX = (W - pad * 2) / Math.max(1, data.length - 1);
    const pts = data.map((v, i) => [pad + i * stepX, H - pad - ((v / max) * (H - pad * 2))]);
    const line = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    const area = `${line} L${pts[pts.length - 1][0]},${H - pad} L${pts[0][0]},${H - pad} Z`;
    const chartHost = $('.js-chart');
    if (!chartHost) return;
    chartHost.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Monthly revenue in millions of Naira">
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#ff6b35" stop-opacity=".42"/>
            <stop offset="100%" stop-color="#ff6b35" stop-opacity="0"/>
          </linearGradient>
        </defs>
        ${[0.25, 0.5, 0.75].map((r) => `<line x1="${pad}" x2="${W - pad}" y1="${(H - pad) - r * (H - pad * 2)}" y2="${(H - pad) - r * (H - pad * 2)}" stroke="currentColor" stroke-opacity=".08" stroke-dasharray="3 3"/>`).join('')}
        <path d="${area}" fill="url(#revGrad)"/>
        <path d="${line}" fill="none" stroke="#ff6b35" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"/>
        ${pts.map((p, i) => `
          <g>
            <circle cx="${p[0]}" cy="${p[1]}" r="4.5" fill="#ff6b35" stroke="#0d100e" stroke-width="2"/>
            <text x="${p[0]}" y="${p[1] - 10}" text-anchor="middle" font-size="10" font-family="JetBrains Mono,monospace" fill="currentColor" opacity=".88">₦${data[i]}M</text>
            <text x="${p[0]}" y="${H - 8}" text-anchor="middle" font-size="10" font-family="JetBrains Mono,monospace" fill="currentColor" opacity=".55">${months[i]}</text>
          </g>
        `).join('')}
      </svg>
    `;
  };
  const rangeSelect = $('.js-chart-range');
  drawRevenue(Number(rangeSelect?.value || 6));
  if (rangeSelect) rangeSelect.onchange = (e) => drawRevenue(Number(e.target.value));

  const low = adminLowStock();
  const openOrders = adminOrders().filter((o) => o.status === 'paid' || o.status === 'processing');
  const settings = getAdminSettings();
  const alerts = [];
  if (settings.ordersEnabled === false) {
    alerts.push({ tone: 'danger', icon: 'pause-circle', title: 'Storefront checkout is paused', sub: 'New customer orders are currently blocked in Settings.' });
  }
  if (openOrders.length) {
    alerts.push({ tone: 'warn', icon: 'package', title: `${openOrders.length} order${openOrders.length === 1 ? '' : 's'} waiting for hand-off`, sub: `${openOrders.map((o) => o.id).slice(0, 3).join(', ')} ready for bench or shipping update.` });
  }
  low.forEach((p) => {
    alerts.push({
      tone: p.stock === 0 ? 'danger' : 'warn',
      icon: 'alert-triangle',
      title: `${p.name} · ${p.stock === 0 ? 'Out of stock' : `Only ${p.stock} left`}`,
      sub: `${p.sku} · ${p.cat}`,
    });
  });
  const alertHost = $('.js-alerts');
  if (alertHost) {
    alertHost.innerHTML = alerts.length
      ? alerts.map((a) => `
        <div class="alert-row alert-row--${a.tone}">
          <span class="alert-row__icon"><i data-lucide="${a.icon}" class="icon-16"></i></span>
          <div>
            <b>${esc(a.title)}</b>
            <small>${esc(a.sub)}</small>
          </div>
        </div>
      `).join('')
      : `<div class="dash-empty">All stock levels and queues are clear.</div>`;
  }

  /* Render Guangzhou Bench Verification Bookings Queue */
  renderVerificationsQueue();

  /* Render Rider Support Tickets Queue */
  renderSupportTicketsQueue();

  const latestBody = $('.js-latest-orders tbody');
  if (latestBody) {
    latestBody.innerHTML = adminOrders().slice(0, 5).map((o) => `
      <tr>
        <td><b>${esc(o.id)}</b></td>
        <td>${esc(o.customer)}<div class="table-sub">${esc(o.email || 'Guest checkout')}</div></td>
        <td>${esc(o.items)}</td>
        <td><b>${formatNGN(o.total)}</b></td>
        <td><span class="status status--${esc(o.status)}">${esc(o.status)}</span></td>
        <td>${esc(o.date)}</td>
        <td class="align-right"><button class="btn btn--quiet btn--sm js-order-view" data-id="${esc(o.id)}" type="button">Details</button></td>
      </tr>
    `).join('');
    latestBody.querySelectorAll('.js-order-view').forEach((b) => b.addEventListener('click', () => showOrderDetailModal(b.dataset.id)));
  }
}

function renderVerificationsQueue() {
  const host = $('.js-admin-verifications');
  const countEl = $('.js-verify-count');
  const list = adminVerifications();
  const bookedCount = list.filter((v) => v.status === 'booked').length;
  if (countEl) countEl.textContent = `${bookedCount} booked`;
  if (!host) return;
  if (!list.length) {
    host.innerHTML = `<div class="dash-empty">No unit verification sessions booked yet.</div>`;
    return;
  }
  host.innerHTML = `
    <div class="ios-admin-queue">
      ${list.slice(0, 5).map((v) => `
        <div class="ios-queue-item">
          <div class="ios-queue-item__main">
            <div class="ios-queue-item__top">
              <b>${esc(v.model)}</b>
              <span class="status status--${v.status === 'booked' ? 'shipped' : v.status === 'completed' ? 'delivered' : 'cancelled'}">${esc(v.status)}</span>
            </div>
            <small>${esc(v.ref)} · ${esc(v.name)} (${esc(v.phone || v.email || 'No phone')}) · ${esc(v.date)} at ${esc(v.slot)} WAT</small>
          </div>
          <div class="ios-queue-item__actions">
            ${v.status === 'booked'
              ? `<button type="button" class="btn btn--primary btn--sm js-verify-complete" data-ref="${esc(v.ref)}">Sign off 40-pt</button>`
              : `<button type="button" class="btn btn--quiet btn--sm js-verify-reopen" data-ref="${esc(v.ref)}">Rebook</button>`}
          </div>
        </div>
      `).join('')}
    </div>
  `;
  host.querySelectorAll('.js-verify-complete').forEach((b) => b.addEventListener('click', () => {
    updateVerificationStatus(b.dataset.ref, 'completed');
    renderAll();
    toast(`Signed off 40-point bench check ${b.dataset.ref}.`);
  }));
  host.querySelectorAll('.js-verify-reopen').forEach((b) => b.addEventListener('click', () => {
    updateVerificationStatus(b.dataset.ref, 'booked');
    renderAll();
    toast(`Reopened bench check ${b.dataset.ref}.`);
  }));
}

function renderSupportTicketsQueue() {
  const host = $('.js-admin-tickets');
  const countEl = $('.js-ticket-count');
  const list = adminTickets();
  const openCount = list.filter((t) => t.status !== 'resolved').length;
  if (countEl) countEl.textContent = `${openCount} open`;
  if (!host) return;
  if (!list.length) {
    host.innerHTML = `<div class="dash-empty">No customer support tickets logged.</div>`;
    return;
  }
  host.innerHTML = `
    <div class="ios-admin-queue">
      ${list.slice(0, 5).map((t) => `
        <div class="ios-queue-item">
          <div class="ios-queue-item__main">
            <div class="ios-queue-item__top">
              <b>${esc(t.subject)}</b>
              <span class="status status--${t.status === 'resolved' ? 'delivered' : 'processing'}">${esc(t.status)}</span>
            </div>
            <small>${esc(t.type).toUpperCase()} · ${esc(t.customer)} (${esc(t.email)}) · ${esc(t.date)}</small>
            ${t.detail ? `<p class="ios-queue-item__detail">${esc(t.detail)}</p>` : ''}
          </div>
          <div class="ios-queue-item__actions">
            <button type="button" class="btn ${t.status === 'resolved' ? 'btn--quiet' : 'btn--primary'} btn--sm js-ticket-toggle" data-id="${esc(t.id)}" data-next="${t.status === 'resolved' ? 'open' : 'resolved'}">
              ${t.status === 'resolved' ? 'Reopen' : 'Resolve'}
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
  host.querySelectorAll('.js-ticket-toggle').forEach((b) => b.addEventListener('click', () => {
    setTicketStatus(b.dataset.id, b.dataset.next);
    renderAll();
    toast(`Support ticket marked ${b.dataset.next}.`);
  }));
}

/* ── Orders ────────────────────────────────────────────────────── */
let selectedOrders = new Set();

function renderOrders() {
  const filter = $('.js-order-status-filter');
  if (filter && !filter.options.length) {
    filter.innerHTML = orderStatuses.map((s) => `<option value="${s}">${s === 'all' ? 'All statuses' : s[0].toUpperCase() + s.slice(1)}</option>`).join('');
  }

  const syncSegments = () => {
    const cur = filter?.value || 'all';
    $$('.js-admin-order-segments [data-status-seg]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.statusSeg === cur);
    });
  };

  $$('.js-admin-order-segments [data-status-seg]').forEach((btn) => {
    btn.onclick = () => {
      if (filter) {
        filter.value = btn.dataset.statusSeg;
        filter.dispatchEvent(new Event('change'));
      }
    };
  });

  const draw = () => {
    syncSegments();
    const q = ($('.js-order-search')?.value || '').trim().toLowerCase();
    const st = filter?.value || 'all';
    const rows = adminOrders().filter((o) =>
      (st === 'all' || o.status === st) &&
      (!q || o.id.toLowerCase().includes(q) || o.customer.toLowerCase().includes(q) || (o.email || '').toLowerCase().includes(q))
    );
    const validIds = new Set(adminOrders().map((o) => o.id));
    selectedOrders = new Set([...selectedOrders].filter((id) => validIds.has(id)));

    const tbody = $('.js-admin-orders tbody');
    if (!tbody) return;
    tbody.innerHTML = rows.length
      ? rows.map((o) => `
        <tr>
          <td class="col-check"><input type="checkbox" class="row-check" data-id="${esc(o.id)}" aria-label="Select order ${esc(o.id)}" ${selectedOrders.has(o.id) ? 'checked' : ''} /></td>
          <td><b>${esc(o.id)}</b></td>
          <td>${esc(o.customer)}<div class="table-sub">${esc(o.email || 'Guest checkout')}</div></td>
          <td>${esc(o.items)}</td>
          <td><b>${formatNGN(o.total)}</b></td>
          <td>
            <label class="sr-only" for="st-${esc(o.id)}">Status for ${esc(o.id)}</label>
            <select id="st-${esc(o.id)}" class="select select--compact js-status-set" data-id="${esc(o.id)}">
              ${orderStatuses.slice(1).map((s) => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s[0].toUpperCase() + s.slice(1)}</option>`).join('')}
            </select>
          </td>
          <td>${esc(o.date)}</td>
          <td class="align-right"><button class="btn btn--quiet btn--sm js-order-view" data-id="${esc(o.id)}" type="button">Details</button></td>
        </tr>
      `).join('')
      : `<tr><td colspan="8" class="dash-empty">No orders match that filter.</td></tr>`;

    tbody.querySelectorAll('.js-status-set').forEach((sel) => sel.addEventListener('change', () => {
      setOrderStatus(sel.dataset.id, sel.value);
      syncChromeCounts();
      renderOverview();
      renderAnalytics();
      hydrateIcons();
      toast(`${sel.dataset.id} marked ${sel.value}.`);
    }));
    tbody.querySelectorAll('.js-order-view').forEach((b) => b.addEventListener('click', () => showOrderDetailModal(b.dataset.id)));
    tbody.querySelectorAll('.row-check').forEach((cb) => cb.addEventListener('change', () => {
      if (cb.checked) selectedOrders.add(cb.dataset.id);
      else selectedOrders.delete(cb.dataset.id);
      syncBulkBar(rows);
    }));
    syncBulkBar(rows);
  };

  const syncBulkBar = (visibleRows = []) => {
    const bar = $('.js-bulk-bar');
    const count = $('.js-bulk-count');
    const checkAll = $('.js-check-all');
    if (bar) bar.hidden = selectedOrders.size === 0;
    if (count) count.textContent = String(selectedOrders.size);
    if (checkAll) {
      checkAll.checked = visibleRows.length > 0 && visibleRows.every((r) => selectedOrders.has(r.id));
    }
  };

  const checkAll = $('.js-check-all');
  if (checkAll) {
    checkAll.onchange = (e) => {
      const boxes = $$('.js-admin-orders .row-check');
      boxes.forEach((cb) => {
        cb.checked = e.target.checked;
        if (cb.checked) selectedOrders.add(cb.dataset.id);
        else selectedOrders.delete(cb.dataset.id);
      });
      syncBulkBar(boxes.map((cb) => ({ id: cb.dataset.id })));
    };
  }

  const bulkUpdate = (status, label) => {
    const count = selectedOrders.size;
    if (!count) return;
    selectedOrders.forEach((id) => setOrderStatus(id, status));
    selectedOrders.clear();
    renderAll();
    toast(`${count} order${count === 1 ? '' : 's'} ${label}.`);
  };

  $('.js-bulk-cancel').onclick = () => bulkUpdate('cancelled', 'cancelled');
  $('.js-bulk-deliver').onclick = () => bulkUpdate('delivered', 'marked delivered');
  $('.js-bulk-clear').onclick = () => {
    selectedOrders.clear();
    draw();
  };

  $('.js-order-search').oninput = draw;
  if (filter) filter.onchange = draw;
  $('.js-order-export-go').onclick = () => {
    const mode = $('.js-order-export').value;
    if (mode === 'print') { window.print(); return; }
    let rows = adminOrders();
    if (mode === 'open') rows = rows.filter((o) => o.status === 'paid' || o.status === 'processing');
    if (mode === 'filtered') {
      const q = ($('.js-order-search').value || '').trim().toLowerCase();
      const st = filter.value;
      rows = rows.filter((o) => (st === 'all' || o.status === st) && (!q || o.id.toLowerCase().includes(q) || o.customer.toLowerCase().includes(q)));
    }
    exportOrdersCSV(rows, `soko-orders-${mode}.csv`);
  };
  draw();
}

function showOrderDetailModal(orderId) {
  const o = adminOrders().find((x) => x.id === orderId);
  if (!o) return;
  const lineItems = Array.isArray(o.lineItems) && o.lineItems.length ? o.lineItems : null;
  const m = openModal(`
    <p class="modal-eyebrow">ORDER RECORD · ${esc(o.id)}</p>
    <h3>${esc(o.customer)}</h3>
    <p class="modal-sub">${esc(o.email || 'Guest checkout')} · Placed ${esc(o.date)}</p>
    <div class="modal-kv-grid">
      <div><span>Status</span><strong class="status status--${esc(o.status)}">${esc(o.status)}</strong></div>
      <div><span>Items</span><strong>${esc(o.items)}</strong></div>
      <div><span>Total</span><strong>${formatNGN(o.total)}</strong></div>
      <div><span>Payment</span><strong>${esc(o.paymentMethod || 'Paystack')}</strong></div>
    </div>
    ${lineItems ? `
      <table class="dash-table" style="margin:12px 0">
        <thead><tr><th>Item</th><th>Qty</th><th class="align-right">Price</th></tr></thead>
        <tbody>${lineItems.map((it) => `<tr><td>${esc(it.name)}</td><td>${esc(it.qty || 1)}</td><td class="align-right">${formatNGN((it.price || 0) * (it.qty || 1))}</td></tr>`).join('')}</tbody>
      </table>
    ` : ''}
    <div class="field" style="margin-top:14px">
      <label for="modal-order-status">Update fulfilment status</label>
      <select id="modal-order-status" class="select js-modal-status">
        ${orderStatuses.slice(1).map((s) => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s[0].toUpperCase() + s.slice(1)}</option>`).join('')}
      </select>
    </div>
    <div class="dash-modal__actions">
      <button class="btn btn--quiet dash-modal__close" type="button">Close</button>
      <button class="btn btn--primary js-modal-status-save" type="button">Save status</button>
    </div>
  `);
  m.querySelector('.js-modal-status-save').addEventListener('click', () => {
    const next = m.querySelector('.js-modal-status').value;
    setOrderStatus(o.id, next);
    closeActiveModal();
    renderAll();
    toast(`${o.id} updated to ${next}.`);
  });
}

function exportOrdersCSV(rows = adminOrders(), filename = 'soko-orders.csv') {
  const header = 'id,customer,email,items,total,status,date\n';
  const body = rows.map((o) => [o.id, `"${String(o.customer || '').replace(/"/g, '""')}"`, o.email || '', o.items, o.total, o.status, o.date].join(',')).join('\n');
  const blob = new Blob([header + body], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(`Exported ${rows.length} orders.`);
}

/* ── Inventory ─────────────────────────────────────────────────── */
function renderInventory() {
  const all = adminInventory();
  const lowItems = adminLowStock();
  const totalValue = all.reduce((sum, p) => sum + (Number(p.price) || 0) * (Number(p.stock) || 0), 0);
  const totalEl = $('.js-inventory-total');
  const lowEl = $('.js-inventory-low-summary');
  if (totalEl) totalEl.textContent = formatNGN(totalValue);
  if (lowEl) lowEl.textContent = `${lowItems.length} ${lowItems.length === 1 ? 'item' : 'items'}`;

  const catFilter = $('.js-inv-category-filter');
  if (catFilter && catFilter.options.length <= 1) {
    const cats = [...new Set(all.map((p) => p.cat))];
    catFilter.innerHTML = `<option value="all">All categories</option>` + cats.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  }

  const draw = () => {
    const q = ($('.js-inv-search')?.value || '').trim().toLowerCase();
    const cat = catFilter?.value || 'all';
    const inv = adminInventory().filter((p) =>
      (cat === 'all' || p.cat === cat) &&
      (!q || p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q))
    );
    const tbody = $('.js-admin-inventory tbody');
    if (!tbody) return;
    tbody.innerHTML = inv.map((p) => `
      <tr>
        <td>
          <div class="inv-prod">
            <img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy" width="44" height="44" />
            <b>${esc(p.name)}</b>
          </div>
        </td>
        <td class="mono">${esc(p.sku)}</td>
        <td>${esc(p.cat)}</td>
        <td>
          <label class="sr-only" for="price-${esc(p.id)}">Price for ${esc(p.name)}</label>
          <input id="price-${esc(p.id)}" type="number" class="input input--compact js-price" data-id="${esc(p.id)}" value="${p.price}" step="5000" />
        </td>
        <td>
          <div class="stock-ctrl">
            <button type="button" class="js-stock-minus" data-id="${esc(p.id)}" aria-label="Decrease stock for ${esc(p.name)}">&minus;</button>
            <span class="stock-num js-stock-num" data-id="${esc(p.id)}">${p.stock}</span>
            <button type="button" class="js-stock-plus" data-id="${esc(p.id)}" aria-label="Increase stock for ${esc(p.name)}">+</button>
          </div>
        </td>
        <td><span class="status status--${p.status === 'in' ? 'delivered' : p.status === 'low' ? 'processing' : 'cancelled'}">${p.status === 'in' ? 'In stock' : p.status === 'low' ? 'Low stock' : 'Out'}</span></td>
        <td>${p.sold}</td>
        <td class="align-right"><button class="btn btn--danger btn--sm js-product-remove" data-id="${esc(p.id)}" type="button" aria-label="Remove ${esc(p.name)}">&times;</button></td>
      </tr>
    `).join('');

    const refreshInventoryMeta = () => {
      syncChromeCounts();
      renderOverview();
      renderAnalytics();
      const updated = adminInventory();
      const tVal = updated.reduce((s, p) => s + (Number(p.price) || 0) * (Number(p.stock) || 0), 0);
      if (totalEl) totalEl.textContent = formatNGN(tVal);
      if (lowEl) lowEl.textContent = `${adminLowStock().length} items`;
      hydrateIcons();
    };

    tbody.querySelectorAll('.js-stock-minus').forEach((b) => b.addEventListener('click', () => {
      adjustAdminStock(b.dataset.id, -1);
      draw();
      refreshInventoryMeta();
    }));
    tbody.querySelectorAll('.js-stock-plus').forEach((b) => b.addEventListener('click', () => {
      adjustAdminStock(b.dataset.id, +1);
      draw();
      refreshInventoryMeta();
    }));
    tbody.querySelectorAll('.js-price').forEach((inp) => inp.addEventListener('change', () => {
      updateAdminPrice(inp.dataset.id, inp.value);
      refreshInventoryMeta();
      toast('Price updated.');
    }));
    tbody.querySelectorAll('.js-product-remove').forEach((b) => b.addEventListener('click', () => {
      removeAdminProduct(b.dataset.id);
      draw();
      refreshInventoryMeta();
      toast('Product removed.');
    }));
  };

  $('.js-inv-search').oninput = draw;
  if (catFilter) catFilter.onchange = draw;
  draw();

  $('.js-product-add').onclick = () => {
    const m = openModal(`
      <p class="modal-eyebrow">NEW CATALOGUE ITEM</p>
      <h3>Add product to inventory</h3>
      <form class="js-product-form" novalidate>
        <div class="dash-view__grid dash-grid-form">
          <div class="field"><label for="p-name">Product name</label><input id="p-name" class="input js-p-name" placeholder="SOKO 05 · Express" required /></div>
          <div class="field"><label for="p-cat">Category</label><select id="p-cat" class="select js-p-cat"><option>Commuter</option><option>Cargo</option><option>Trail</option><option>Performance</option><option>Accessory</option></select></div>
          <div class="field"><label for="p-price">Price (₦)</label><input id="p-price" class="input js-p-price" type="number" value="950000" step="5000" required /></div>
          <div class="field"><label for="p-stock">Initial stock</label><input id="p-stock" class="input js-p-stock" type="number" value="10" min="0" required /></div>
          <div class="field"><label for="p-sku">SKU (optional)</label><input id="p-sku" class="input js-p-sku" placeholder="SM-005-EXP" /></div>
        </div>
        <div class="dash-modal__actions">
          <button class="btn btn--quiet dash-modal__close" type="button">Cancel</button>
          <button class="btn btn--primary js-p-save" type="submit">Add to inventory</button>
        </div>
      </form>
    `);
    m.querySelector('.js-product-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = m.querySelector('.js-p-name').value.trim();
      if (!name) { toast('Product name is required.'); return; }
      addAdminProduct({
        name,
        cat: m.querySelector('.js-p-cat').value,
        price: m.querySelector('.js-p-price').value,
        stock: m.querySelector('.js-p-stock').value,
        sku: m.querySelector('.js-p-sku').value.trim(),
      });
      closeActiveModal();
      renderAll();
      toast(`${name} added to inventory.`);
    });
  };
}

/* ── Customers ─────────────────────────────────────────────────── */
function renderCustomers() {
  const all = adminCustomers();
  const countEl = $('.js-customer-count');
  if (countEl) countEl.textContent = `${all.length} riders`;

  const draw = () => {
    const q = ($('.js-cust-search')?.value || '').trim().toLowerCase();
    const sort = $('.js-cust-sort')?.value || 'spend';
    const rows = adminCustomers()
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (c.city || '').toLowerCase().includes(q))
      .sort((a, b) => sort === 'orders' ? b.orders - a.orders : sort === 'recent' ? b.joined.localeCompare(a.joined) : b.spend - a.spend);

    const tbody = $('.js-admin-customers tbody');
    if (!tbody) return;
    tbody.innerHTML = rows.map((c) => `
      <tr>
        <td><b>${esc(c.name)}</b></td>
        <td>${esc(c.email)}</td>
        <td>${esc(c.city)}</td>
        <td>${esc(c.joined)}</td>
        <td>${esc(c.orders)}</td>
        <td><b>${formatNGN(c.spend)}</b></td>
        <td class="align-right">
          <button class="btn btn--quiet btn--sm js-customer-view" data-email="${esc(c.email)}" type="button">View</button>
          <a class="btn btn--quiet btn--sm" href="mailto:${esc(c.email)}">Email</a>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.js-customer-view').forEach((b) => b.addEventListener('click', () => {
      const cust = adminCustomers().find((x) => x.email === b.dataset.email);
      if (!cust) return;
      const custOrders = adminOrders().filter((o) => o.email === cust.email || o.customer === cust.name);
      openModal(`
        <p class="modal-eyebrow">RIDER PROFILE · ${esc(cust.city)}</p>
        <h3>${esc(cust.name)}</h3>
        <p class="modal-sub">${esc(cust.email)} · Joined ${esc(cust.joined)}</p>
        <div class="modal-kv-grid">
          <div><span>Orders</span><strong>${esc(cust.orders)}</strong></div>
          <div><span>Lifetime spend</span><strong>${formatNGN(cust.spend)}</strong></div>
          <div><span>City</span><strong>${esc(cust.city)}</strong></div>
        </div>
        ${custOrders.length ? `
          <table class="dash-table" style="margin-top:12px">
            <thead><tr><th>Order</th><th>Date</th><th>Status</th><th class="align-right">Total</th></tr></thead>
            <tbody>${custOrders.map((o) => `<tr><td><b>${esc(o.id)}</b></td><td>${esc(o.date)}</td><td><span class="status status--${esc(o.status)}">${esc(o.status)}</span></td><td class="align-right">${formatNGN(o.total)}</td></tr>`).join('')}</tbody>
          </table>
        ` : `<p class="modal-sub" style="margin-top:12px">No recent orders in the active ledger.</p>`}
        <div class="dash-modal__actions">
          <a class="btn btn--quiet btn--sm" href="mailto:${esc(cust.email)}">Send email</a>
          <button class="btn btn--primary btn--sm dash-modal__close" type="button">Done</button>
        </div>
      `);
    }));
  };
  $('.js-cust-search').oninput = draw;
  $('.js-cust-sort').onchange = draw;
  draw();
}

/* ── Analytics ─────────────────────────────────────────────────── */
function renderAnalytics() {
  const drawTrend = () => {
    const n = Number($('.js-trend-range')?.value || 12);
    const data = adminOrdersTrend().slice(-n);
    const host = $('.js-trend-chart');
    if (!host) return;
    host.innerHTML = data.map((d) => `
      <div class="bar-col">
        <div class="bar-val">${Math.round(d.v * 0.7)}</div>
        <div class="bar" style="height:${d.v}%"></div>
        <div class="bar-lbl">${esc(d.w)}</div>
      </div>
    `).join('');
  };
  drawTrend();
  const trendRange = $('.js-trend-range');
  if (trendRange) trendRange.onchange = drawTrend;

  const statusHost = $('.js-status-break');
  if (statusHost) {
    statusHost.innerHTML = adminStatusBreakdown().map((s) => `
      <div class="metric-bar-row">
        <div class="metric-bar-row__top">
          <span class="status status--${esc(s.status)}">${esc(s.status)}</span>
          <span><b>${s.count}</b> (${s.pct}%)</span>
        </div>
        <div class="metric-bar"><span style="width:${s.pct}%"></span></div>
      </div>
    `).join('');
  }

  const cats = adminCategoryValue();
  const maxCat = Math.max(1, ...cats.map((c) => c.value));
  const catHost = $('.js-cat-value');
  if (catHost) {
    catHost.innerHTML = cats.map((c) => `
      <div class="metric-bar-row">
        <div class="metric-bar-row__top">
          <b>${esc(c.name)}</b>
          <span>${formatNGN(c.value)}</span>
        </div>
        <div class="metric-bar metric-bar--ink"><span style="width:${Math.round((c.value / maxCat) * 100)}%"></span></div>
      </div>
    `).join('');
  }

  const topHost = $('.js-top-products');
  if (topHost) {
    topHost.innerHTML = `
      <div class="table-scroll">
        <table class="dash-table">
          <thead><tr><th>#</th><th>Product</th><th>Units (30d)</th><th class="align-right">Revenue</th></tr></thead>
          <tbody>
            ${adminTopProducts().map((p, i) => `
              <tr>
                <td><b>0${i + 1}</b></td>
                <td><b>${esc(p.name)}</b></td>
                <td>${p.sold}</td>
                <td class="align-right"><b>${formatNGN(p.value)}</b></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
}

/* ── iOS Spotlight Command Search Modal (⌘K) ───────────────────── */
function openSpotlightModal() {
  const m = openModal(`
    <p class="modal-eyebrow">WORKSHOP OS · COMMAND SPOTLIGHT</p>
    <h3>Quick jump &amp; search</h3>
    <div class="field" style="margin-top:10px">
      <label class="sr-only" for="admin-spotlight-input">Search views, orders, stock or riders</label>
      <input id="admin-spotlight-input" class="input js-spotlight-input" type="search" placeholder="Search order ID, rider name, SKU, or jump to a section..." autocomplete="off" />
    </div>
    <div class="ios-spotlight-results js-spotlight-results"></div>
  `);

  const input = m.querySelector('.js-spotlight-input');
  const results = m.querySelector('.js-spotlight-results');

  const renderHits = (q = '') => {
    const needle = q.trim().toLowerCase();
    const views = Object.entries(VIEW_LABELS)
      .filter(([k, label]) => !needle || label.toLowerCase().includes(needle) || k.includes(needle))
      .map(([k, label]) => ({ type: 'Console', title: label, sub: `Switch to ${label}`, action: () => { activateView(k, { focusHeading: true }); history.replaceState(null, '', '#' + k); } }));

    const orderHits = adminOrders()
      .filter((o) => !needle || o.id.toLowerCase().includes(needle) || o.customer.toLowerCase().includes(needle))
      .slice(0, 3)
      .map((o) => ({ type: 'Order', title: `${o.id} · ${o.customer}`, sub: `${o.status.toUpperCase()} · ${formatNGN(o.total)}`, action: () => showOrderDetailModal(o.id) }));

    const stockHits = adminInventory()
      .filter((p) => !needle || p.name.toLowerCase().includes(needle) || (p.sku || '').toLowerCase().includes(needle))
      .slice(0, 3)
      .map((p) => ({ type: 'Stock', title: `${p.name} (${p.sku})`, sub: `${p.stock} in stock · ${formatNGN(p.price)}`, action: () => { activateView('inventory', { focusHeading: true }); history.replaceState(null, '', '#inventory'); } }));

    const combined = [...views, ...orderHits, ...stockHits].slice(0, 8);
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

/* ── Settings ──────────────────────────────────────────────────── */
function renderSettings() {
  const s = getAdminSettings();
  const gw = $('.js-set-gateway');
  const cur = $('.js-set-currency');
  const low = $('.js-set-low');
  const tax = $('.js-set-tax');
  const en = $('.js-set-enable');
  const lbl = $('.js-enable-label');

  if (gw) gw.value = s.gateway || 'Paystack';
  if (cur) cur.value = s.currency || '₦';
  if (low) low.value = s.lowStockThreshold ?? 6;
  if (tax) tax.value = s.taxRate ?? 7.5;
  if (en) en.checked = s.ordersEnabled !== false;
  if (lbl) lbl.textContent = en?.checked ? 'Accept new orders on the storefront' : 'Storefront checkout is paused';
  if (en) {
    en.onchange = () => {
      if (lbl) lbl.textContent = en.checked ? 'Accept new orders on the storefront' : 'Storefront checkout is paused';
    };
  }

  const saveSettings = (e) => {
    e?.preventDefault();
    setAdminSetting('gateway', gw.value);
    setAdminSetting('currency', cur.value);
    setAdminSetting('lowStockThreshold', Number(low.value || 6));
    setAdminSetting('taxRate', Number(tax.value ?? 7.5));
    setAdminSetting('ordersEnabled', en.checked);
    renderAll();
    toast('Store settings saved.');
  };

  const form = $('.js-admin-settings');
  if (form) form.onsubmit = saveSettings;
  const saveBtn = $('.js-settings-save');
  if (saveBtn) saveBtn.onclick = saveSettings;

  $('.js-csv-download').onclick = () => exportOrdersCSV();

  $('.js-admin-reset').onclick = () => {
    const m = openModal(`
      <p class="modal-eyebrow">RESET DEMO STORE</p>
      <h3>Restore seeded demo data?</h3>
      <p class="modal-sub">This resets orders, stock counts, customers and settings in this browser back to the original workshop defaults.</p>
      <div class="dash-modal__actions">
        <button class="btn btn--quiet dash-modal__close" type="button">Cancel</button>
        <button class="btn btn--danger js-confirm-reset" type="button">Reset demo data</button>
      </div>
    `);
    m.querySelector('.js-confirm-reset').addEventListener('click', () => {
      resetAdminData();
      selectedOrders.clear();
      closeActiveModal();
      renderAll();
      toast('Demo data restored.');
    });
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
