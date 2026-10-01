/*
 * home.js, Home page motion & interaction systems
 * -----------------------------------------------------------------
 *   initHeroIntro()  , staggered line-by-line headline reveal + entrance
 *   initHeroParallax(), layered depth: bg drifts slower on scroll & mouse
 *   initHeroWidget() , floating "01-04" card carousel: timer-driven
 *                       segmented progress fill, manual arrows reset it,
 *                       next card peeks from the edge
 *   initTechCarousel(), "packed full of tech" auto carousel (no pin, no overflow)
 *   initFeaturedVideos(), featured card videos play only in view
 *   initLineup()     , manual lineup carousel (no auto, no overflow):
 *                       prev/next buttons move the track one panel
 *   initRatings()    , star fill, rating bars, counters
 *
 * All systems respect prefers-reduced-motion.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion } from './utils.js';

const REDUCED = prefersReducedMotion();

/* ────────────────────────────────────────────────────────────────
   Hero intro, line-by-line masked reveal
   ──────────────────────────────────────────────────────────────── */
export function initHeroIntro() {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  if (REDUCED) return;

  const lines = gsap.utils.toArray('.hero__line-inner');
  const tl = gsap.timeline({ delay: 0.15, defaults: { ease: 'expo.out' } });

  lines.forEach((ln) => {
    tl.fromTo(ln, { yPercent: 112, rotate: 1.5 }, { yPercent: 0, rotate: 0, duration: 1.15 }, '+=0.14');
  });

  tl.fromTo(
    ['.hero__kicker', '.hero__sub', '.hero__ctas'],
    { autoAlpha: 0, y: 22 },
    { autoAlpha: 1, y: 0, duration: 0.75, stagger: 0.09, ease: 'power3.out' },
    '-=0.55',
  );
  tl.fromTo(
    '.hero-widget',
    { autoAlpha: 0, y: 46, scale: 0.97 },
    { autoAlpha: 1, y: 0, scale: 1, duration: 0.95, ease: 'expo.out' },
    '-=0.6',
  );
}

/* ────────────────────────────────────────────────────────────────
   Hero parallax, bg slower than fg (scroll + mouse)
   ──────────────────────────────────────────────────────────────── */
export function initHeroParallax() {
  const hero = document.querySelector('.hero');
  if (!hero || REDUCED) return;

  const bg = hero.querySelector('.hero__bg');
  const fg = hero.querySelector('.hero__fg');

  // Scroll: background image drifts up more slowly than the content leaves.
  if (bg) {
    gsap.fromTo(
      bg,
      { yPercent: -5 },
      {
        yPercent: 5,
        ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
      },
    );
  }
  if (fg) {
    gsap.fromTo(
      fg,
      { yPercent: 6 },
      {
        yPercent: -4,
        ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
      },
    );
  }

  // Mouse: subtle opposite drift for depth (fine pointers only).
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const bx = gsap.quickTo(bg, 'x', { duration: 1.4, ease: 'power3.out' });
  const by = gsap.quickTo(bg, 'y', { duration: 1.4, ease: 'power3.out' });
  const fx = gsap.quickTo(fg, 'x', { duration: 1.0, ease: 'power3.out' });
  const fy = gsap.quickTo(fg, 'y', { duration: 1.0, ease: 'power3.out' });

  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    const nx = e.clientX / r.width - 0.5;
    const ny = e.clientY / r.height - 0.5;
    bx(nx * -22);
    by(ny * -14);
    fx(nx * 12);
    fy(ny * 9);
  });
}

/* ────────────────────────────────────────────────────────────────
   Hero floating widget, "01 ──── 04" segmented auto-advance carousel
   ──────────────────────────────────────────────────────────────── */
