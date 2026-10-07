/*
 * dashboard.user.js — rider desk controller
 * -----------------------------------------------------------------
 * Hash-routed account views backed by account.js and localStorage. The
 * visible controls are intentionally small and explicit; no dead-end actions.
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
const asset = (src, fallback = '/images/bike-commuter.webp') => /^\/images\/[\w./-]+$/.test(String(src || '')) ? src : fallback;
const VIEWS = ['overview', 'orders', 'wishlist', 'wallet', 'addresses', 'garage', 'support', 'notifications', 'settings', 'more'];
const DOCK_VIEWS = ['overview', 'orders', 'garage', 'wallet', 'more'];
const MORE_VIEWS = ['wishlist', 'addresses', 'support', 'notifications', 'settings'];

ensureSeeded();
const user = currentUser();
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

let toastTimer;
function toast(message) {
  const node = $('.js-toast');
  if (!node) return;
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 2500);
}

let modalReturnFocus = null;
function openModal(content) {
  closeModal(false);
  modalReturnFocus = document.activeElement;
  const overlay = document.createElement('div');
  overlay.className = 'dash-modal';
  overlay.innerHTML = `<div class="dash-modal__card" role="dialog" aria-modal="true" tabindex="-1">${content}</div>`;
  overlay.addEventListener('click', (event) => { if (event.target === overlay) closeModal(); });
  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.preventDefault(); closeModal(); return; }
    if (event.key !== 'Tab') return;
    const focusable = $$('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', overlay)
      .filter((node) => !node.hidden);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  document.body.appendChild(overlay);
  hydrateIcons(overlay);
  requestAnimationFrame(() => (overlay.querySelector('.dash-modal__close') || overlay.querySelector('input,select,button,a[href]') || overlay.querySelector('.dash-modal__card'))?.focus());
  return overlay;
}
function closeModal(restoreFocus = true) {
  $$('.dash-modal').forEach((node) => node.remove());
  if (restoreFocus && modalReturnFocus?.isConnected) modalReturnFocus.focus();
  modalReturnFocus = null;
}
function bindModalClose(root = $('.dash-modal')) {
  root?.querySelector('.dash-modal__close')?.addEventListener('click', () => closeModal());
}
function setFieldError(node, message) {
  if (!node) return;
  node.textContent = message;
  node.hidden = !message;
}
function daysRemaining(dateString) {
  const target = new Date(`${dateString}T00:00:00Z`);
  if (!Number.isFinite(target.getTime())) return 0;
  return Math.max(0, Math.ceil((target.getTime() - Date.now()) / 86400000));
}

/* ── View routing ─────────────────────────────────────────────── */
const TITLES = {
  overview: 'Overview', orders: 'Your orders', wishlist: 'Saved rides', wallet: 'Wallet & cards',
  addresses: 'Delivery addresses', garage: 'The garage', support: 'Support',
  notifications: 'Notifications', settings: 'Account settings', more: 'More',
};
function showView(name) {
  const view = VIEWS.includes(name) ? name : 'overview';
  $$('.js-view').forEach((panel) => { panel.hidden = panel.dataset.viewPanel !== view; });

  // Handle both old sidebar nav and new iOS dock nav
  $$('.dash-nav [data-view], .dash-ios-dock [data-view]').forEach((link) => {
    const active = link.dataset.view === view;
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });

  // For secondary views (in More section), keep More tab active in dock
  if (MORE_VIEWS.includes(view)) {
    const moreTab = $$('.dash-ios-dock [data-view="more"]').pop();
    if (moreTab) {
      moreTab.classList.add('is-active');
      moreTab.setAttribute('aria-current', 'page');
    }
    // Remove active state from other dock tabs
    $$('.dash-ios-dock [data-view]:not([data-view="more"])').forEach((link) => {
      link.classList.remove('is-active');
      link.removeAttribute('aria-current');
    });
  }

  $('.js-view-title').textContent = TITLES[view] || view.charAt(0).toUpperCase() + view.slice(1);
  const path = $('.js-view-path');
  if (path) path.textContent = view.toUpperCase();
  if (window.lenis) window.lenis.scrollTo(0, { immediate: true });
  else window.scrollTo({ top: 0, behavior: 'smooth' });
}
function navigateToView(name, { historyMode = 'push', ticketType = '' } = {}) {
  if (!VIEWS.includes(name)) return;
  const url = new URL(window.location.href);
  url.hash = name;
  if (historyMode === 'replace') window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  else window.history.pushState(null, '', url.pathname + url.search + url.hash);
  showView(name);
  if (ticketType && $('.js-tk-type')) $('.js-tk-type').value = ticketType;
}
function syncViewFromUrl() {
  const name = (window.location.hash || '#overview').slice(1);
  const view = VIEWS.includes(name) ? name : 'overview';
  showView(view);
}

