/*
 * navbar.js, premium sticky header behavior
 * -----------------------------------------------------------------
 * - Sticky: transparent over hero → frosted + shrunk panel on scroll
 *   (.is-solid, CSS handles the fade/shrink)
 * - Animated Shop mega menu (clip-path wipe + staggered columns)
 * - Full-screen search overlay (product results, "/" shortcut, ESC)
 * - Active-link highlighting + mobile menu
 */
import { gsap } from 'gsap';
import { prefersReducedMotion } from './utils.js';
import { CATALOG, money } from './catalog.js';

const REDUCED = prefersReducedMotion();

/* ── Mega menu ──────────────────────────────────────────────────── */
let megaOpen = false;
let megaTl = null;
let megaCloseTimer = 0;
let megaCleanupTimer = 0;

function initMega() {
  const trigger = document.querySelector('[data-mega-trigger]');
  const mega = document.getElementById('mega-menu');
  const header = document.getElementById('site-nav');
  if (!trigger || !mega || !header) return;

  const cols = mega.querySelectorAll('[data-mega-col]');
  const hoverable = window.matchMedia('(hover: hover) and (min-width: 900px)').matches;
  if (REDUCED) {
    // still functional without motion
    trigger.addEventListener('click', () => {
      megaOpen = !megaOpen;
      trigger.setAttribute('aria-expanded', String(megaOpen));
      mega.classList.toggle('is-open', megaOpen);
      mega.setAttribute('aria-hidden', String(!megaOpen));
    });
    mega.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => {
      megaOpen = false;
      trigger.setAttribute('aria-expanded', 'false');
      mega.classList.remove('is-open');
      mega.setAttribute('aria-hidden', 'true');
    }));
    return;
  }

  gsap.set(mega, { clipPath: 'polygon(0 0, 100% 0, 100% 0, 0 0)' });

  megaTl = gsap
    .timeline({ paused: true })
    .to(mega, { clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)', duration: 0.5, ease: 'expo.out' }, 0)
    .fromTo(cols, { y: 20, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.45, ease: 'power3.out', stagger: 0.07 }, 0.05);

  const show = () => {
    window.clearTimeout(megaCloseTimer);
    window.clearTimeout(megaCleanupTimer);
    if (megaOpen) return;
    megaOpen = true;
    trigger.setAttribute('aria-expanded', 'true');
    mega.classList.add('is-open');
    mega.setAttribute('aria-hidden', 'false');
    megaTl.timeScale(1).play();
  };
  const hide = () => {
    window.clearTimeout(megaCloseTimer);
    if (!megaOpen) return;
    megaOpen = false;
    trigger.setAttribute('aria-expanded', 'false');
    mega.setAttribute('aria-hidden', 'true');
    megaTl.timeScale(1.8).reverse();
    megaCleanupTimer = window.setTimeout(() => mega.classList.remove('is-open'), 380);
  };
  const scheduleHide = () => {
    window.clearTimeout(megaCloseTimer);
    megaCloseTimer = window.setTimeout(hide, 140);
  };

  if (hoverable) {
    trigger.addEventListener('mouseenter', show);
    trigger.addEventListener('mouseleave', scheduleHide);
    mega.addEventListener('mouseenter', show);
    mega.addEventListener('mouseleave', scheduleHide);
  }
  trigger.addEventListener('click', (e) => {
    if (hoverable && e.detail > 0) {
      show();
      return;
    }
    megaOpen ? hide() : show();
  });
  mega.querySelectorAll('a').forEach((a) => a.addEventListener('click', hide));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && megaOpen) {
      hide();
      trigger.focus();
    }
  });
  document.addEventListener('click', (e) => {
    if (megaOpen && !header.contains(e.target)) hide();
  });
}

/* ── Sticky shrink on scroll ───────────────────────────────────── */
function initSticky() {
  const nav = document.getElementById('site-nav');
  if (!nav) return;

  const update = (y) => {
    nav.classList.toggle('is-solid', y > 28);
  };

  if (window.lenis) {
    window.lenis.on('scroll', ({ scroll }) => update(scroll));
  } else {
    window.addEventListener('scroll', () => update(window.scrollY), { passive: true });
  }
  update(window.scrollY || 0);
}

