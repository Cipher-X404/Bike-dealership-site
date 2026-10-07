/*
 * SOKO Moto — Workshop Control
 * A locally-persisted operations desk for the seeded prototype data.
 */
import {
  currentUser, logout, money, ensureSeeded,
  adminKPIs, adminRevenue, adminOrdersTrend, orderStatuses,
  adminOrders, setOrderStatus,
  adminInventory, adjustAdminStock, updateAdminPrice, addAdminProduct, removeAdminProduct,
  adminCustomers, adminLowStock, adminCategoryValue, adminStatusBreakdown, adminTopProducts,
  getAdminSettings, setAdminSetting, resetAdminData,
} from '/src/js/account.js';
import { hydrateIcons } from '/src/js/icons.js';
import { hydrateCartBadge } from '/src/js/badge.js';

ensureSeeded();
const user = currentUser();
const isAdminUser = !!user && (user.role === 'admin' || user.isAdmin);
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const esc = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const STATUSES = orderStatuses.filter((status) => status !== 'all');
const VIEW_NAMES = {
  overview: 'Overview', orders: 'Orders', inventory: 'Inventory',
  customers: 'Customers', analytics: 'Analytics', settings: 'Settings',
};
const validView = (name) => Object.prototype.hasOwnProperty.call(VIEW_NAMES, name);

let toastTimer;
function toast(message) {
  const target = $('.js-toast');
  if (!target) return;
  target.textContent = message;
  target.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => target.classList.remove('show'), 2600);
}

let activeModal;
let modalReturnFocus;
function closeModal() {
  if (!activeModal) return;
  activeModal.remove();
  activeModal = null;
  if (modalReturnFocus?.isConnected) modalReturnFocus.focus({ preventScroll: true });
  modalReturnFocus = null;
}
function openModal(content, { label = 'Dialog' } = {}) {
  closeModal();
  modalReturnFocus = document.activeElement;
  const overlay = document.createElement('div');
  overlay.className = 'dash-modal';
  overlay.setAttribute('role', 'presentation');
  overlay.innerHTML = `<div class="dash-modal__card" role="dialog" aria-modal="true" aria-label="${esc(label)}" tabindex="-1">${content}</div>`;
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeModal();
  });
  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = $$('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])', overlay);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  });
  document.body.appendChild(overlay);
  activeModal = overlay;
  hydrateIcons(overlay);
  requestAnimationFrame(() => $('.dash-modal__card', overlay)?.focus({ preventScroll: true }));
  return overlay;
}
function confirmAction({ title, body, confirmText = 'Confirm', danger = false, onConfirm }) {
  const modal = openModal(`
    <div class="dash-modal__head"><h3>${esc(title)}</h3><button class="dash-modal__close" type="button" aria-label="Close dialog"><i data-lucide="x" class="icon-18"></i></button></div>
    <p class="muted">${esc(body)}</p>
    <div class="card-actions" style="margin-top:1.2rem">
      <button class="btn ${danger ? 'btn--danger' : 'btn--primary'} js-modal-confirm" type="button">${esc(confirmText)}</button>
      <button class="btn btn--quiet js-modal-cancel" type="button">Keep it</button>
    </div>`, { label: title });
  $('.dash-modal__close', modal).addEventListener('click', closeModal);
  $('.js-modal-cancel', modal).addEventListener('click', closeModal);
  $('.js-modal-confirm', modal).addEventListener('click', () => {
    closeModal();
    onConfirm?.();
  });
  return modal;
}

