/*
 * dashboard.admin.js, complete store-operations controller
 * -----------------------------------------------------------------
 * Gated to admin sessions. Views: overview, orders, inventory,
 * customers, analytics, settings. Every action hits account.js and
 * persists via localStorage. Charts are hand-drawn SVG, no libs.
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
const isAdminUser = user && (user.role === 'admin' || user.isAdmin);

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

let toastTimer;
function toast(msg) {
  const t = $('.js-toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}
function openModal(html) {
  const el = document.createElement('div');
  el.className = 'dash-modal';
  el.innerHTML = `<div class="dash-modal__card">${html}</div>`;
  el.addEventListener('click', (e) => { if (e.target === el) closeModal(); });
  document.body.appendChild(el);
  hydrateIcons(el);
  return el;
}
function closeModal() { $$('.dash-modal').forEach((m) => m.remove()); }

/* ── routing ──────────────────────────────────────────────────── */
const hideAll = () => $$('.js-view').forEach((v) => (v.hidden = true));
function showView(name) {
  hideAll();
  const panel = $(`[data-view-panel="${name}"]`);
  if (panel) panel.hidden = false;
  $$('.dash-nav [data-view]').forEach((a) => a.classList.toggle('is-active', a.dataset.view === name));
  const titles = { overview: 'Overview', orders: 'Orders', inventory: 'Inventory', customers: 'Customers', analytics: 'Analytics', settings: 'Settings' };
  $('.js-view-title').textContent = titles[name] || 'Overview';
  const path = $('.js-view-path'); if (path) path.textContent = name.toUpperCase();
  if (window.lenis) window.lenis.scrollTo(0, { immediate: true });
  else window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── guards ───────────────────────────────────────────────────── */
if (!user) {
  $('.js-guest-guard').hidden = false;
  hydrateIcons();
} else if (!isAdminUser) {
  $('.js-not-admin-guard').hidden = false;
  hydrateIcons();
} else {
  $('.js-app').hidden = false;
  const initials = user.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  $('.js-user-initial').textContent = initials;
  $('.js-user-name').textContent = user.name;
  $('.js-user-email').textContent = user.email;
  const tickClock = () => { $('.js-dash-clock').textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Shanghai' }); };
  tickClock(); setInterval(tickClock, 30000);

  const STATUS = orderStatuses.filter((s) => s !== 'all');
  const pill = (s) => `<span class="pill ${s}">${s}</span>`;

  const bar = (size, lb, val, extra = '') => `<div class="h-bar">
      <div class="h-bar__label"><span>${lb}</span><b>${val}${extra}</b></div>
      <div class="h-bar__track"><i style="width:${Math.max(1, Math.round(size * 100))}%"></i></div>
    </div>`;

  const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const svgLine = (data) => {
    if (!data.length) return '<p class="muted">No data yet.</p>';
    const w = 640, h = 240, px = 34, py = 16;
    const min = Math.min(...data), max = Math.max(...data);
    const span = max - min || 1;
    const n = data.length;
    const x = (i) => px + (i * (w - px - 10)) / Math.max(1, n - 1);
    const y = (v) => h - py - ((v - min) / span) * (h - py * 2);
    const pts = data.map((v, i) => `${x(i)},${y(v)}`).join(' ');
    const grid = [0, 0.5, 1].map((f) => { const gy = h - py - f * (h - py * 2); return `<line x1="${px}" y1="${gy}" x2="${w - 10}" y2="${gy}" class="gridline" /><text x="6" y="${gy + 4}" class="axis">${Math.round(min + f * span)}</text>`; }).join('');
    return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Revenue chart">
        ${grid}
        <polygon points="${px},${h - py} ${pts} ${w - 10},${h - py}" class="area" />
        <polyline points="${pts}" class="line" />
        ${data.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="3.2" class="dot" />`).join('')}
      </svg>`;
  };

  /* ── Overview ─────────────────────────────────────────────── */
  function renderOverview() {
    const k = adminKPIs();
    const kpis = [
      { label: 'Revenue (YTD)', value: money(k.revenue), sub: `${k.revenueDelta >= 0 ? '+' : ''}${k.revenueDelta}% vs last year`, tone: k.revenueDelta >= 0 ? 'up' : 'down', icon: 'banknote' },
      { label: 'Orders', value: String(k.orders), sub: `${k.ordersDelta >= 0 ? '+' : ''}${k.ordersDelta}% vs last month`, tone: k.ordersDelta >= 0 ? 'up' : 'down', icon: 'package' },
      { label: 'Avg. order value', value: money(k.aov), sub: `${k.aovDelta >= 0 ? '+' : ''}${k.aovDelta}% vs last month`, tone: k.aovDelta >= 0 ? 'up' : 'down', icon: 'trending-up' },
      { label: 'Customers', value: String(k.customers), sub: `${k.newCustomersLast30} new in 30 days`, tone: 'up', icon: 'users' },
    ];
    $('.js-kpis').innerHTML = kpis.map((x) => `<div class="kpi"><span class="kpi__label"><i data-lucide="${x.icon}" class="icon-16"></i> ${x.label}</span><div class="kpi__value">${x.value}</div><span class="kpi__delta ${x.tone}">${x.sub}</span></div>`).join('');
    $('.js-chart').innerHTML = svgLine(adminRevenue(Number($('.js-chart-range').value) || 6));
    const alerts = [];
    const low = adminLowStock();
    if (low.length) alerts.push(...low.map((p) => ({ title: `Low stock: ${p.name}`, body: `${p.stock} unit${p.stock === 1 ? '' : 's'} left. Consider restocking.`, tone: 'warn' })));
    const open = adminOrders().filter((o) => ['paid', 'processing'].includes(o.status));
    const oc = $('.js-open-count'); if (oc) oc.textContent = String(open.length);
    if (open.length) alerts.push({ title: `${open.length} order${open.length === 1 ? '' : 's'} need attention`, body: 'Open orders are waiting on fulfilment.', tone: 'info' });
    if (!alerts.length) alerts.push({ title: 'All clear', body: 'No low-stock items or overdue orders right now.', tone: 'ok' });
    $('.js-alerts').innerHTML = alerts.map((a) => `<div class="notif"><span class="notif__dot ${a.tone}"></span><div style="flex:1"><b>${a.title}</b><p>${a.body}</p></div></div>`).join('');
    const latest = adminOrders().slice(0, 5);
    $('.js-latest-orders tbody').innerHTML = latest.map((o) => `<tr>
        <td style="font-weight:600">${o.id}</td><td>${esc(customerName(o))}</td><td style="white-space:nowrap">${o.date}</td>
        <td>${pill(o.status)}</td><td style="text-align:right;font-weight:600">${money(o.total)}</td></tr>`).join('') || `<tr><td colspan="5" class="muted">No orders yet.</td></tr>`;
  }
  function customerName(o) { return o.customer || 'Guest'; }
  const itemCount = (o) => (Array.isArray(o.items) ? o.items.reduce((a, i) => a + (i.qty || 1), 0) : (o.items || 0));

  $('.js-chart-range').addEventListener('change', renderOverview);

  /* ── Orders ───────────────────────────────────────────────── */
  let selected = new Set(); // checked order ids
  function renderAdminOrders(filter = '') {
    const q = filter.toLowerCase();
    const rows = adminOrders().filter((o) => !q || `${o.id} ${o.email || ''} ${customerName(o)}`.toLowerCase().includes(q));
    $('.js-admin-orders tbody').innerHTML = rows.map((o) => `<tr>
        <td><input type="checkbox" class="row-check" data-id="${o.id}" /></td>
        <td style="font-weight:600">${o.id}<div style="color:var(--color-text-muted);font-size:0.72rem">${esc(o.email || '')}</div></td>
        <td>${esc(customerName(o))}</td>
        <td>${itemCount(o)}</td>
        <td style="white-space:nowrap">${o.date}</td>
        <td><select class="select select--sm js-status-set" data-id="${o.id}">${STATUS.map((s) => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
        <td style="text-align:right;font-weight:600">${money(o.total)}</td>
        <td style="text-align:right"><button class="chip-btn js-order-view" data-id="${o.id}" type="button" title="View"><i data-lucide="eye" class="icon-16"></i></button></td></tr>`).join('') || `<tr><td colspan="8" class="muted">No orders match.</td></tr>`;
  }
  $('.js-order-search').addEventListener('input', (e) => renderAdminOrders(e.target.value));

  const syncBulk = () => {
    const bar = $('.js-bulk-bar');
    if (!bar) return;
    const n = selected.size;
    bar.hidden = n === 0;
    $('.js-bulk-count').textContent = `${n} selected`;
  };
  $('.js-admin-orders tbody').addEventListener('change', (e) => {
    if (e.target.classList.contains('row-check')) {
      if (e.target.checked) selected.add(e.target.dataset.id); else selected.delete(e.target.dataset.id);
      syncBulk();
    }
  });
  const checkAll = $('.js-check-all');
  if (checkAll) checkAll.addEventListener('change', (e) => {
    $$('.row-check').forEach((cb) => { cb.checked = e.target.checked; if (e.target.checked) selected.add(cb.dataset.id); else selected.delete(cb.dataset.id); });
    syncBulk();
  });
  const bulk = (fn, label) => {
    selected.forEach((id) => fn(id));
    selected.clear();
    renderAdminOrders($('.js-order-search').value);
    renderOverview();
    syncBulk();
    toast(label);
  };
  $('.js-bulk-cancel').addEventListener('click', () => bulk((id) => setOrderStatus(id, 'cancelled'), 'Selected orders cancelled.'));
  $('.js-bulk-deliver').addEventListener('click', () => bulk((id) => setOrderStatus(id, 'delivered'), 'Selected orders marked delivered.'));
  $('.js-bulk-clear').addEventListener('click', () => {
    selected.clear();
    $$('.row-check').forEach((cb) => (cb.checked = false));
    const all = $('.js-check-all'); if (all) all.checked = false;
    syncBulk();
  });
  $('.js-admin-orders tbody').addEventListener('change', (e) => {
    if (!e.target.classList.contains('js-status-set')) return;
    setOrderStatus(e.target.dataset.id, e.target.value);
    toast(`Order ${e.target.dataset.id} → ${e.target.value}.`);
    renderOverview();
  });
  $('.js-admin-orders tbody').addEventListener('click', (e) => {
    if (!e.target.closest('.js-order-view')) return;
    const o = adminOrders().find((x) => x.id === e.target.closest('.js-order-view').dataset.id);
    if (!o) return;
    openModal(`<div class="dash-modal__head"><h3>${o.id} · ${esc(customerName(o))}</h3><button class="dash-modal__close" type="button"><i data-lucide="x" class="icon-18"></i></button></div>
      <dl class="detail-list">
        <div class="detail-row"><dt>Customer</dt><dd>${esc(customerName(o))}</dd></div>
        <div class="detail-row"><dt>Email</dt><dd>${esc(o.email || '-')}</dd></div>
        <div class="detail-row"><dt>Date</dt><dd>${o.date}</dd></div>
        <div class="detail-row"><dt>Items</dt><dd>${itemCount(o)}</dd></div>
        <div class="detail-row"><dt>Status</dt><dd><span class="pill ${o.status}">${o.status}</span></dd></div>
        <div class="detail-row"><dt>Total</dt><dd>${money(o.total)}</dd></div>
      </dl>
      <div class="card-actions" style="margin-top:1.2rem">
        ${STATUS.map((st) => `<button class="chip-btn js-order-set" data-id="${o.id}" data-status="${st}" type="button" ${st === o.status ? 'style="color:var(--color-text);border-color:var(--color-line-strong)"' : ''}>${st}</button>`).join('')}
      </div>`);
    $('.dash-modal__close').addEventListener('click', closeModal);
    $$('.js-order-set').forEach((b) => b.addEventListener('click', () => {
      setOrderStatus(b.dataset.id, b.dataset.status);
      closeModal(); renderAdminOrders($('.js-order-search').value); renderOverview();
      toast(`Order ${b.dataset.id} → ${b.dataset.status}.`);
    }));
  });
  $('.js-order-export-go').addEventListener('click', () => {
    const mode = $('.js-order-export').value;
    const list = mode === 'csv-open' ? adminOrders().filter((o) => ['paid', 'processing'].includes(o.status)) : adminOrders();
    if (mode === 'print') { window.print(); return; }
    downloadCSV('soko-orders.csv', list.map((o) => ({ 'Order': o.id, 'Ref': o.ref, 'Customer': customerName(o), 'Date': o.date, 'Status': o.status, 'Total NGN': o.total, 'Items': itemCount(o) })));
    toast('Orders exported to CSV.');
  });

  /* ── Inventory ────────────────────────────────────────────── */
  function renderInventory(filter = '') {
    const q = filter.toLowerCase();
    const rows = adminInventory().filter((p) => !q || p.name.toLowerCase().includes(q));
    $('.js-admin-inventory tbody').innerHTML = rows.map((p) => `<tr>
        <td><div class="prod-cell"><img src="${p.img}" alt="" /><div><b>${esc(p.name)}</b><small>${esc(p.cat)} · ${esc(p.sku || '')}</small></div></div></td>
        <td><input class="mini-input js-price" data-id="${p.id}" value="${p.price}" /></td>
        <td><div class="stock-stepper">
          <button class="js-stock-minus" data-id="${p.id}" type="button" aria-label="decrease"><i data-lucide="minus" class="icon-14"></i></button>
          <span class="js-stock-num" data-id="${p.id}" style="min-width:2ch;text-align:center;font-variant-numeric:tabular-nums">${p.stock}</span>
          <button class="js-stock-plus" data-id="${p.id}" type="button" aria-label="increase"><i data-lucide="plus" class="icon-14"></i></button>
        </div></td>
        <td>${stockPill(p.stock)}</td>
        <td>${p.sold}</td>
        <td style="text-align:right"><button class="chip-btn js-product-remove" data-id="${p.id}" type="button"><i data-lucide="trash-2" class="icon-14"></i> Remove</button></td></tr>`).join('') || `<tr><td colspan="6" class="muted">No products match.</td></tr>`;
    $('.js-inv-note').textContent = rows.length ? `${rows.length} product${rows.length === 1 ? '' : 's'} · stock adjusts save instantly.` : '';
  }
  const stockPill = (n) => (n === 0 ? '<span class="pill out">Out</span>' : n <= 6 ? '<span class="pill low">Low</span>' : '<span class="pill in">In stock</span>');
  $('.js-inv-search').addEventListener('input', (e) => renderInventory(e.target.value));
  $('.js-admin-inventory tbody').addEventListener('click', (e) => {
    const id = e.target.closest('[data-id]')?.dataset.id;
    if (!id) return;
    const p = adminInventory().find((x) => x.id === id);
    if (e.target.closest('.js-stock-plus')) { adjustAdminStock(id, 1); renderInventory($('.js-inv-search').value); }
    if (e.target.closest('.js-stock-minus')) { adjustAdminStock(id, -1); renderInventory($('.js-inv-search').value); }
    if (e.target.closest('.js-product-remove')) { removeAdminProduct(id); renderInventory($('.js-inv-search').value); toast(`"${p ? p.name : 'Product'}" removed.`); }
  });
  $('.js-admin-inventory tbody').addEventListener('change', (e) => {
    if (!e.target.classList.contains('js-price')) return;
    const v = Number(e.target.value);
    if (!Number.isFinite(v) || v <= 0) { e.target.value = adminInventory().find((x) => x.id === e.target.dataset.id).price; return; }
    updateAdminPrice(e.target.dataset.id, v);
    toast('Price updated.');
  });
  $('.js-product-add').addEventListener('click', () => {
    openModal(`<div class="dash-modal__head"><h3>Add product</h3><button class="dash-modal__close" type="button"><i data-lucide="x" class="icon-18"></i></button></div>
      <div class="dash-view__grid" style="gap:1rem">
        <div class="field"><label>Name</label><input class="input js-p-name" placeholder="SOKO 05 Touring" /></div>
        <div class="field"><label>Category</label><select class="select js-p-cat"><option>Commuter</option><option>Cargo</option><option>Off-road</option><option>Performance</option></select></div>
        <div class="field"><label>Price (₦)</label><input class="input js-p-price" inputmode="numeric" /></div>
        <div class="field"><label>Initial stock</label><input class="input js-p-stock" inputmode="numeric" /></div>
      </div>
      <button class="btn btn--primary js-p-save" style="margin-top:1rem" type="button">Add product</button>`);
    $('.dash-modal__close').addEventListener('click', closeModal);
    $('.js-p-save').addEventListener('click', () => {
      const name = $('.js-p-name').value.trim();
      const price = Number($('.js-p-price').value);
      const stock = Number($('.js-p-stock').value) || 0;
      if (!name || !Number.isFinite(price) || price <= 0) return toast('Give the product a name and valid price.');
      addAdminProduct({ name, category: $('.js-p-cat').value, price, stock });
      closeModal(); renderInventory($('.js-inv-search').value); toast('Product added.');
    });
  });

  /* ── Customers ────────────────────────────────────────────── */
  function renderCustomers() {
    const q = $('.js-cust-search').value.toLowerCase();
    const sort = $('.js-cust-sort').value;
    let list = adminCustomers().filter((c) => !q || `${c.name} ${c.email} ${c.city}`.toLowerCase().includes(q));
    if (sort === 'spend') list = list.slice().sort((a, b) => b.spend - a.spend);
    if (sort === 'orders') list = list.slice().sort((a, b) => b.orders - a.orders);
    if (sort === 'recent') list = list.slice().sort((a, b) => (b.joined || '').localeCompare(a.joined || ''));
    $('.js-admin-customers tbody').innerHTML = list.map((c) => `<tr>
        <td><div class="prod-cell"><span class="avatar"><i data-lucide="user" class="icon-14"></i></span><b>${esc(c.name)}</b></div></td>
        <td>${esc(c.email)}</td><td>${esc(c.city || '-')}</td>
        <td>${c.orders}</td><td style="text-align:right;font-weight:600">${money(c.spend)}</td><td style="white-space:nowrap">${c.joined || '-'}</td></tr>`).join('') || `<tr><td colspan="6" class="muted">No customers match.</td></tr>`;
  }
  $('.js-cust-search').addEventListener('input', renderCustomers);
  $('.js-cust-sort').addEventListener('change', renderCustomers);

  /* ── Analytics ────────────────────────────────────────────── */
  function renderAnalytics() {
    const trend = adminOrdersTrend();
    $('.js-trend-chart').innerHTML = trend.map((t) => `<div class="bar-col"><i class="bar" style="height:${Math.max(3, t.v)}%"></i><span class="bar-label">${t.w}</span></div>`).join('');

    const sb = adminStatusBreakdown();
    const total = sb.reduce((a, x) => a + x.count, 0) || 1;
    $('.js-status-break').innerHTML = sb.map((x) => bar(x.count / total, cap(x.status), `${x.count}`)).join('');

    const cats = adminCategoryValue();
    const cMax = Math.max(...cats.map((x) => x.value), 1);
    $('.js-cat-value').innerHTML = cats.map((x) => bar(x.value / cMax, x.name, money(x.value))).join('');

    const tops = adminTopProducts();
    const tMax = Math.max(...tops.map((x) => x.sold), 1);
    $('.js-top-products').innerHTML = tops.map((x) => bar(x.sold / tMax, x.name, `${x.sold} sold`)).join('');
  }
  const cap = (s) => s[0].toUpperCase() + s.slice(1);

  /* ── Settings ─────────────────────────────────────────────── */
  function renderSettings() {
    const s = getAdminSettings();
    $('.js-set-gateway').value = s.gateway;
    $('.js-set-currency').value = s.currency;
    $('.js-set-low').value = s.lowStockThreshold;
    $('.js-set-tax').value = s.taxRate;
    $('.js-set-enable').checked = s.ordersEnabled;
  }
  $('.js-admin-settings').addEventListener('submit', (e) => {
    e.preventDefault();
    setAdminSetting('gateway', $('.js-set-gateway').value);
    setAdminSetting('currency', $('.js-set-currency').value);
    setAdminSetting('lowStockThreshold', Number($('.js-set-low').value) || 6);
    setAdminSetting('taxRate', Number($('.js-set-tax').value) || 0);
    setAdminSetting('ordersEnabled', $('.js-set-enable').checked);
    toast('Settings saved.');
  });
  $('.js-csv-download').addEventListener('click', () => {
    downloadCSV('soko-orders.csv', adminOrders().map((o) => ({ 'Order': o.id, 'Ref': o.ref, 'Customer': customerName(o), 'Date': o.date, 'Status': o.status, 'Total NGN': o.total, 'Items': itemCount(o) })));
    toast('CSV downloaded.');
  });
  $('.js-admin-reset').addEventListener('click', () => {
    openModal(`<div class="dash-modal__head"><h3>Reset demo data?</h3><button class="dash-modal__close" type="button"><i data-lucide="x" class="icon-18"></i></button></div>
      <p class="muted">Orders, inventory, customers and store settings return to the original seeded demo state. Member accounts are kept.</p>
      <div class="card-actions" style="margin-top:1.2rem"><button class="btn btn--primary js-reset-confirm" type="button">Reset data</button></div>`);
    $('.dash-modal__close').addEventListener('click', closeModal);
    $('.js-reset-confirm').addEventListener('click', () => { resetAdminData(); closeModal(); renderAll(); toast('Demo data reset.'); });
  });

  /* ── shared helpers ───────────────────────────────────────── */
  function downloadCSV(filename, rows) {
    const head = Object.keys(rows[0] || {});
    const lines = [head.join(','), ...rows.map((r) => head.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  const renderAll = () => { renderOverview(); renderAdminOrders($('.js-order-search')?.value || ''); renderInventory($('.js-inv-search')?.value || ''); renderCustomers(); renderAnalytics(); renderSettings(); hydrateIcons(); };

  /* ── sign out + routing ───────────────────────────────────── */
  $$('[data-logout]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); logout(); window.location.href = '/'; }));

  document.addEventListener('click', (e) => {
    const got = e.target.closest('[data-goto]');
    if (got) { e.preventDefault(); const v = got.dataset.goto; history.replaceState(null, '', '#' + v); showView(v); }
  });
  $$('.dash-nav [data-view]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault(); const v = a.dataset.view; history.replaceState(null, '', '#' + v); showView(v);
  }));

  const VIEWS = ['overview', 'orders', 'inventory', 'customers', 'analytics', 'settings'];
  const initial = (location.hash || '#overview').slice(1);
  showView(VIEWS.includes(initial) ? initial : 'overview');

  renderAll();
}

hydrateCartBadge();