export function initHeroWidget() {
  const widget = document.querySelector('.hero-widget');
  if (!widget) return;

  const cards = gsap.utils.toArray(widget.querySelectorAll('.hero-widget__card'));
  const segs = gsap.utils.toArray(widget.querySelectorAll('.hero-widget__seg'));
  const numEl = widget.querySelector('.js-hero-num');
  const cells = widget.querySelectorAll('.js-hero-cell');

  /* split-flap digit: old value flips away over the top, new value
     flips in from below, like an airport departure board */
  const flipDigit = (cell, ch) => {
    if (cell.dataset.d === ch) return;
    const from = cell.dataset.d || '';
    cell.dataset.d = ch;
    const base = cell.querySelector('.hero-num__digit');
    if (!base) return;
    if (REDUCED) { base.textContent = ch; return; }
    const oldEl = document.createElement('span');
    oldEl.className = 'hero-num__digit';
    oldEl.textContent = from;
    oldEl.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;';
    cell.appendChild(oldEl);
    base.textContent = ch;
    gsap.set(oldEl, { rotateX: 0, transformOrigin: '50% 0%', autoAlpha: 1 });
    gsap.set(base, { rotateX: 65, transformOrigin: '50% 100%', autoAlpha: 0 });
    gsap.to(oldEl, {
      rotateX: -78, autoAlpha: 0.85, duration: 0.3, ease: 'power1.in',
      onComplete: () => oldEl.remove(),
    });
    gsap.to(base, { rotateX: 0, autoAlpha: 1, duration: 0.5, delay: 0.22, ease: 'power3.out' });
  };
  const prevBtn = widget.querySelector('.js-hero-prev');
  const nextBtn = widget.querySelector('.js-hero-next');
  const n = cards.length;
  if (n < 2) return;

  const DUR = 4.0; // seconds per slide
  let idx = 0;
  let fillTl = null;
  let auto = null;

  const place = (i) => {
    // i relative to current: 0 = front, 1 = peeking behind-right
    const rel = (i - idx + n) % n;
    const card = cards[i];
    const x = rel === 0 ? 0 : rel === 1 ? 30 : -26;
    const scale = rel === 0 ? 1 : rel === 1 ? 0.955 : 0.94;
    const opacity = rel === 0 ? 1 : rel === 1 ? 0.5 : 0;
    const z = rel === 0 ? 3 : rel === 1 ? 2 : 1;
    return { x, scale, opacity, z };
  };

  const paint = (animate = true) => {
    cards.forEach((c, i) => {
      const p = place(i);
      const vars = {
        x: p.x,
        scale: p.scale,
        autoAlpha: p.opacity,
        zIndex: p.z,
        duration: animate && !REDUCED ? 0.72 : 0,
        ease: 'expo.out',
        overwrite: 'auto',
      };
      if (animate && !REDUCED) gsap.to(c, vars);
      else gsap.set(c, vars);
    });
    if (numEl) {
      const numStr = String(idx + 1).padStart(2, '0');
      numEl.setAttribute('aria-label', `Collection ${idx + 1} of ${n}`);
      cells.forEach((c, i) => flipDigit(c, numStr[i]));
    }
    // front card text re-enters on every change
    if (animate && !REDUCED) {
      const front = cards[idx];
      gsap.fromTo(
        front.querySelectorAll('.hero-widget__body b, .hero-widget__body small, .hero-widget__body .btn'),
        { y: 16, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.55, stagger: 0.07, ease: 'power3.out', delay: 0.12, overwrite: 'auto' },
      );
    }
  };

  const resetSegs = () => segs.forEach((s, i) => gsap.set(s, { '--sw': i === idx ? 0 : 1 }));

  const startTimer = () => {
    stopTimer();
    if (REDUCED) {
      gsap.set(segs[idx], { '--sw': 1 });
      return;
    }
    fillTl = gsap.to(segs[idx], { '--sw': 1, duration: DUR, ease: 'none' });
    auto = gsap.delayedCall(DUR, () => step(1));
  };

  const stopTimer = () => {
    if (fillTl) fillTl.kill();
    if (auto) auto.kill();
    fillTl = null;
    auto = null;
  };

  const step = (dir) => {
    stopTimer();
    // completed segment stays full until we leave it, then clears
    gsap.set(segs[idx], { '--sw': 1 });
    idx = (idx + dir + n) % n;
    resetSegs();
    paint(true);
    startTimer();
  };

  prevBtn.addEventListener('click', () => step(-1));
  nextBtn.addEventListener('click', () => step(1));

  // hover pause, feels deliberate, keeps the timer honest
  widget.addEventListener('pointerenter', stopTimer);
  widget.addEventListener('pointerleave', () => {
    // restart the remaining fill from current width
    if (REDUCED) return;
    const s = segs[idx];
    const from = parseFloat(getComputedStyle(s).getPropertyValue('--sw')) || 0;
    fillTl = gsap.to(s, { '--sw': 1, duration: DUR * (1 - from), ease: 'none' });
    auto = gsap.delayedCall(DUR * (1 - from), () => step(1));
  });

  // initial paint
  paint(false);
  resetSegs();
  startTimer();
}