/* ── Access guard ─────────────────────────────────────────────── */
if (!user) {
  $('.js-guest-guard').hidden = false;
  $('.js-app').hidden = true;
  hydrateIcons();
} else {
  $('.js-app').hidden = false;
  const setIdentity = (profile = user) => {
    const initials = String(profile.name || 'Rider').split(/\s+/).map((word) => word[0]).slice(0, 2).join('').toUpperCase();
    $('.js-user-initial').textContent = initials;
    $('.js-user-name').textContent = profile.name || 'Rider';
    $('.js-user-email').textContent = profile.email || '';
    $('.js-welcome-heading').textContent = `Welcome back, ${(profile.name || 'rider').split(/\s+/)[0]}.`;
  };
  setIdentity();
  $('.js-welcome-body').textContent = 'Your latest roadbook, bike details and rider support stay together here.';

  /* ── Overview ─────────────────────────────────────────────── */
  function renderOverview() {
    const orders = ordersFor(user.id);
    const wallet = getWallet(user.id);
    const saved = wishlistProducts(user.id);
    const bikes = getGarage(user.id);
    const unread = getNotifs(user.id).filter((note) => note.unread).length;
    const kpis = [
      { label: 'Orders', value: String(orders.length), icon: 'package-check' },
      { label: 'Saved rides', value: String(saved.length), icon: 'heart' },
      { label: 'Wallet credit', value: money(wallet.balance), icon: 'wallet-cards' },
      { label: 'Bikes in your garage', value: String(bikes.length), icon: 'bike' },
    ];
    $('.js-kpis').innerHTML = kpis.map((item) => `<div class="kpi"><span class="kpi__label"><i data-lucide="${item.icon}" class="icon-16"></i>${item.label}</span><b class="kpi__value">${item.value}</b></div>`).join('');
    const unreadBadge = $('.js-unread-count');
    if (unreadBadge) { unreadBadge.textContent = unread > 9 ? '9+' : String(unread); unreadBadge.hidden = unread === 0; }

    const recent = $('.js-recent-orders');
    if (recent) recent.innerHTML = orders.length ? manifest(orders[0]) : emptyBlock('Your first order will have a roadbook here, from the Guangzhou bench to your door.', { icon: 'package-search', action: 'Browse the lineup', href: '/pages/shop.html' });

    const preview = $('.js-overview-garage');
    if (preview) {
      if (bikes.length) {
        const bike = bikes[0];
        const days = daysRemaining(bike.warrantyUntil);
        preview.innerHTML = `<div class="garage-peek__bike"><img src="${asset(modelImage(bike.model))}" alt="${esc(bike.model)}" loading="lazy" /><div><b>${esc(bike.model)}</b><small>VIN ${esc(bike.serial || 'Not recorded')}</small></div></div><div class="garage-peek__warranty"><i data-lucide="shield-check" class="icon-14"></i> ${days ? `${days.toLocaleString()} days of warranty left` : 'Warranty period has ended'}</div>`;
      } else {
        preview.innerHTML = `<p class="garage-peek__empty">Register a SOKO bike to keep its warranty and service history close.<br /><a href="#garage" data-goto="garage">Open your garage <i data-lucide="arrow-right" class="icon-14"></i></a></p>`;
      }
    }

    const activity = $('.js-overview-notifs');
    const notes = getNotifs(user.id).slice(0, 3);
    if (activity) activity.innerHTML = notes.length
      ? notes.map((note) => `<div class="notif ${note.unread ? 'unread' : ''}"><span class="notif__dot" aria-hidden="true"></span><div style="flex:1"><b>${esc(note.title)}</b><p>${esc(note.body)}</p></div><time>${esc(note.time)}</time></div>`).join('')
      : '<p class="muted">Nothing new from the crew.</p>';

    const actions = $('.js-quick-actions');
    if (actions) actions.innerHTML = [
      quickAction('package-check', 'Track an order', '#orders', 'orders'),
      quickAction('shopping-bag', 'Browse bikes and kit', '/pages/shop.html'),
      quickAction('wrench', 'Book a service', '#support', 'support', 'service'),
      quickAction('life-buoy', 'Talk to the SOKO crew', '#support', 'support'),
    ].join('');
    hydrateIcons($('.js-view[data-view-panel="overview"]') || document);
  }

  function quickAction(icon, label, href, goto = '', ticketType = '') {
    const data = goto ? ` data-goto="${goto}"${ticketType ? ` data-ticket-type="${ticketType}"` : ''}` : '';
    return `<a class="quick-action" href="${href}"${data}><span class="quick-action__icon"><i data-lucide="${icon}" class="icon-16"></i></span><span>${label}</span><i data-lucide="arrow-right" class="icon-14 quick-action__arrow"></i></a>`;
  }

  /* ── Latest order roadbook ─────────────────────────────────── */
  const ROUTE = ['Bench checked', 'Packed', 'On the water', 'Port cleared', 'At your door'];
  const ROUTE_POS = { paid: 0, processing: 1, shipped: 2, delivered: 4 };
  function manifest(order) {
    const cancelled = order.status === 'cancelled';
    const position = cancelled ? -1 : (ROUTE_POS[order.status] ?? 0);
    const items = Array.isArray(order.items) ? order.items : [];
    const quantity = items.reduce((sum, item) => sum + (Number(item.qty) || 1), 0);
    const lead = items[0] || {};
    const progress = cancelled ? 0 : Math.max(0, Math.min(84, Math.round((position / 4) * 84)));
    const message = cancelled ? 'This order was cancelled.' : order.eta || ROUTE[position] || 'We’ll update you as the order moves.';
    return `<article class="manifest ${cancelled ? 'is-cancelled' : ''}" data-manifest aria-label="Latest order ${esc(order.id)}">
      <div class="manifest__visual"><img src="${asset(lead.img)}" alt="${esc(lead.name || 'SOKO order item')}" /><div class="manifest__stamp"><div><small>YOUR ROADBOOK</small><b>${esc(order.ref || order.id)}</b></div><span class="pill ${esc(order.status)}">${statusLabel(order.status)}</span></div></div>
      <div class="manifest__body">
        <div>
          <div class="manifest__head"><div><span class="manifest__kicker">LATEST ORDER · ${esc(order.date || '')}</span><h3 class="manifest__ref">${esc(order.id)}</h3></div><div class="manifest__items">${items.slice(0, 3).map((item) => `<span class="manifest__thumb"><img src="${asset(item.img)}" alt="" /></span>`).join('')}<span>${quantity} ${quantity === 1 ? 'item' : 'items'}</span></div></div>
          <p class="manifest__intro">${lead.name ? `<strong>${esc(lead.name)}</strong> · ` : ''}${esc(message)}</p>
          <div class="manifest__route" role="list" aria-label="Order route">
            <span class="mr-line" aria-hidden="true"></span><span class="mr-progress" aria-hidden="true" style="width:${progress}%"></span>
            ${ROUTE.map((label, index) => { const done = !cancelled && index < position; const current = !cancelled && index === position; return `<div class="mr-node ${done ? 'done' : ''} ${current ? 'doing' : ''}" role="listitem" ${current ? 'aria-current="step"' : ''}><span class="mr-dot" aria-hidden="true"></span><span class="mr-label">${label}</span></div>`; }).join('')}
          </div>
        </div>
        <div class="manifest__foot"><div class="manifest__eta"><small>${cancelled ? 'ORDER STATUS' : 'NEXT UPDATE'}</small><b>${cancelled ? 'Cancelled' : esc(order.eta || ROUTE[position] || 'In progress')}</b></div><div class="manifest__actions"><button class="chip-btn js-order-detail" data-id="${esc(order.id)}" type="button"><i data-lucide="eye" class="icon-14"></i> Order details</button><a class="chip-btn" href="#orders" data-goto="orders"><i data-lucide="package-check" class="icon-14"></i> All orders</a></div></div>
      </div>
    </article>`;
  }

  function modelImage(model = '') {
    const name = String(model).toLowerCase();
    if (name.includes('cargo')) return '/images/bike-delivery.webp';
    if (name.includes('trail')) return '/images/bike-adventure.webp';
    if (name.includes('pro')) return '/images/bike-pro.webp';
    return '/images/bike-commuter.webp';
  }
  function statusLabel(status = '') { return String(status).replace(/\b\w/g, (letter) => letter.toUpperCase()); }

  /* ── Orders ────────────────────────────────────────────────── */
  function orderCard(order) {
    const items = Array.isArray(order.items) ? order.items : [];
    const timeline = orderTimeline(order.status);
    const activeStep = Math.max(0, timeline.findIndex((step) => !step.done));
    const canCancel = ['paid', 'processing'].includes(order.status);
    return `<article class="order-card" data-order-card="${esc(order.id)}">
      <div class="order-card__head"><div><b>${esc(order.id)}</b><span class="meta">Ref ${esc(order.ref || '—')} · ${esc(order.date || '')}</span></div><span class="pill ${esc(order.status)}">${statusLabel(order.status)}</span></div>
      <div class="order-card__items">${items.length ? items.map((item) => `<div class="order-card__item"><span class="thumb"><img src="${asset(item.img)}" alt="" /></span><span><b>${esc(item.name || 'SOKO item')}</b><small>${money(item.price)} × ${Number(item.qty) || 1}</small></span></div>`).join('') : '<p class="muted">Item details are not attached to this order.</p>'}</div>
      ${!['cancelled', 'delivered'].includes(order.status) ? `<div class="timeline-h" role="list" aria-label="Order status timeline">${timeline.map((step, index) => `<div class="tl-step ${step.done ? 'done' : ''} ${index === activeStep ? 'doing' : ''}" role="listitem" ${index === activeStep ? 'aria-current="step"' : ''}><span class="tl-dot" aria-hidden="true"></span><span class="tl-label">${esc(step.label)}</span></div>`).join('')}</div>` : `<p class="muted">${order.status === 'cancelled' ? 'This order was cancelled.' : 'Delivered. Enjoy the ride.'}</p>`}
      <div class="order-card__foot"><div class="card-actions"><button class="chip-btn js-order-detail" data-id="${esc(order.id)}" type="button"><i data-lucide="eye" class="icon-14"></i> Details</button><button class="chip-btn js-order-invoice" data-id="${esc(order.id)}" type="button"><i data-lucide="receipt-text" class="icon-14"></i> Invoice</button>${canCancel ? `<button class="chip-btn js-order-cancel" data-id="${esc(order.id)}" type="button"><i data-lucide="circle-x" class="icon-14"></i> Cancel order</button>` : ''}<button class="chip-btn js-order-reorder" data-id="${esc(order.id)}" type="button"><i data-lucide="rotate-ccw" class="icon-14"></i> Reorder</button></div><span class="total">${money(order.total)}</span></div>
    </article>`;
  }
  function renderOrders() {
    const list = ordersFor(user.id);
    $('.js-orders').innerHTML = list.length ? list.map(orderCard).join('') : emptyBlock('No orders yet. Start with a bike that fits your ride.', { icon: 'package-search', action: 'Browse the lineup', href: '/pages/shop.html' });
    $('.js-order-count').textContent = `${list.length} ${list.length === 1 ? 'order' : 'orders'}`;
    hydrateIcons($('.js-orders'));
  }
  const ordersRoot = $('.js-orders');
  $('.js-recent-orders').addEventListener('click', (event) => {
    const detail = event.target.closest('.js-order-detail');
    if (!detail) return;
    const order = ordersFor(user.id).find((item) => item.id === detail.dataset.id);
    if (order) openOrderDetail(order);
  });
  ordersRoot.addEventListener('click', (event) => {
    const button = event.target.closest('[class*="js-order-"]');
    if (!button) return;
    const order = ordersFor(user.id).find((item) => item.id === button.dataset.id);
    if (!order) return;
    if (button.classList.contains('js-order-detail')) openOrderDetail(order);
    else if (button.classList.contains('js-order-invoice')) downloadInvoice(order);
    else if (button.classList.contains('js-order-cancel')) confirmOrderCancel(order);
    else if (button.classList.contains('js-order-reorder')) {
      const added = reorderOrder(order.id);
      hydrateCartBadge();
      toast(added ? 'Items added to your cart.' : 'This order could not be reordered.');
    }
  });
  function openOrderDetail(order) {
    const timeline = orderTimeline(order.status);
    const destination = order.address ? `${order.address.line1 || ''}${order.address.city ? `, ${order.address.city}` : ''}` : (user.city || 'Address on file');
    const modal = openModal(`<div class="dash-modal__head"><h3>${esc(order.id)} · Order details</h3><button class="dash-modal__close" type="button" aria-label="Close order details"><i data-lucide="x" class="icon-18"></i></button></div>
      <dl class="detail-list"><div class="detail-row"><dt>Reference</dt><dd>${esc(order.ref || '—')}</dd></div><div class="detail-row"><dt>Placed</dt><dd>${esc(order.date || '—')}</dd></div><div class="detail-row"><dt>Status</dt><dd><span class="pill ${esc(order.status)}">${statusLabel(order.status)}</span></dd></div><div class="detail-row"><dt>Payment</dt><dd>${esc(order.paymentMethod === 'pod' ? 'Pay on delivery' : `${order.paymentMethod || 'Card'} · ${order.paymentGateway || 'Paystack'}`)} · ${order.status === 'cancelled' ? 'cancelled · no refund processed' : 'simulated · no charge'}</dd></div><div class="detail-row"><dt>Total</dt><dd><strong>${money(order.total)}</strong></dd></div><div class="detail-row"><dt>Ship to</dt><dd>${esc(destination)}</dd></div></dl>
      <div class="timeline-h" role="list" aria-label="Order status timeline">${timeline.map((step) => `<div class="tl-step ${step.done ? 'done' : ''}" role="listitem"><span class="tl-dot" aria-hidden="true"></span><span class="tl-label">${esc(step.label)}</span></div>`).join('')}</div>`);
    bindModalClose(modal);
  }
  function confirmOrderCancel(order) {
    const modal = openModal(`<div class="dash-modal__head"><h3>Cancel ${esc(order.id)}?</h3><button class="dash-modal__close" type="button" aria-label="Close cancellation dialog"><i data-lucide="x" class="icon-18"></i></button></div><p class="muted">This local demo will mark the order as cancelled. No payment or refund is processed here.</p><div class="card-actions"><button class="btn btn--danger js-cancel-confirm" type="button">Cancel this order</button><button class="btn btn--quiet js-cancel-back" type="button">Keep the order</button></div>`);
    bindModalClose(modal);
    modal.querySelector('.js-cancel-back')?.addEventListener('click', () => closeModal());
    modal.querySelector('.js-cancel-confirm')?.addEventListener('click', () => {
      cancelOrder(order.id);
      closeModal();
      renderOrders(); renderOverview();
      toast('Order cancelled. Refund details are on the order record.');
    });
  }
  function downloadInvoice(order) {
    const blob = new Blob([orderInvoiceHTML(order, currentUser() || user)], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, '_blank');
    if (opened) {
      opened.opener = null;
      toast('Invoice opened in a new tab.');
    } else {
      const link = document.createElement('a');
      link.href = url;
      link.download = `soko-invoice-${String(order.id).replace(/[^a-z0-9-]/gi, '')}.html`;
      document.body.appendChild(link); link.click(); link.remove();
      toast('Invoice downloaded. Open it to print or save as PDF.');
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  /* ── Wishlist ──────────────────────────────────────────────── */
  function renderWishlist() {
    const list = wishlistProducts(user.id);
    const count = $('.js-wishlist-count');
    if (count) count.textContent = `${list.length} ${list.length === 1 ? 'saved ride' : 'saved rides'}`;
    $('.js-wishlist').innerHTML = list.length
      ? list.map((product) => {
        const category = String(product.cat || 'Accessory').toLowerCase();
        const target = `/pages/shop.html?cat=${encodeURIComponent(category)}&item=${encodeURIComponent(product.id)}#catalog`;
        const stock = Number(product.stock) || 0;
        const stockMarkup = stock === 0 ? '<span class="pill out">Out of stock</span>' : stock <= 6 ? '<span class="pill low">Low stock</span>' : '<span class="pill in">In stock</span>';
        return `<article class="wish-card"><div class="media"><img src="${asset(product.img)}" alt="${esc(product.name)}" loading="lazy" />${stockMarkup}</div><div class="body"><h3>${esc(product.name)}</h3><span class="price">${money(product.price)}</span><div class="row"><a class="btn btn--quiet btn--sm" href="${target}">Find in the lineup <i data-lucide="arrow-up-right" class="icon-14"></i></a><button class="btn btn--primary btn--sm js-wish-cart" data-id="${esc(product.id)}" type="button" ${stock === 0 ? 'disabled aria-disabled="true" title="This item is currently out of stock"' : ''}><i data-lucide="shopping-bag" class="icon-14"></i> Add to cart</button><button class="btn btn--quiet btn--sm js-wish-remove" data-id="${esc(product.id)}" type="button" aria-label="Remove ${esc(product.name)} from saved rides"><i data-lucide="heart" class="icon-14"></i> Unsave</button></div></div></article>`;
      }).join('')
      : emptyBlock('No saved rides yet. Save a bike or a piece of kit from the shop and it will show up here.', { icon: 'heart', action: 'Find your next ride', href: '/pages/shop.html' });
    hydrateIcons($('.js-wishlist'));
  }
  $('.js-wishlist').addEventListener('click', (event) => {
    const remove = event.target.closest('.js-wish-remove');
    const add = event.target.closest('.js-wish-cart');
    if (remove) {
      toggleWishlist(user.id, remove.dataset.id);
      renderWishlist(); renderOverview();
      toast('Removed from saved rides.');
    } else if (add && !add.disabled) {
      moveWishlistToCart(user.id, add.dataset.id);
      renderWishlist(); renderOverview(); hydrateCartBadge();
      toast('Added to your cart.');
    }
  });

  /* ── Wallet, cards and referral ────────────────────────────── */
  function renderWallet() {
    const wallet = getWallet(user.id);
    $('.js-wallet-balance').textContent = money(wallet.balance);
    const transactions = Array.isArray(wallet.transactions) ? wallet.transactions : [];
    $('.js-wallet-txns tbody').innerHTML = transactions.length ? transactions.map((transaction) => `<tr><td style="white-space:nowrap">${esc(transaction.date || '')}</td><td>${esc(transaction.label || 'Wallet activity')}</td><td><span class="pill ${transaction.type === 'credit' ? 'in' : 'debit'}">${esc(transaction.type || 'debit')}</span></td><td class="align-right" style="font-weight:650;white-space:nowrap">${transaction.type === 'credit' ? '+' : '−'}${money(transaction.amount)}</td></tr>`).join('') : '<tr><td colspan="4" class="muted">No wallet activity yet.</td></tr>';
    const cards = getCards(user.id);
    $('.js-cards').innerHTML = cards.length ? cards.map((card) => `<div class="card-card">${card.isDefault ? '<span class="default-tag pill in">Default</span>' : ''}<b>${esc(card.brand)} ···· ${esc(card.last4)}</b><span class="muted">Expires ${esc(card.exp)}</span><div class="card-actions">${!card.isDefault ? `<button class="chip-btn js-card-default" data-id="${esc(card.id)}" type="button">Make default</button>` : ''}<button class="chip-btn js-card-remove" data-id="${esc(card.id)}" type="button"><i data-lucide="trash-2" class="icon-14"></i> Remove</button></div></div>`).join('') : '<p class="muted">No saved cards yet. Add a payment method for faster checkout.</p>';
    const referral = getReferral(user.id, user.name);
    $('.js-ref-code').textContent = referral.code;
    $('.js-ref-stats').textContent = `${referral.invited} referred · ${money(referral.earned)} earned`;
    hydrateIcons($('.js-cards'));
  }
  $('.js-topup').addEventListener('click', () => {
    const modal = openModal(`<div class="dash-modal__head"><h3>Add wallet credit</h3><button class="dash-modal__close" type="button" aria-label="Close wallet top-up"><i data-lucide="x" class="icon-18"></i></button></div><p>Choose a starting amount or enter your own. This is a local demo transaction; no payment is collected.</p><div class="dash-view__grid topup-options">${[10000, 25000, 50000, 100000].map((amount) => `<button class="btn btn--quiet js-topup-amt" data-amt="${amount}" type="button">${money(amount)}</button>`).join('')}</div><div class="field" style="margin-top:13px"><label for="topup-custom">Custom amount · NGN</label><input class="input js-topup-custom" id="topup-custom" type="number" min="100" step="100" inputmode="numeric" placeholder="Minimum ₦100" /></div><p class="form-error js-topup-error" role="alert" hidden></p><div class="panel__foot"><button class="btn btn--primary js-topup-go" type="button">Add credit</button></div>`);
    bindModalClose(modal);
    modal.querySelectorAll('.js-topup-amt').forEach((button) => button.addEventListener('click', () => {
      modal.querySelector('.js-topup-custom').value = button.dataset.amt;
      setFieldError(modal.querySelector('.js-topup-error'), '');
    }));
    modal.querySelector('.js-topup-go')?.addEventListener('click', () => {
      const amount = Math.floor(Number(modal.querySelector('.js-topup-custom').value));
      if (!Number.isFinite(amount) || amount < 100) return setFieldError(modal.querySelector('.js-topup-error'), 'Enter an amount of at least ₦100.');
      topUpWallet(user.id, amount);
      closeModal(); renderWallet(); renderOverview();
      toast('Wallet credit added to your demo account.');
    });
  });
  $('.js-add-card').addEventListener('click', () => {
    const modal = openModal(`<div class="dash-modal__head"><h3>Add a payment method</h3><button class="dash-modal__close" type="button" aria-label="Close add card"><i data-lucide="x" class="icon-18"></i></button></div><p>Only the card label and last four digits are stored in this local demo. Never enter a full card number.</p><div class="dash-view__grid" style="margin-top:14px"><div class="field"><label for="card-brand">Card brand</label><select class="select js-card-brand" id="card-brand"><option>Visa</option><option>Mastercard</option><option>Verve</option></select></div><div class="field"><label for="card-last4">Last 4 digits</label><input class="input js-card-last4" id="card-last4" inputmode="numeric" autocomplete="off" maxlength="4" placeholder="0000" /></div><div class="field"><label for="card-expiry">Expiry · MM/YY</label><input class="input js-card-exp" id="card-expiry" inputmode="numeric" autocomplete="off" maxlength="5" placeholder="MM/YY" /></div></div><p class="form-error js-card-error" role="alert" hidden></p><div class="panel__foot"><button class="btn btn--primary js-card-save" type="button">Save payment method</button></div>`);
    bindModalClose(modal);
    modal.querySelector('.js-card-save')?.addEventListener('click', () => {
      const last4 = modal.querySelector('.js-card-last4').value.trim();
      const expiry = modal.querySelector('.js-card-exp').value.trim();
      const error = modal.querySelector('.js-card-error');
      if (!/^\d{4}$/.test(last4)) return setFieldError(error, 'Enter exactly four digits from the card.');
      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) return setFieldError(error, 'Use the month and year format MM/YY.');
      const [month, year] = expiry.split('/').map(Number);
      const now = new Date();
      const expiryDate = new Date(2000 + year, month, 0, 23, 59, 59);
      if (expiryDate < now) return setFieldError(error, 'That card has expired. Enter a future expiry date.');
      addCard(user.id, { brand: modal.querySelector('.js-card-brand').value, last4, exp: expiry });
      closeModal(); renderWallet(); toast('Payment method saved.');
    });
  });
  $('.js-cards').addEventListener('click', (event) => {
    const remove = event.target.closest('.js-card-remove');
    const makeDefault = event.target.closest('.js-card-default');
    if (remove) {
      removeCard(user.id, remove.dataset.id); renderWallet(); toast('Payment method removed.');
    } else if (makeDefault) {
      setDefaultCard(user.id, makeDefault.dataset.id); renderWallet(); toast('Default payment method updated.');
    }
  });
  $('.js-ref-copy').addEventListener('click', async () => {
    const code = $('.js-ref-code').textContent.trim();
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(code);
      else throw new Error('clipboard unavailable');
      toast('Referral code copied.');
    } catch (_) {
      const field = document.createElement('textarea');
      field.value = code; field.setAttribute('readonly', ''); field.style.position = 'fixed'; field.style.opacity = '0';
      document.body.appendChild(field); field.select();
      const copied = document.execCommand?.('copy'); field.remove();
      toast(copied ? 'Referral code copied.' : `Your referral code is ${code}.`);
    }
  });

  /* ── Addresses ─────────────────────────────────────────────── */
  function renderAddresses() {
    const addresses = getAddresses(user.id);
    $('.js-addresses').innerHTML = addresses.length ? addresses.map((address) => `<article class="addr-card">${address.isDefault ? '<span class="default-tag pill in">Default</span>' : ''}<b>${esc(address.label || 'Address')}</b><span class="muted">${esc(address.line1 || '')}${address.line2 ? `, ${esc(address.line2)}` : ''}${address.city ? ` · ${esc(address.city)}` : ''}${address.state ? `, ${esc(address.state)}` : ''}${address.country ? ` · ${esc(address.country)}` : ''}</span><span class="muted">${esc(address.name || '')}${address.phone ? ` · ${esc(address.phone)}` : ''}</span><div class="card-actions">${!address.isDefault ? `<button class="chip-btn js-addr-default" data-id="${esc(address.id)}" type="button">Make default</button>` : ''}<button class="chip-btn js-addr-edit" data-id="${esc(address.id)}" type="button">Edit</button><button class="chip-btn js-addr-remove" data-id="${esc(address.id)}" type="button">Remove</button></div></article>`).join('') : emptyBlock('Add a delivery address and checkout can start with the right destination.', { icon: 'map-pin', action: 'Add an address', button: true, className: 'js-add-addr' });
    hydrateIcons($('.js-addresses'));
  }
  function addressForm(address = {}) {
    const value = (key, fallback = '') => esc(address[key] ?? fallback);
    return `<div class="dash-modal__head"><h3>${address.id ? 'Edit' : 'Add'} a delivery address</h3><button class="dash-modal__close" type="button" aria-label="Close address form"><i data-lucide="x" class="icon-18"></i></button></div><input type="hidden" class="js-addr-id" value="${value('id')}" /><div class="dash-view__grid"><div class="field"><label for="addr-label">Label</label><input class="input js-addr-label" id="addr-label" value="${value('label')}" placeholder="Home, office…" required /></div><div class="field"><label for="addr-name">Recipient name</label><input class="input js-addr-name" id="addr-name" value="${value('name', user.name)}" autocomplete="name" required /></div><div class="field"><label for="addr-phone">Phone</label><input class="input js-addr-phone" id="addr-phone" type="tel" value="${value('phone', user.phone || '')}" autocomplete="tel" required /></div><div class="field"><label for="addr-line1">Street address</label><input class="input js-addr-line1" id="addr-line1" value="${value('line1')}" autocomplete="street-address" required /></div><div class="field"><label for="addr-line2">Apartment, suite or area <span class="muted">(optional)</span></label><input class="input js-addr-line2" id="addr-line2" value="${value('line2')}" autocomplete="address-line2" /></div><div class="field"><label for="addr-city">City</label><input class="input js-addr-city" id="addr-city" value="${value('city')}" autocomplete="address-level2" required /></div><div class="field"><label for="addr-state">State</label><input class="input js-addr-state" id="addr-state" value="${value('state')}" autocomplete="address-level1" required /></div><div class="field"><label for="addr-country">Country</label><input class="input js-addr-country" id="addr-country" value="${value('country', 'Nigeria')}" autocomplete="country-name" required /></div></div><p class="form-error js-addr-error" role="alert" hidden></p><div class="panel__foot"><button class="btn btn--primary js-addr-save" type="button">Save address</button></div>`;
  }
  document.addEventListener('click', (event) => {
    if (event.target.closest('.js-add-addr')) openAddressForm();
  });
  $('.js-addresses').addEventListener('click', (event) => {
    const edit = event.target.closest('.js-addr-edit');
    const setDefault = event.target.closest('.js-addr-default');
    const remove = event.target.closest('.js-addr-remove');
    if (edit) {
      const address = getAddresses(user.id).find((item) => item.id === edit.dataset.id);
      if (address) openAddressForm(address);
    } else if (setDefault) {
      setDefaultAddress(user.id, setDefault.dataset.id); renderAddresses(); toast('Default delivery address updated.');
    } else if (remove) {
      removeAddress(user.id, remove.dataset.id); renderAddresses(); toast('Address removed.');
    }
  });
  function openAddressForm(address = {}) {
    const modal = openModal(addressForm(address));
    bindModalClose(modal);
    modal.querySelector('.js-addr-save')?.addEventListener('click', () => {
      const fields = {
        label: modal.querySelector('.js-addr-label').value.trim(),
        name: modal.querySelector('.js-addr-name').value.trim(),
        phone: modal.querySelector('.js-addr-phone').value.trim(),
        line1: modal.querySelector('.js-addr-line1').value.trim(),
        line2: modal.querySelector('.js-addr-line2').value.trim(),
        city: modal.querySelector('.js-addr-city').value.trim(),
        state: modal.querySelector('.js-addr-state').value.trim(),
        country: modal.querySelector('.js-addr-country').value.trim(),
      };
      const required = ['label', 'name', 'phone', 'line1', 'city', 'state', 'country'];
      if (required.some((key) => !fields[key])) return setFieldError(modal.querySelector('.js-addr-error'), 'Complete each required field before saving this address.');
      const addressId = modal.querySelector('.js-addr-id').value || undefined;
      const current = addressId ? getAddresses(user.id).find((item) => item.id === addressId) : null;
      const saved = saveAddress(user.id, { id: addressId, ...fields, isDefault: !!current?.isDefault });
      closeModal(); renderAddresses();
      const result = Array.isArray(saved) ? saved : getAddresses(user.id);
      toast(result.length ? 'Delivery address saved.' : 'Address could not be saved.');
    });
  }

  /* ── Garage ───────────────────────────────────────────────── */
  function renderGarage() {
    const bikes = getGarage(user.id);
    $('.js-garage').innerHTML = bikes.length ? bikes.map((bike) => {
      const days = daysRemaining(bike.warrantyUntil);
      const percent = Math.min(100, Math.round((days / 730) * 100));
      return `<article class="garage-card"><div class="garage-head"><span class="garage-icon"><i data-lucide="bike" class="icon-20"></i></span><div><b>${esc(bike.model || 'SOKO bike')}</b><small>VIN ${esc(bike.serial || 'Not recorded')} · registered ${esc(bike.registered || '—')}${bike.fromOrder ? ` · from ${esc(bike.fromOrder)}` : ''}</small></div></div><div class="warranty-bar"><i data-lucide="shield-check" class="icon-18"></i><div class="progress" role="progressbar" aria-label="Warranty time remaining" aria-valuemin="0" aria-valuemax="730" aria-valuenow="${percent * 7.3}"><i style="width:${percent}%"></i></div><span class="muted">${days ? `${days.toLocaleString()} days left` : 'Warranty ended'}</span></div><div class="card-actions"><a class="chip-btn" href="#support" data-goto="support" data-ticket-type="service"><i data-lucide="wrench" class="icon-14"></i> Book service</a><a class="chip-btn" href="/pages/faq.html"><i data-lucide="book-open" class="icon-14"></i> Care guide</a></div></article>`;
    }).join('') : emptyBlock('Register a bike to keep its serial number, cover period and service history together.', { icon: 'bike', action: 'Register a bike', button: true, className: 'js-register-bike' });
    hydrateIcons($('.js-garage'));
  }
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.js-register-bike')) return;
    const modal = openModal(`<div class="dash-modal__head"><h3>Register a SOKO bike</h3><button class="dash-modal__close" type="button" aria-label="Close bike registration"><i data-lucide="x" class="icon-18"></i></button></div><p>Adding a bike records it in your garage and starts a two-year warranty clock in this demo.</p><div class="dash-view__grid" style="margin-top:14px"><div class="field"><label for="reg-model">Model</label><select class="select js-reg-model" id="reg-model"><option>SOKO 01 · Commuter</option><option>SOKO 02 · Cargo</option><option>SOKO 03 · Trail</option><option>SOKO Pro · Performance</option></select></div><div class="field"><label for="reg-serial">Serial number / VIN</label><input class="input js-reg-serial" id="reg-serial" maxlength="40" placeholder="Optional · e.g. SM1-2026-04812" /></div></div><p class="form-error js-reg-error" role="alert" hidden></p><div class="panel__foot"><button class="btn btn--primary js-reg-save" type="button">Register bike</button></div>`);
    bindModalClose(modal);
    modal.querySelector('.js-reg-save')?.addEventListener('click', () => {
      const model = modal.querySelector('.js-reg-model').value;
      const serial = modal.querySelector('.js-reg-serial').value.trim();
      if (serial && !/^[a-z0-9-]{4,40}$/i.test(serial)) return setFieldError(modal.querySelector('.js-reg-error'), 'Use 4–40 letters, numbers or hyphens for the serial number.');
      if (serial && getGarage(user.id).some((bike) => String(bike.serial).toLowerCase() === serial.toLowerCase())) return setFieldError(modal.querySelector('.js-reg-error'), 'That serial number is already in your garage.');
      registerBike(user.id, { model, serial });
      closeModal(); renderGarage(); renderOverview(); toast('Bike registered. Its warranty is now on file.');
    });
  });

  /* ── Support tickets ───────────────────────────────────────── */
  function renderTickets() {
    const tickets = getTickets(user.id);
    $('.js-tickets').innerHTML = tickets.length ? tickets.map((ticket) => `<article class="ticket"><div class="ticket__head"><b>${esc(ticket.subject)}</b><span class="pill ${ticket.status === 'open' ? 'processing' : 'delivered'}">${esc(ticket.status || 'open')}</span></div><span class="muted">${esc(ticket.type || 'support')} · ${esc(ticket.date || '')}</span><p>${esc(ticket.detail || '')}</p></article>`).join('') : '<p class="muted">No requests yet. Start one here and the conversation will be saved to your account.</p>';
  }
  $('.js-tk-submit').addEventListener('click', () => {
    const subject = $('.js-tk-subject').value.trim();
    const detail = $('.js-tk-detail').value.trim();
    if (!subject) return toast('Add a short subject before sending.');
    if (!detail) return toast('Add a few details so the crew can help.');
    addTicket(user.id, { type: $('.js-tk-type').value, subject, detail });
    $('.js-tk-subject').value = ''; $('.js-tk-detail').value = '';
    renderTickets(); toast('Request saved in this browser. Use the contact page for a team reply.');
  });

  /* ── Notifications ─────────────────────────────────────────── */
  function renderNotifs() {
    const notifications = getNotifs(user.id);
    const unread = notifications.filter((note) => note.unread).length;
    const badge = $('.js-unread-count');
    if (badge) { badge.textContent = unread > 9 ? '9+' : String(unread); badge.hidden = unread === 0; }
    $('.js-notifs').innerHTML = notifications.length ? notifications.map((note) => `<article class="notif ${note.unread ? 'unread' : ''}" data-id="${esc(note.id)}"><span class="notif__dot" aria-hidden="true"></span><div style="flex:1"><b>${esc(note.title)}</b><p>${esc(note.body)}</p></div><time>${esc(note.time || '')}</time>${note.unread ? `<button class="chip-btn js-notif-read" data-id="${esc(note.id)}" type="button">Mark read</button>` : ''}<button class="chip-btn js-notif-del" data-id="${esc(note.id)}" type="button" aria-label="Delete notification: ${esc(note.title)}"><i data-lucide="x" class="icon-14"></i></button></article>`).join('') : emptyBlock('You’re all caught up. New order milestones and service reminders will land here.', { icon: 'bell', action: 'Back to overview', href: '#overview', goto: 'overview' });
    hydrateIcons($('.js-notifs'));
  }
  $('.js-notifs').addEventListener('click', (event) => {
    const read = event.target.closest('.js-notif-read');
    const remove = event.target.closest('.js-notif-del');
    if (read) { markNotifRead(user.id, read.dataset.id); renderNotifs(); renderOverview(); toast('Notification marked as read.'); }
    else if (remove) { deleteNotif(user.id, remove.dataset.id); renderNotifs(); renderOverview(); toast('Notification removed.'); }
  });
  $('.js-mark-read').addEventListener('click', () => {
    markAllRead(user.id); renderNotifs(); renderOverview(); toast('All notifications marked as read.');
  });

  /* ── Profile, password and preferences ─────────────────────── */
  function renderSettings() {
    const profile = currentUser() || user;
    $('.js-set-name').value = profile.name || '';
    $('.js-set-email').value = profile.email || '';
    $('.js-set-phone').value = profile.phone || '';
    $('.js-set-city').value = profile.city || '';
    const prefs = getPrefs(user.id);
    $('.js-pref-order').checked = !!prefs.orderUpdates;
    $('.js-pref-promo').checked = !!prefs.promos;
    $('.js-pref-sms').checked = !!prefs.sms;
  }
  $('.js-save-profile').addEventListener('click', () => {
    const name = $('.js-set-name').value.trim();
    if (name.length < 2) return toast('Enter your name before saving.');
    const profile = updateProfile({ name, phone: $('.js-set-phone').value, city: $('.js-set-city').value });
    if (!profile) return toast('Your session has ended. Sign in again to update your profile.');
    setIdentity(profile); renderSettings();
    toast('Rider profile saved.');
  });
  $('.js-pw-change').addEventListener('click', () => {
    const result = changePassword($('.js-pw-cur').value, $('.js-pw-new').value);
    if (result.error) return toast(result.error);
    $('.js-pw-cur').value = ''; $('.js-pw-new').value = '';
    toast('Password updated.');
  });
  const savePreferences = () => setPrefs(user.id, { orderUpdates: $('.js-pref-order').checked, promos: $('.js-pref-promo').checked, sms: $('.js-pref-sms').checked });
  $('.js-pref-order').addEventListener('change', () => { savePreferences(); toast('Order update preference saved.'); });
  $('.js-pref-promo').addEventListener('change', () => { savePreferences(); toast('Product and offer preference saved.'); });
  $('.js-pref-sms').addEventListener('change', () => { savePreferences(); toast('SMS preference saved.'); });
  $('.js-delete-account').addEventListener('click', () => {
    const modal = openModal(`<div class="dash-modal__head"><h3>Delete this account?</h3><button class="dash-modal__close" type="button" aria-label="Close account deletion dialog"><i data-lucide="x" class="icon-18"></i></button></div><p class="muted">This removes the demo profile, saved rides, order history, garage, wallet and addresses from this browser. Guest shopping will still work. This cannot be undone.</p><div class="card-actions"><button class="btn btn--danger js-del-confirm" type="button">Delete account and data</button><button class="btn btn--quiet js-del-cancel" type="button">Keep my account</button></div>`);
    bindModalClose(modal);
    modal.querySelector('.js-del-cancel')?.addEventListener('click', () => closeModal());
    modal.querySelector('.js-del-confirm')?.addEventListener('click', () => { deleteAccount(); window.location.href = '/'; });
  });

  /* ── Navigation, sign-out and initial hydration ─────────────── */
  $$('[data-logout], .js-logout').forEach((button) => button.addEventListener('click', (event) => {
    event.preventDefault(); logout(); window.location.href = '/';
  }));
  document.addEventListener('click', (event) => {
    const goto = event.target.closest('[data-goto]');
    if (!goto) return;
    const name = goto.dataset.goto;
    if (!VIEWS.includes(name)) return;
    event.preventDefault();
    navigateToView(name, { ticketType: goto.dataset.ticketType || '' });
  });
  $$('.dash-nav [data-view], .dash-ios-dock [data-view]').forEach((link) => link.addEventListener('click', (event) => {
    event.preventDefault();
    navigateToView(link.dataset.view);
  }));
  window.addEventListener('popstate', syncViewFromUrl);
  window.addEventListener('hashchange', syncViewFromUrl);

  const clock = $('.js-dash-clock');
  const tick = () => { if (clock) clock.textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' }); };
  tick(); setInterval(tick, 30_000);
  const initial = (window.location.hash || '#overview').slice(1);
  showView(VIEWS.includes(initial) ? initial : 'overview');

  function renderAll() {
    renderOverview(); renderOrders(); renderWishlist(); renderWallet(); renderAddresses();
    renderGarage(); renderTickets(); renderNotifs(); renderSettings(); hydrateIcons();
  }
  renderAll();
}

function emptyBlock(message, { icon = 'sparkles', action = '', href = '', goto = '', button = false, className = '' } = {}) {
  const destination = goto ? ` data-goto="${esc(goto)}"` : '';
  const actionMarkup = action ? (button
    ? `<button class="btn btn--quiet btn--sm ${className}" type="button">${esc(action)} <i data-lucide="arrow-right" class="icon-14"></i></button>`
    : `<a href="${esc(href)}"${destination} class="text-link">${esc(action)} <i data-lucide="arrow-right" class="icon-14"></i></a>`) : '';
  return `<div class="empty-state"><span class="empty-state__icon"><i data-lucide="${icon}" class="icon-18"></i></span><p>${esc(message)}</p>${actionMarkup}</div>`;
}

hydrateCartBadge();