/* ── Session gates ─────────────────────────────────────────────── */
if (!user) {
  $('.js-guest-guard').hidden = false;
} else if (!isAdminUser) {
  $('.js-not-admin-guard').hidden = false;
} else {
  $('.js-app').hidden = false;
  const initials = String(user.name || 'Staff').split(/\s+/).map((word) => word[0]).slice(0, 2).join('').toUpperCase();
  $('.js-user-initial').textContent = initials;
  $('.js-user-name').textContent = user.name || 'Staff';
  $('.js-user-email').textContent = user.email || '';

  const tickClock = () => {
    const clock = $('.js-dash-clock');
    if (clock) clock.textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' });
  };
  tickClock();
  setInterval(tickClock, 30000);

  /* ── Navigation: the URL hash is the source of truth ─────────── */
  function showView(name, { focus = false } = {}) {
    if (!validView(name)) name = 'overview';
    $$('.js-view').forEach((panel) => { panel.hidden = panel.dataset.viewPanel !== name; });
    $$('.dash-nav [data-view]').forEach((link) => {
      const active = link.dataset.view === name;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    $('.js-view-title').textContent = VIEW_NAMES[name];
    $('.js-view-path').textContent = name.toUpperCase();
    if (focus) $('.js-view-title').focus({ preventScroll: true });
    if (window.lenis) window.lenis.scrollTo(0, { immediate: true });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function navigate(name, { replace = false, focus = false } = {}) {
    if (!validView(name)) return;
    const nextHash = `#${name}`;
    if (window.location.hash !== nextHash) {
      window.history[replace ? 'replaceState' : 'pushState']({ view: name }, '', nextHash);
    }
    showView(name, { focus });
  }
  document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-view], [data-goto]');
    if (!link) return;
    const destination = link.dataset.view || link.dataset.goto;
    if (!validView(destination)) return;
    event.preventDefault();
    navigate(destination, { focus: true });
  });
  const syncViewFromLocation = () => showView((window.location.hash || '#overview').slice(1));
  window.addEventListener('popstate', syncViewFromLocation);
  window.addEventListener('hashchange', syncViewFromLocation);
  navigate(validView((window.location.hash || '#overview').slice(1)) ? (window.location.hash || '#overview').slice(1) : 'overview', { replace: true });

  /* ── Formatting + shared data helpers ───────────────────────── */
  const cap = (value = '') => value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
  const cleanStatus = (status) => STATUSES.includes(status) ? status : 'paid';
  const statusPill = (status) => `<span class="pill ${cleanStatus(status)}">${esc(cap(cleanStatus(status)))}</span>`;
  const customerName = (order) => order.customer || 'Guest';
  const itemCount = (order) => Array.isArray(order.items)
    ? order.items.reduce((total, item) => total + Math.max(1, Number(item.qty) || 1), 0)
    : Math.max(0, Number(order.items) || 0);
  const formatDate = (value) => {
    if (!value) return '—';
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? esc(value) : new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  };
  const stockState = (stock) => {
    const level = Number(getAdminSettings().lowStockThreshold ?? 6);
    if (Number(stock) <= 0) return { key: 'out', label: 'Out' };
    if (Number(stock) <= level) return { key: 'low', label: 'Low' };
    return { key: 'in', label: 'In stock' };
  };
  const visibleOrders = () => {
    const query = ($('.js-order-search')?.value || '').trim().toLowerCase();
    const status = $('.js-order-status-filter')?.value || 'all';
    return adminOrders().filter((order) => {
      const text = `${order.id || ''} ${order.ref || ''} ${order.email || ''} ${customerName(order)}`.toLowerCase();
      return (!query || text.includes(query)) && (status === 'all' || order.status === status);
    });
  };
  const exportOrderRows = (orders) => orders.map((order) => ({
    Order: order.id || '',
    Reference: order.ref || '',
    Customer: customerName(order),
    Email: order.email || '',
    Date: order.date || '',
    Status: order.status || '',
    'Total NGN': Number(order.total) || 0,
    Items: itemCount(order),
  }));

  /* ── Revenue chart ──────────────────────────────────────────── */
  function monthLabels(count) {
    const labels = [];
    const now = new Date();
    for (let offset = count - 1; offset >= 0; offset -= 1) {
      labels.push(new Intl.DateTimeFormat('en', { month: 'short' }).format(new Date(now.getFullYear(), now.getMonth() - offset, 1)));
    }
    return labels;
  }
  function revenueSVG(values) {
    if (!values.length) return '<p class="chart-empty">No revenue points for this period.</p>';
    const width = 680;
    const height = 226;
    const left = 58;
    const right = 14;
    const top = 16;
    const bottom = 18;
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const span = maximum - minimum || 1;
    const x = (index) => left + index * ((width - left - right) / Math.max(1, values.length - 1));
    const y = (value) => top + ((maximum - value) / span) * (height - top - bottom);
    const points = values.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ');
    const grid = [0, 0.5, 1].map((fraction) => {
      const gy = top + fraction * (height - top - bottom);
      const label = (maximum - fraction * span).toFixed(1);
      return `<g><line x1="${left}" y1="${gy}" x2="${width - right}" y2="${gy}" class="gridline" /><text x="2" y="${gy + 4}" class="axis">₦${label}m</text></g>`;
    }).join('');
    return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Monthly revenue in millions of naira">
      ${grid}
      <polygon points="${left},${height - bottom} ${points} ${width - right},${height - bottom}" class="area" />
      <polyline points="${points}" class="line" />
      ${values.map((value, index) => `<circle cx="${x(index)}" cy="${y(value)}" r="3.5" class="dot"><title>${esc(monthLabels(values.length)[index])}: ₦${(value * 1000000).toLocaleString('en-NG')}</title></circle>`).join('')}
    </svg>`;
  }

  /* ── Top-level state badges ─────────────────────────────────── */
  function syncOperationalBadges() {
    const orders = adminOrders();
    const openCount = orders.filter((order) => ['paid', 'processing'].includes(order.status)).length;
    $$('.js-open-count').forEach((badge) => { badge.textContent = String(openCount); });
    const openChip = $('.js-open-chip');
    if (openChip) {
      openChip.hidden = openCount === 0;
      openChip.setAttribute('aria-label', `${openCount} orders to move`);
    }
    const lowCount = adminLowStock().length;
    const lowBadge = $('.js-low-stock-count');
    if (lowBadge) {
      lowBadge.textContent = String(lowCount);
      lowBadge.hidden = lowCount === 0;
    }
    const isOpen = getAdminSettings().ordersEnabled !== false;
    const stateLabel = $('.js-rail-store-state');
    if (stateLabel) stateLabel.textContent = isOpen ? 'Store open' : 'Store paused';
    $('.rail-status')?.classList.toggle('is-paused', !isOpen);
    const enabledLabel = $('.js-enable-label');
    if (enabledLabel) enabledLabel.textContent = isOpen ? 'Enabled' : 'Paused';
  }

  /* ── Overview ───────────────────────────────────────────────── */
  function renderAlerts() {
    const alerts = [];
    const low = adminLowStock();
    low.slice(0, 3).forEach((product) => {
      const state = stockState(product.stock);
      alerts.push({
        title: `${state.key === 'out' ? 'Out of stock' : 'Low stock'} · ${product.name}`,
        body: `${product.stock} ${product.stock === 1 ? 'unit' : 'units'} on hand. Review this shelf item.`,
        tone: 'warn', destination: 'inventory', icon: 'boxes',
      });
    });
    const open = adminOrders().filter((order) => ['paid', 'processing'].includes(order.status));
    if (open.length) alerts.push({
      title: `${open.length} order${open.length === 1 ? '' : 's'} need a hand-off`,
      body: 'Open demo orders are waiting for fulfilment updates.',
      tone: 'info', destination: 'orders', icon: 'package-check',
    });
    if (getAdminSettings().ordersEnabled === false) alerts.unshift({
      title: 'Checkout is paused', body: 'The storefront will not accept new orders until it is reopened.',
      tone: 'warn', destination: 'settings', icon: 'store',
    });
    const container = $('.js-alerts');
    container.innerHTML = alerts.length ? alerts.map((alert) => `
      <a class="notif notif--action" href="#${alert.destination}" data-goto="${alert.destination}">
        <span class="notif__dot ${alert.tone}"></span>
        <i class="notif__icon" data-lucide="${alert.icon}" aria-hidden="true"></i>
        <span class="notif__body"><b>${esc(alert.title)}</b><small>${esc(alert.body)}</small></span>
        <i data-lucide="arrow-up-right" class="icon-14 notif__arrow" aria-hidden="true"></i>
      </a>`).join('') : `
      <div class="notif notif--quiet"><span class="notif__dot ok"></span><span class="notif__body"><b>Floor is clear</b><small>No low-stock items or open orders need attention.</small></span></div>`;
    hydrateIcons(container);
  }
  function renderOverview() {
    const kpi = adminKPIs();
    const cards = [
      { label: 'Revenue · YTD', value: money(kpi.revenue), delta: `${kpi.revenueDelta >= 0 ? '+' : ''}${kpi.revenueDelta}% vs last year`, tone: kpi.revenueDelta >= 0 ? 'up' : 'down', icon: 'banknote' },
      { label: 'Orders', value: Number(kpi.orders).toLocaleString('en-NG'), delta: `${kpi.ordersDelta >= 0 ? '+' : ''}${kpi.ordersDelta}% vs last month`, tone: kpi.ordersDelta >= 0 ? 'up' : 'down', icon: 'package' },
      { label: 'Average order', value: money(kpi.aov), delta: `${kpi.aovDelta >= 0 ? '+' : ''}${kpi.aovDelta}% vs last month`, tone: kpi.aovDelta >= 0 ? 'up' : 'down', icon: 'trending-up' },
      { label: 'Customers', value: Number(kpi.customers).toLocaleString('en-NG'), delta: `${Number(kpi.newCustomersLast30).toLocaleString('en-NG')} new in 30 days`, tone: 'up', icon: 'users-round' },
    ];
    $('.js-kpis').innerHTML = cards.map((card) => `
      <article class="kpi"><span class="kpi__label"><i data-lucide="${card.icon}" class="icon-16" aria-hidden="true"></i>${esc(card.label)}</span>
        <b class="kpi__value">${esc(card.value)}</b><span class="kpi__delta ${card.tone}">${esc(card.delta)}</span></article>`).join('');

    const count = Number($('.js-chart-range')?.value) || 6;
    const revenue = adminRevenue(count);
    $('.js-chart').innerHTML = revenueSVG(revenue);
    $('.js-chart-months').innerHTML = monthLabels(revenue.length).map((month) => `<span>${esc(month)}</span>`).join('');
    const trend = $('.js-revenue-delta');
    if (trend) trend.textContent = `${kpi.revenueDelta >= 0 ? '+' : ''}${kpi.revenueDelta}%`;
    const trendIcon = $('.revenue-meta__trend');
    trendIcon?.classList.toggle('is-down', kpi.revenueDelta < 0);
    const revenueValue = $('.revenue-meta__value');
    if (revenueValue) revenueValue.textContent = `₦${(Number(kpi.revenue) / 1000000).toFixed(1)}m`;

    const latest = adminOrders().slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 5);
    $('.js-latest-orders tbody').innerHTML = latest.length ? latest.map((order) => `
      <tr><td><b>${esc(order.id || order.ref || 'Order')}</b></td><td>${esc(customerName(order))}</td>
        <td style="white-space:nowrap">${formatDate(order.date)}</td><td>${statusPill(order.status)}</td>
        <td class="align-right"><b>${money(order.total)}</b></td>
        <td class="align-right"><button class="chip-btn js-order-view" data-id="${esc(order.id)}" type="button" aria-label="View order ${esc(order.id)}"><i data-lucide="arrow-up-right" class="icon-14" aria-hidden="true"></i></button></td></tr>`).join('')
      : '<tr><td colspan="6" class="muted">No orders yet.</td></tr>';
    renderAlerts();
    syncOperationalBadges();
    hydrateIcons($('.js-kpis'));
    hydrateIcons($('.js-latest-orders'));
  }

  /* ── Orders desk: filters, bulk actions, detail and exports ──── */
  let selectedOrders = new Set();
  function syncBulkBar() {
    const bar = $('.js-bulk-bar');
    const count = selectedOrders.size;
    bar.hidden = count === 0;
    $('.js-bulk-count').textContent = `${count} selected`;
    const visible = visibleOrders();
    const selectedVisible = visible.filter((order) => selectedOrders.has(order.id)).length;
    const selectAll = $('.js-check-all');
    selectAll.checked = visible.length > 0 && selectedVisible === visible.length;
    selectAll.indeterminate = selectedVisible > 0 && selectedVisible < visible.length;
  }
  function renderAdminOrders() {
    const all = adminOrders();
    const rows = visibleOrders();
    const tbody = $('.js-admin-orders tbody');
    tbody.innerHTML = rows.length ? rows.map((order) => `
      <tr class="${selectedOrders.has(order.id) ? 'is-selected' : ''}">
        <td><input type="checkbox" class="row-check" data-id="${esc(order.id)}" aria-label="Select ${esc(order.id)}" ${selectedOrders.has(order.id) ? 'checked' : ''} /></td>
        <td><b>${esc(order.id || '—')}</b><small class="table-subline">${esc(order.ref || order.email || '')}</small></td>
        <td>${esc(customerName(order))}</td><td>${itemCount(order)}</td><td style="white-space:nowrap">${formatDate(order.date)}</td>
        <td><select class="select select--sm js-status-set" data-id="${esc(order.id)}" aria-label="Status for ${esc(order.id)}">${STATUSES.map((status) => `<option value="${status}" ${status === order.status ? 'selected' : ''}>${esc(cap(status))}</option>`).join('')}</select></td>
        <td class="align-right"><b>${money(order.total)}</b></td>
        <td class="align-right"><button class="chip-btn js-order-view" data-id="${esc(order.id)}" type="button" aria-label="View order ${esc(order.id)}"><i data-lucide="eye" class="icon-16" aria-hidden="true"></i></button></td>
      </tr>`).join('') : '<tr><td colspan="8" class="muted">No orders match these filters.</td></tr>';
    $('.js-admin-order-total').textContent = `${all.length} order${all.length === 1 ? '' : 's'}`;
    $('.js-order-results').textContent = `Showing ${rows.length} of ${all.length} order${all.length === 1 ? '' : 's'}`;
    syncBulkBar();
    hydrateIcons(tbody);
  }
  function openOrderDetails(orderId) {
    const order = adminOrders().find((item) => item.id === orderId);
    if (!order) return;
    const email = order.email ? `<a class="text-link" href="mailto:${esc(order.email)}">${esc(order.email)}</a>` : 'No email on file';
    const shipping = order.address ? [order.address.line1, order.address.city, order.address.state].filter(Boolean).join(', ') : '';
    const payment = order.paymentMethod === 'pod' ? 'Pay on delivery' : [order.paymentMethod, order.paymentGateway].filter(Boolean).join(' · ');
    const modal = openModal(`
      <div class="dash-modal__head"><div><p class="panel__eyebrow">Fulfilment record</p><h3>${esc(order.id || order.ref || 'Order')}</h3></div><button class="dash-modal__close" type="button" aria-label="Close dialog"><i data-lucide="x" class="icon-18"></i></button></div>
      <dl class="detail-list">
        <div class="detail-row"><dt>Rider</dt><dd>${esc(customerName(order))}</dd></div>
        <div class="detail-row"><dt>Contact</dt><dd>${email}</dd></div>
        <div class="detail-row"><dt>Placed</dt><dd>${formatDate(order.date)}</dd></div>
        <div class="detail-row"><dt>Items</dt><dd>${itemCount(order)}</dd></div>
        <div class="detail-row"><dt>Status</dt><dd>${statusPill(order.status)}</dd></div>
        ${payment ? `<div class="detail-row"><dt>Payment</dt><dd>${esc(payment)} · simulated · no charge</dd></div>` : ''}
        ${shipping ? `<div class="detail-row"><dt>Deliver to</dt><dd>${esc(shipping)}</dd></div>` : ''}
        <div class="detail-row"><dt>Order total</dt><dd>${money(order.total)}</dd></div>
      </dl>
      <div class="order-status-actions"><span class="field-label">Move to</span><div class="card-actions">${STATUSES.map((status) => `<button class="chip-btn js-order-set" data-id="${esc(order.id)}" data-status="${status}" type="button" ${status === order.status ? 'aria-pressed="true" disabled' : ''}>${esc(cap(status))}</button>`).join('')}</div></div>`, { label: `Order ${order.id || ''}` });
    $('.dash-modal__close', modal).addEventListener('click', closeModal);
    $$('.js-order-set', modal).forEach((button) => button.addEventListener('click', () => {
      setOrderStatus(button.dataset.id, button.dataset.status);
      closeModal();
      renderAdminOrders(); renderOverview(); renderAnalytics();
      toast(`Order ${button.dataset.id} moved to ${button.dataset.status}.`);
    }));
  }
  $('.js-order-search').addEventListener('input', renderAdminOrders);
  $('.js-order-status-filter').addEventListener('change', renderAdminOrders);
  $('.js-admin-orders tbody').addEventListener('change', (event) => {
    const checkbox = event.target.closest('.row-check');
    if (checkbox) {
      if (checkbox.checked) selectedOrders.add(checkbox.dataset.id);
      else selectedOrders.delete(checkbox.dataset.id);
      renderAdminOrders();
      return;
    }
    const statusSelect = event.target.closest('.js-status-set');
    if (statusSelect) {
      setOrderStatus(statusSelect.dataset.id, statusSelect.value);
      toast(`${statusSelect.dataset.id} moved to ${statusSelect.value}.`);
      renderAdminOrders(); renderOverview(); renderAnalytics();
    }
  });
  $('.js-admin-orders tbody').addEventListener('click', (event) => {
    const viewButton = event.target.closest('.js-order-view');
    if (viewButton) openOrderDetails(viewButton.dataset.id);
  });
  $('.js-latest-orders tbody').addEventListener('click', (event) => {
    const viewButton = event.target.closest('.js-order-view');
    if (viewButton) openOrderDetails(viewButton.dataset.id);
  });
  $('.js-check-all').addEventListener('change', (event) => {
    visibleOrders().forEach((order) => {
      if (event.target.checked) selectedOrders.add(order.id);
      else selectedOrders.delete(order.id);
    });
    renderAdminOrders();
  });
  $('.js-bulk-clear').addEventListener('click', () => {
    selectedOrders.clear();
    renderAdminOrders();
  });
  function applyBulkStatus(status) {
    const picked = adminOrders().filter((order) => selectedOrders.has(order.id));
    if (!picked.length) return;
    const eligible = picked.filter((order) => {
      if (status === 'cancelled') return !['cancelled', 'delivered'].includes(order.status);
      if (status === 'delivered') return !['cancelled', 'delivered'].includes(order.status);
      return true;
    });
    eligible.forEach((order) => setOrderStatus(order.id, status));
    const skipped = picked.length - eligible.length;
    selectedOrders.clear();
    renderAdminOrders(); renderOverview(); renderAnalytics();
    toast(`${eligible.length} order${eligible.length === 1 ? '' : 's'} updated${skipped ? ` · ${skipped} already closed` : ''}.`);
  }
  $('.js-bulk-cancel').addEventListener('click', () => applyBulkStatus('cancelled'));
  $('.js-bulk-deliver').addEventListener('click', () => applyBulkStatus('delivered'));
  $('.js-order-export-go').addEventListener('click', () => {
    const mode = $('.js-order-export').value;
    if (mode === 'print') {
      window.print();
      return;
    }
    const rows = mode === 'csv-open'
      ? adminOrders().filter((order) => ['paid', 'processing'].includes(order.status))
      : mode === 'csv-visible' ? visibleOrders() : adminOrders();
    if (downloadCSV('soko-orders.csv', exportOrderRows(rows))) toast(`${rows.length} order${rows.length === 1 ? '' : 's'} exported.`);
  });

  /* ── Inventory desk ────────────────────────────────────────── */
  function renderInventory() {
    const inventory = adminInventory();
    const query = ($('.js-inv-search').value || '').trim().toLowerCase();
    const category = $('.js-inv-category-filter').value || 'all';
    const rows = inventory.filter((product) => {
      const matchesQuery = !query || `${product.name} ${product.sku || ''} ${product.cat || ''}`.toLowerCase().includes(query);
      const matchesCategory = category === 'all' || product.cat === category;
      return matchesQuery && matchesCategory;
    });
    $('.js-inventory-total').textContent = `${inventory.length} product${inventory.length === 1 ? '' : 's'}`;
    $('.js-inventory-low-summary').textContent = `${adminLowStock().length} product${adminLowStock().length === 1 ? '' : 's'}`;
    $('.js-inv-note').textContent = rows.length
      ? `Showing ${rows.length} of ${inventory.length} product${inventory.length === 1 ? '' : 's'} · price and stock changes save instantly.`
      : `No catalogue items match “${query || category}”.`;
    $('.js-admin-inventory tbody').innerHTML = rows.length ? rows.map((product) => {
      const stock = stockState(product.stock);
      const image = product.img || '/images/accessory-helmet.webp';
      return `<tr>
        <td><div class="prod-cell"><img src="${esc(image)}" alt="" loading="lazy" /><div><b>${esc(product.name)}</b><small>${esc(product.cat || 'Accessory')} · ${esc(product.sku || 'No SKU')}</small></div></div></td>
        <td><label class="sr-only" for="price-${esc(product.id)}">Price for ${esc(product.name)}</label><input id="price-${esc(product.id)}" class="mini-input js-price" type="number" inputmode="numeric" min="0" step="100" data-id="${esc(product.id)}" value="${Number(product.price) || 0}" /></td>
        <td><div class="stock-stepper"><button class="js-stock-minus" data-id="${esc(product.id)}" type="button" aria-label="Decrease ${esc(product.name)} stock"><i data-lucide="minus" class="icon-14"></i></button><span class="js-stock-num" data-id="${esc(product.id)}">${Number(product.stock) || 0}</span><button class="js-stock-plus" data-id="${esc(product.id)}" type="button" aria-label="Increase ${esc(product.name)} stock"><i data-lucide="plus" class="icon-14"></i></button></div></td>
        <td><span class="pill ${stock.key}">${stock.label}</span></td><td>${Number(product.sold) || 0}</td>
        <td class="align-right"><button class="chip-btn js-product-remove" data-id="${esc(product.id)}" type="button" aria-label="Remove ${esc(product.name)}"><i data-lucide="trash-2" class="icon-14"></i><span>Remove</span></button></td>
      </tr>`;
    }).join('') : '<tr><td colspan="6" class="muted">No products match these filters.</td></tr>';
    hydrateIcons($('.js-admin-inventory'));
    syncOperationalBadges();
  }
  $('.js-inv-search').addEventListener('input', renderInventory);
  $('.js-inv-category-filter').addEventListener('change', renderInventory);
  $('.js-admin-inventory tbody').addEventListener('click', (event) => {
    const plus = event.target.closest('.js-stock-plus');
    const minus = event.target.closest('.js-stock-minus');
    if (plus || minus) {
      adjustAdminStock((plus || minus).dataset.id, plus ? 1 : -1);
      renderInventory(); renderOverview(); renderAnalytics();
      return;
    }
    const remove = event.target.closest('.js-product-remove');
    if (remove) {
      const product = adminInventory().find((item) => item.id === remove.dataset.id);
      if (!product) return;
      confirmAction({
        title: 'Remove this product?',
        body: `${product.name} will be removed from the local inventory and analytics. This cannot be undone except by resetting demo data.`,
        confirmText: 'Remove product', danger: true,
        onConfirm: () => {
          removeAdminProduct(product.id);
          renderInventory(); renderOverview(); renderAnalytics();
          toast(`${product.name} removed from the catalogue.`);
        },
      });
    }
  });
  $('.js-admin-inventory tbody').addEventListener('change', (event) => {
    const priceInput = event.target.closest('.js-price');
    if (!priceInput) return;
    const nextPrice = Number(priceInput.value);
    const product = adminInventory().find((item) => item.id === priceInput.dataset.id);
    if (!product) return;
    if (!Number.isFinite(nextPrice) || nextPrice < 0 || priceInput.value.trim() === '') {
      priceInput.value = String(product.price);
      toast('Enter a valid price of ₦0 or more.');
      return;
    }
    updateAdminPrice(product.id, nextPrice);
    toast(`${product.name} price updated.`);
    renderAnalytics();
  });
  $('.js-product-add').addEventListener('click', () => {
    const modal = openModal(`
      <div class="dash-modal__head"><div><p class="panel__eyebrow">Add to the range</p><h3>New product</h3></div><button class="dash-modal__close" type="button" aria-label="Close dialog"><i data-lucide="x" class="icon-18"></i></button></div>
      <form class="js-product-form" novalidate>
        <div class="dash-view__grid" style="gap:1rem">
          <div class="field"><label for="new-product-name">Product name</label><input class="input js-p-name" id="new-product-name" maxlength="80" placeholder="SOKO 05 · Touring" required /></div>
          <div class="field"><label for="new-product-category">Category</label><select class="select js-p-cat" id="new-product-category"><option>Commuter</option><option>Delivery</option><option>Adventure</option><option>Performance</option><option>Accessory</option><option>Cargo</option><option>Off-road</option></select></div>
          <div class="field"><label for="new-product-price">Price · NGN</label><input class="input js-p-price" id="new-product-price" type="number" min="1" step="100" inputmode="numeric" placeholder="1350000" required /></div>
          <div class="field"><label for="new-product-stock">Opening stock</label><input class="input js-p-stock" id="new-product-stock" type="number" min="0" step="1" inputmode="numeric" value="0" required /></div>
          <div class="field"><label for="new-product-sku">SKU <span class="muted">(optional)</span></label><input class="input js-p-sku" id="new-product-sku" maxlength="32" placeholder="Auto-generated if blank" /></div>
          <div class="field"><label for="new-product-image">Product image</label><select class="select js-p-image" id="new-product-image"><option value="/images/accessory-helmet.webp">Helmet / accessory</option><option value="/images/bike-commuter.webp">Commuter bike</option><option value="/images/bike-commuter-side.webp">Deluxe bike</option><option value="/images/bike-delivery.webp">Cargo bike</option><option value="/images/bike-adventure.webp">Trail bike</option></select></div>
        </div>
        <p class="form-error js-product-error" role="alert" hidden></p>
        <div class="card-actions" style="margin-top:1rem"><button class="btn btn--primary js-p-save" type="submit"><i data-lucide="plus" class="icon-16"></i> Add product</button><button class="btn btn--quiet js-product-cancel" type="button">Cancel</button></div>
      </form>`, { label: 'Add a product' });
    $('.dash-modal__close', modal).addEventListener('click', closeModal);
    $('.js-product-cancel', modal).addEventListener('click', closeModal);
    $('.js-product-form', modal).addEventListener('submit', (event) => {
      event.preventDefault();
      const name = $('.js-p-name', modal).value.trim();
      const priceText = $('.js-p-price', modal).value.trim();
      const stockText = $('.js-p-stock', modal).value.trim();
      const price = Number(priceText);
      const stock = Number(stockText);
      const sku = $('.js-p-sku', modal).value.trim();
      const error = $('.js-product-error', modal);
      const skuExists = sku && adminInventory().some((product) => String(product.sku || '').toLowerCase() === sku.toLowerCase());
      let message = '';
      if (!name) message = 'Add a name so the team can identify this product.';
      else if (!priceText || !Number.isFinite(price) || price <= 0) message = 'Enter a price greater than zero.';
      else if (!stockText || !Number.isInteger(stock) || stock < 0) message = 'Opening stock must be a whole number of zero or more.';
      else if (skuExists) message = 'That SKU is already in use.';
      if (message) {
        error.textContent = message;
        error.hidden = false;
        return;
      }
      addAdminProduct({ name, category: $('.js-p-cat', modal).value, price, stock, sku, img: $('.js-p-image', modal).value });
      closeModal();
      renderInventory(); renderOverview(); renderAnalytics();
      toast(`${name} added to inventory.`);
    });
  });

  /* ── Rider book ────────────────────────────────────────────── */
  function renderCustomers() {
    const query = ($('.js-cust-search').value || '').trim().toLowerCase();
    const sort = $('.js-cust-sort').value;
    const all = adminCustomers();
    let list = all.filter((customer) => `${customer.name || ''} ${customer.email || ''} ${customer.city || ''}`.toLowerCase().includes(query));
    if (sort === 'spend') list.sort((a, b) => Number(b.spend) - Number(a.spend));
    else if (sort === 'orders') list.sort((a, b) => Number(b.orders) - Number(a.orders));
    else if (sort === 'recent') list.sort((a, b) => String(b.joined || '').localeCompare(String(a.joined || '')));
    $('.js-customer-count').textContent = `${all.length} rider${all.length === 1 ? '' : 's'} · ${list.length} shown`;
    $('.js-admin-customers tbody').innerHTML = list.length ? list.map((customer) => `
      <tr><td><div class="customer-cell"><span class="avatar" aria-hidden="true">${esc(String(customer.name || 'R').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase())}</span><span><b>${esc(customer.name || 'Rider')}</b><small>${esc(customer.email || 'No email on file')}</small></span></div></td>
        <td>${esc(customer.city || '—')}</td><td>${Number(customer.orders) || 0}</td><td class="align-right"><b>${money(customer.spend)}</b></td><td style="white-space:nowrap">${formatDate(customer.joined)}</td>
        <td class="align-right">${customer.email ? `<a class="chip-btn js-customer-email" href="mailto:${esc(customer.email)}" aria-label="Email ${esc(customer.name)}"><i data-lucide="mail" class="icon-14" aria-hidden="true"></i><span>Email</span></a>` : '<span class="muted">—</span>'}<button class="chip-btn js-customer-view" data-email="${esc(customer.email || '')}" data-name="${esc(customer.name || '')}" type="button" aria-label="View ${esc(customer.name)}"><i data-lucide="arrow-up-right" class="icon-14" aria-hidden="true"></i></button></td></tr>`).join('')
      : '<tr><td colspan="6" class="muted">No riders match this search.</td></tr>';
    hydrateIcons($('.js-admin-customers'));
  }
  function openCustomerDetails(email, name) {
    const customer = adminCustomers().find((item) => item.email === email || item.name === name);
    if (!customer) return;
    const relatedOrders = adminOrders().filter((order) => (email && order.email === email) || order.customer === customer.name);
    const emailAction = customer.email ? `<a class="btn btn--primary" href="mailto:${esc(customer.email)}"><i data-lucide="mail" class="icon-16"></i> Email rider</a>` : '';
    const modal = openModal(`
      <div class="dash-modal__head"><div><p class="panel__eyebrow">Rider record</p><h3>${esc(customer.name)}</h3></div><button class="dash-modal__close" type="button" aria-label="Close dialog"><i data-lucide="x" class="icon-18"></i></button></div>
      <dl class="detail-list"><div class="detail-row"><dt>Email</dt><dd>${customer.email ? `<a href="mailto:${esc(customer.email)}">${esc(customer.email)}</a>` : '—'}</dd></div>
        <div class="detail-row"><dt>City</dt><dd>${esc(customer.city || '—')}</dd></div><div class="detail-row"><dt>Joined</dt><dd>${formatDate(customer.joined)}</dd></div>
        <div class="detail-row"><dt>Orders</dt><dd>${Number(customer.orders) || 0}</dd></div><div class="detail-row"><dt>Lifetime spend</dt><dd>${money(customer.spend)}</dd></div></dl>
      <h4 class="modal-section-title">Recent order activity</h4>
      ${relatedOrders.length ? `<ul class="customer-order-list">${relatedOrders.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 4).map((order) => `<li><span><b>${esc(order.id || order.ref)}</b><small>${formatDate(order.date)} · ${esc(cap(cleanStatus(order.status)))}</small></span><b>${money(order.total)}</b></li>`).join('')}</ul>` : '<p class="muted">No orders in this sample ledger.</p>'}
      ${emailAction ? `<div class="card-actions" style="margin-top:1rem">${emailAction}</div>` : ''}`, { label: `Rider ${customer.name}` });
    $('.dash-modal__close', modal).addEventListener('click', closeModal);
  }
  $('.js-cust-search').addEventListener('input', renderCustomers);
  $('.js-cust-sort').addEventListener('change', renderCustomers);
  $('.js-admin-customers tbody').addEventListener('click', (event) => {
    const button = event.target.closest('.js-customer-view');
    if (button) openCustomerDetails(button.dataset.email, button.dataset.name);
  });

  /* ── Analytics ─────────────────────────────────────────────── */
  const horizontalBar = (fraction, label, value, tone = '') => `
    <div class="h-bar ${tone}"><div class="h-bar__label"><span>${esc(label)}</span><b>${esc(value)}</b></div>
      <div class="h-bar__track"><i style="width:${Math.max(1, Math.min(100, Math.round(fraction * 100)))}%"></i></div></div>`;
  function renderAnalytics() {
    const windowSize = Number($('.js-trend-range').value) || 12;
    const trend = adminOrdersTrend().slice(-windowSize);
    const max = Math.max(1, ...trend.map((point) => point.v));
    $('.js-trend-chart').innerHTML = trend.length ? trend.map((point) => `
      <div class="bar-col" title="${esc(point.w)} · index ${point.v}"><i class="bar" style="height:${Math.max(4, Math.round((point.v / max) * 100))}%"></i><span class="bar-label">${esc(point.w)}</span></div>`).join('')
      : '<p class="muted">No order activity to chart yet.</p>';

    const statuses = adminStatusBreakdown();
    const total = statuses.reduce((sum, item) => sum + item.count, 0);
    $('.js-status-break').innerHTML = statuses.length ? statuses.map((item) => horizontalBar(total ? item.count / total : 0, cap(item.status), `${item.count} · ${item.pct}%`, item.status)).join('') : '<p class="muted">No order status data yet.</p>';

    const categories = adminCategoryValue();
    const categoryMax = Math.max(1, ...categories.map((item) => item.value));
    $('.js-cat-value').innerHTML = categories.length ? categories.map((item) => horizontalBar(item.value / categoryMax, item.name, money(item.value))).join('') : '<p class="muted">No inventory value to report yet.</p>';

    const products = adminTopProducts();
    const productMax = Math.max(1, ...products.map((item) => item.sold));
    $('.js-top-products').innerHTML = products.length ? products.map((item) => horizontalBar(item.sold / productMax, item.name, `${item.sold} sold`)).join('') : '<p class="muted">Product activity will appear here.</p>';
  }
  $('.js-trend-range').addEventListener('change', renderAnalytics);

  /* ── Store settings ────────────────────────────────────────── */
  function renderSettings() {
    const settings = getAdminSettings();
    $('.js-set-gateway').value = settings.gateway || 'Paystack';
    $('.js-set-currency').value = settings.currency || '₦';
    $('.js-set-low').value = String(settings.lowStockThreshold ?? 6);
    $('.js-set-tax').value = String(settings.taxRate ?? 7.5);
    $('.js-set-enable').checked = settings.ordersEnabled !== false;
    $('.js-settings-state').textContent = 'Changes are saved when you choose Save settings.';
    syncOperationalBadges();
  }
  const settingsForm = $('.js-admin-settings');
  settingsForm.addEventListener('input', () => { $('.js-settings-state').textContent = 'Unsaved changes'; });
  settingsForm.addEventListener('change', () => { $('.js-settings-state').textContent = 'Unsaved changes'; });
  settingsForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const lowText = $('.js-set-low').value.trim();
    const taxText = $('.js-set-tax').value.trim();
    const low = Number(lowText);
    const tax = Number(taxText);
    if (!lowText || !Number.isInteger(low) || low < 0 || low > 999) {
      $('.js-set-low').focus(); toast('Low-stock alert must be a whole number from 0 to 999.'); return;
    }
    if (!taxText || !Number.isFinite(tax) || tax < 0 || tax > 100) {
      $('.js-set-tax').focus(); toast('Tax rate must be between 0 and 100 percent.'); return;
    }
    setAdminSetting('gateway', $('.js-set-gateway').value);
    setAdminSetting('currency', $('.js-set-currency').value);
    setAdminSetting('lowStockThreshold', low);
    setAdminSetting('taxRate', tax);
    setAdminSetting('ordersEnabled', $('.js-set-enable').checked);
    $('.js-settings-state').textContent = 'Saved just now.';
    renderInventory(); renderOverview(); renderAnalytics();
    toast('Store settings saved.');
  });
  $('.js-csv-download').addEventListener('click', () => {
    if (downloadCSV('soko-orders.csv', exportOrderRows(adminOrders()))) toast('All order records exported.');
  });
  $('.js-admin-reset').addEventListener('click', () => confirmAction({
    title: 'Reset store data?',
    body: 'Orders, inventory, customer records and store settings will return to the original seeded state. Member accounts and personal rider data stay untouched.',
    confirmText: 'Reset demo data', danger: true,
    onConfirm: () => {
      resetAdminData();
      selectedOrders.clear();
      renderAll();
      toast('Demo store data restored.');
    },
  }));

  /* ── CSV export ────────────────────────────────────────────── */
  function downloadCSV(filename, rows) {
    if (!rows.length) {
      toast('There are no rows to export for that selection.');
      return false;
    }
    const headers = Object.keys(rows[0]);
    const csvCell = (value) => {
      let text = String(value ?? '');
      if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    const content = `\uFEFF${[headers.map(csvCell).join(','), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(','))].join('\r\n')}`;
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.hidden = true;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  }

  /* ── Sign out + first paint ────────────────────────────────── */
  $$('[data-logout]').forEach((button) => button.addEventListener('click', (event) => {
    event.preventDefault();
    sessionStorage.setItem('soko-redirect', '/pages/admin.html');
    logout();
    window.location.href = '/pages/login.html';
  }));

  function renderAll() {
    renderOverview();
    renderAdminOrders();
    renderInventory();
    renderCustomers();
    renderAnalytics();
    renderSettings();
    hydrateIcons();
  }
  renderAll();
}

hydrateCartBadge();
hydrateIcons();