/* ────────────────────────────────────────────────────────────────
   Lineup, manual carousel (prev/next buttons, no auto, no overflow)
   ──────────────────────────────────────────────────────────────── */
export function initLineup() {
  const section = document.querySelector('[data-lineup]');
  if (!section) return;

  const track = section.querySelector('.lineup__track');
  const panels = gsap.utils.toArray(track.children);
  const prevBtn = section.querySelector('.js-lineup-prev');
  const nextBtn = section.querySelector('.js-lineup-next');
  const countEl = section.querySelector('.js-lineup-count');
  const bar = section.querySelector('.js-lineup-bar');
  if (panels.length < 2) return;

  let idx = 0;

  const step = () => {
    const gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 0;
    return panels[0].getBoundingClientRect().width + gap;
  };

  const go = (n, animate = true) => {
    idx = Math.max(0, Math.min(panels.length - 1, n));
    const x = -(idx * step());
    if (animate && !REDUCED) {
      gsap.to(track, { x, duration: 0.85, ease: 'expo.inOut', overwrite: 'auto' });
    } else {
      gsap.set(track, { x });
    }
    if (countEl) countEl.textContent = String(idx + 1).padStart(2, '0');
    if (bar) gsap.to(bar, { scaleX: (idx + 1) / panels.length, duration: 0.6, ease: 'power3.out' });
    panels.forEach((p, i) => p.setAttribute('aria-hidden', String(i !== idx)));
    if (prevBtn) prevBtn.disabled = idx === 0;
    if (nextBtn) nextBtn.disabled = idx === panels.length - 1;
  };

  prevBtn.addEventListener('click', () => go(idx - 1));
  nextBtn.addEventListener('click', () => go(idx + 1));

  // keep the active panel aligned across viewport changes
  let rT;
  window.addEventListener('resize', () => {
    clearTimeout(rT);
    rT = setTimeout(() => go(idx, false), 120);
  });

  go(0, false);
}

/* ────────────────────────────────────────────────────────────────
   Ratings, star fill + distribution bars
   ──────────────────────────────────────────────────────────────── */
export function initRatings() {
  const section = document.querySelector('.ratings');
  if (!section) return;

  // big score stars (4.9 → last star 90% filled)
  const stars = section.querySelectorAll('.ratings__score .star');
  if (stars.length && !REDUCED) {
    gsap.utils.toArray(section.querySelectorAll('.ratings__score .star .star-fill')).forEach((f, i) => {
      const pct = i < 4 ? 100 : 90;
      gsap.fromTo(
        f,
        { scaleX: 0 },
        {
          scaleX: pct / 100,
          duration: 1.1,
          delay: 0.3 + i * 0.12,
          ease: 'power3.out',
          scrollTrigger: { trigger: section, start: 'top 78%', once: true },
        },
      );
    });
  }

  // distribution bars fill in on scroll
  const bars = section.querySelectorAll('.ratings__bar-fill');
  if (bars.length) {
    bars.forEach((b) => {
      const w = b.dataset.w || '100%';
      b.style.width = '0%';
      if (REDUCED) {
        b.style.width = w;
        return;
      }
      gsap.to(b, {
        width: w,
        duration: 1.3,
        ease: 'expo.out',
        scrollTrigger: { trigger: b.closest('.ratings__dist'), start: 'top 85%', once: true },
      });
    });
  }
}

