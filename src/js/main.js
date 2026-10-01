/*
 * main.js, App entry point
 * ----------------------------------------------------------------
 * 1. Imports the compiled design system (Tailwind + all stylesheets).
 * 2. Initializes GSAP + ScrollTrigger + Lenis (+ snap addon) + Lucide.
 * 3. Boots the shared motion systems and page-specific controllers.
 */

// ── Styles (single entry, main.css pulls in every stylesheet) ────
import '../css/main.css';

// ── Libraries ─────────────────────────────────────────────────────
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import Lenis from 'lenis';
import Snap from 'lenis/snap';

// ── App modules ───────────────────────────────────────────────────
import { hydrateIcons } from './icons.js';
import { initNavbar } from './navbar.js';
import { initAnimations } from './animations.js';
import { initScrollStories } from './scrollstory.js';
import { initCollage } from './collage.js';
import { initStoryCarousel } from './storycarousel.js';
import { initHome } from './home.js';
import { initChrome } from './chrome.js';
import { initLottie } from './lottie.js';
import { hydrateCartBadge } from './badge.js';
import { ensureSeeded, initAccountUI } from './account.js';
import { prefersReducedMotion } from './utils.js';

// ── GSAP core setup ──────────────────────────────────────────────
gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);
if (import.meta.env?.DEV) { window.gsap = gsap; window.ScrollTrigger = ScrollTrigger; } // dev-only inspection hook

const REDUCED = prefersReducedMotion();

// ── Page-transition: if we just arrived via an internal navigation,
// keep the curtain covered from the very first frame so the incoming
// page never flashes before the wipe-out animation.
(function coverOnArrival() {
  if (REDUCED) return;
  const overlay = document.querySelector('.page-curtains');
  if (!overlay || !sessionStorage.getItem('__soko-wipe')) return;
  overlay.classList.add('is-active');
  Array.from(overlay.children).forEach((s) => {
    s.style.transition = 'none';
    s.style.transform = 'scaleY(1)';
    s.style.transformOrigin = '0 0';
  });
})();

// ── Lenis smooth scroll (driven by GSAP's ticker) ────────────────
if (!REDUCED) {
  const lenis = new Lenis({ duration: 1.15, lerp: 0.1 });
  window.lenis = lenis;
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  // Snap addon, used by the showcase/sections where full-viewport snaps
  // make sense. No snap points registered yet; see Lenis docs in main.
  const snap = new Snap(lenis, {
    type: 'mandatory',
    duration: 1,
  });
  window.snap = snap;
}

// ── Lucide icons (replaces <i data-lucide="…">) ──────────────────
hydrateIcons();

// ── Boot everything once the DOM is ready ────────────────────────
const now = (fn) =>
  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', fn, { once: true })
    : fn();

now(() => {
  ensureSeeded();
  initAccountUI();
  initNavbar();
  initAnimations();
  initScrollStories();
  initCollage();
  initStoryCarousel();
  initHome();
  initChrome();
  initLottie();
  hydrateCartBadge();

  // Every module has registered its ScrollTriggers now (pins included): sort by
  // document position and recompute so nothing below a pinned section is offset.
  ScrollTrigger.sort();
  ScrollTrigger.refresh();

  // Accessibility: pause the hero video if reduced motion is preferred.
  if (REDUCED) {
    document.querySelectorAll('.hero__video').forEach((v) => v.pause());
  }

  // Shared inline handlers (newsletter, placeholder form actions)
  document.querySelectorAll('[data-newsletter]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      const input = form.querySelector('input[type="email"]');
      const original = btn.textContent;
      btn.textContent = 'Locked in ✓';
      btn.classList.add('btn--success');
      if (input) input.value = '';
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove('btn--success');
      }, 2200);
    });
  });

});

export { gsap, ScrollTrigger };