/* ── Search overlay ────────────────────────────────────────────── */
function initSearch() {
  const overlay = document.getElementById('search-overlay');
  const openBtns = document.querySelectorAll('.js-search-btn');
  if (!overlay || !openBtns.length) return;

  const input = overlay.querySelector('.js-search-input');
  const results = overlay.querySelector('.js-search-results');
  const empty = overlay.querySelector('.js-search-empty');
  const queryEl = overlay.querySelector('.js-search-query');
  let open = false;
  let openTl = null;

  const render = (q) => {
    const term = q.trim().toLowerCase();
    const hits = term
      ? CATALOG.filter(
          (p) =>
            p.name.toLowerCase().includes(term) ||
            p.catLabel.toLowerCase().includes(term) ||
            p.cat.toLowerCase().includes(term) ||
            p.specs.join(' ').toLowerCase().includes(term),
        )
      : CATALOG;

    if (queryEl) queryEl.textContent = q;
    if (empty) empty.hidden = hits.length > 0 || !term;

    results.innerHTML = hits
      .map(
        (p) => `
      <a class="search-hit" role="listitem" href="/pages/product.html">
        <span class="search-hit__thumb"><img src="${p.img}" alt="" loading="lazy" /></span>
        <span class="search-hit__body">
          <b>${p.name}</b>
          <small>${p.catLabel} · ${p.specs.join(' · ')}</small>
        </span>
        <span class="search-hit__price">${money(p.price)}</span>
      </a>`,
      )
      .join('');

    if (!REDUCED && hits.length) {
      gsap.fromTo(results.children, { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.4, stagger: 0.04, ease: 'power3.out', overwrite: 'auto' });
    }
  };

  const setOpen = (state) => {
    if (open === state) return;
    open = state;
    overlay.classList.toggle('is-open', state);
    overlay.setAttribute('aria-hidden', String(!state));
    openBtns.forEach((b) => b.setAttribute('aria-expanded', String(state)));
    document.body.style.overflow = state ? 'hidden' : '';

    if (state) {
      if (openTl) openTl.kill();
      if (REDUCED) {
        overlay.querySelector('.search-overlay__panel').style.transform = '';
      } else {
        openTl = gsap.fromTo(
          overlay.querySelector('.search-overlay__panel'),
          { y: -26, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.5, ease: 'expo.out' },
        );
      }
      setTimeout(() => input.focus(), REDUCED ? 0 : 180);
      render(input.value);
    }
  };

  openBtns.forEach((b) => b.addEventListener('click', () => setOpen(!open)));
  overlay.querySelectorAll('.js-search-close').forEach((el) => el.addEventListener('click', () => setOpen(false)));
  input.addEventListener('input', () => render(input.value));
  overlay.querySelectorAll('.js-search-pop').forEach((b) =>
    b.addEventListener('click', () => {
      input.value = b.textContent;
      render(b.textContent);
      input.focus();
    }),
  );

  // global shortcuts: "/" opens, ESC closes
  document.addEventListener('keydown', (e) => {
    const typing = /^(input|textarea|select)$/i.test(document.activeElement?.tagName || '');
    if (e.key === '/' && !typing && !open) {
      e.preventDefault();
      setOpen(true);
    }
    if (e.key === 'Escape' && open) setOpen(false);
  });
}

/* ── Active link highlighting ──────────────────────────────────── */
function initActiveLinks() {
  const path = location.pathname.split('/').filter(Boolean).join('/') || 'index.html';

  const resolve = (href) => (href === '/' ? 'index.html' : href.replace(/^\//, ''));

  document.querySelectorAll('.nav-link').forEach((a) => {
    const target = resolve(a.getAttribute('href') || '');
    if (target === path) a.classList.add('is-active');
  });

  // Shop mega trigger is "active" across the whole shop funnel
  const trigger = document.querySelector('[data-mega-trigger]');
  if (trigger) {
    const shopSet = trigger.dataset.navActive.split(' ');
    if (shopSet.some((p) => path === p)) trigger.classList.add('is-active');
  }
}

/* ── Mobile menu ───────────────────────────────────────────────── */
function initMobileMenu() {
  const menuBtn = document.querySelector('.menu-btn');
  const mobileMenu = document.querySelector('.mobile-menu');
  if (!menuBtn || !mobileMenu) return;

  const setOpen = (open) => {
    menuBtn.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    mobileMenu.classList.toggle('is-open', open);
    mobileMenu.setAttribute('aria-hidden', String(!open));
    document.body.style.overflow = open ? 'hidden' : '';
  };

  menuBtn.addEventListener('click', () => setOpen(!mobileMenu.classList.contains('is-open')));
  mobileMenu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileMenu.classList.contains('is-open')) setOpen(false);
  });
}

/* ── Boot ─────────────────────────────────────────────────────── */
export function initNavbar() {
  initSticky();
  initActiveLinks();
  initMega();
  initSearch();
  initMobileMenu();
}