/* ── Boot (called from main.js after DOM ready) ────────────────── */
export function initHome() {
  initHeroIntro();
  initHeroParallax();
  initHeroWidget();
  initLineup();
  initRatings();
  initTechCarousel();
  initFeaturedVideos();
  initCrossing();
  initHowSteps();
  initSeam();
}

/* Outline word drifts sideways with scroll (scrub, transform only). */
function initSeam() {
  const word = document.querySelector('[data-seam-word]');
  if (!word || REDUCED) return;
  gsap.fromTo(word, { xPercent: 6 }, {
    xPercent: -28, ease: 'none',
    scrollTrigger: { trigger: word.closest('[data-seam]'), start: 'top bottom', end: 'bottom top', scrub: 0.8, invalidateOnRefresh: true },
  });
}

/* ────────────────────────────────────────────────────────────────
   The Crossing, the lane draws itself and the ship sails along it
   as the section scrolls through. Motivated: it narrates the sea
   leg the copy describes. Stamps draw their ring on entry, replay
   on every entry (site-wide replay rule).
   ──────────────────────────────────────────────────────────────── */
function initHowSteps() {
  const steps = document.querySelectorAll('.how-step');
  if (!steps.length) return;
  if (typeof IntersectionObserver !== 'function') { steps.forEach((el) => el.classList.add('is-in')); return; }
  const io = new IntersectionObserver((entries) => entries.forEach((e) => e.target.classList.toggle('is-in', e.isIntersecting)), { threshold: 0.4 });
  steps.forEach((el) => io.observe(el));
}

function initCrossing() {
  const sec = document.querySelector('[data-crossing]');
  if (!sec) return;
  const lane = sec.querySelector('.crossing__lane--draw');
  const ship = sec.querySelector('[data-crossing-ship]');
  const svg = sec.querySelector('.crossing__svg');
  const stamps = sec.querySelectorAll('.stamp');

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => e.target.classList.toggle('is-in', e.isIntersecting)), { threshold: 0.35 });
    stamps.forEach((st) => io.observe(st));
  } else stamps.forEach((st) => st.classList.add('is-in'));

  if (!lane || !ship || !svg || typeof lane.getTotalLength !== 'function') return;
  const len = lane.getTotalLength();
  lane.style.strokeDasharray = String(len);
  lane.style.strokeDashoffset = String(len);

  const place = (p) => {
    const pt = lane.getPointAtLength(len * p);
    const vb = svg.viewBox.baseVal;
    const r = svg.getBoundingClientRect();
    const x = (pt.x / vb.width) * r.width;
    const y = (pt.y / vb.height) * r.height;
    ship.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
  };

  if (REDUCED) { lane.style.strokeDashoffset = '0'; place(1); return; }
  const state = { p: 0 };
  place(0);
  gsap.to(state, {
    p: 1,
    ease: 'none',
    scrollTrigger: { trigger: sec.querySelector('.crossing__map'), start: 'top 85%', end: 'bottom 35%', scrub: 0.6, invalidateOnRefresh: true },
    onUpdate: () => { lane.style.strokeDashoffset = String(len * (1 - state.p)); place(state.p); },
  });
  window.addEventListener('resize', () => place(state.p), { passive: true });
}

/* ────────────────────────────────────────────────────────────────
   Featured picks, autoplay card videos only while on screen
   ──────────────────────────────────────────────────────────────── */
function initFeaturedVideos() {
  const vids = document.querySelectorAll('.product-card__vid');
  if (!vids.length) return;
  if (REDUCED || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const v = e.target;
      if (e.isIntersecting) v.play().catch(() => {});
      else v.pause();
    });
  }, { threshold: 0.3 });
  vids.forEach((v) => io.observe(v));
}

/* ────────────────────────────────────────────────────────────────
   Tech feature wall, contained auto-advancing carousel.
   One viewport-clipped track, variable-width slides, arrows reset
   the timer, progress bar fills per slide. No pin, no overflow.
   ──────────────────────────────────────────────────────────────── */
function initTechCarousel() {
  const root = document.querySelector('[data-tech-carousel]');
  if (!root) return;
  const track = root.querySelector('.js-showcase-track');
  const panels = gsap.utils.toArray(track.querySelectorAll('.showcase__panel'));
  const bar = root.querySelector('.js-showcase-bar');
  const idxEl = root.querySelector('.js-showcase-i');
  const prevBtn = root.querySelector('.js-showcase-prev');
  const nextBtn = root.querySelector('.js-showcase-next');
  const n = panels.length;
  if (n < 2 || !prevBtn || !nextBtn) return;

  const DUR = 4.6;
  let i = 0;
  let auto = null;
  let barTween = null;
  let inView = true;

  const offset = (k) => {
    const r = panels[k].getBoundingClientRect();
    const t = track.getBoundingClientRect();
    return r.left - t.left;
  };

  const barFrom = () => {
    if (!bar) return 0;
    try {
      const m = new DOMMatrixReadOnly(getComputedStyle(bar).transform);
      return m.a || 0;
    } catch { return 0; }
  };

  const go = (k, animate = true) => {
    i = (k + n) % n;
    if (idxEl) idxEl.textContent = String(i + 1).padStart(2, '0');
    const x = -offset(i);
    if (animate && !REDUCED) gsap.to(track, { x, duration: 0.95, ease: 'expo.out', overwrite: 'auto' });
    else gsap.set(track, { x });
    if (barTween) { barTween.kill(); barTween = null; }
    if (bar) {
      if (REDUCED) gsap.set(bar, { scaleX: (i + 1) / n });
      else barTween = gsap.fromTo(bar, { scaleX: i / n }, { scaleX: (i + 1) / n, duration: DUR, ease: 'none' });
    }
    if (animate && !REDUCED) {
      gsap.fromTo(
        panels[i].querySelectorAll('h3, p, .showcase__num, .btn'),
        { y: 18, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.6, stagger: 0.06, ease: 'power3.out', delay: 0.18, overwrite: 'auto' },
      );
    }
  };

  const startAuto = () => {
    stopAuto();
    if (REDUCED || !inView) return;
    auto = gsap.delayedCall(DUR, () => go(i + 1));
    if (barTween && !barTween.isActive()) {
      const from = barFrom();
      const target = (i + 1) / n;
      const remain = DUR * Math.max(target - from, 0.02);
      barTween = gsap.to(bar, { scaleX: target, duration: remain, ease: 'none' });
    }
  };
  const stopAuto = () => {
    if (auto) { auto.kill(); auto = null; }
    if (barTween) { barTween.kill(); barTween = null; }
  };

  prevBtn.addEventListener('click', () => { go(i - 1); startAuto(); });
  nextBtn.addEventListener('click', () => { go(i + 1); startAuto(); });

  window.addEventListener('resize', () => gsap.set(track, { x: -offset(i) }));

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => {
      es.forEach((e) => {
        inView = e.isIntersecting;
        if (inView) startAuto();
        else stopAuto();
      });
    }, { threshold: 0.2 }).observe(root);
  }

  go(0, false);
  startAuto();
}
