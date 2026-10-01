/*
 * animations.js, GSAP + ScrollTrigger motion systems
 * -----------------------------------------------------------------
 * Every animation is built on ScrollTrigger with sensible defaults and is
 * skipped when prefers-reduced-motion is on. Systems provided:
 *
 *   splitHeadline()  , SplitText-style word/char reveals (load + scroll)
 *   reveal()         , staggered [data-reveal] children fade+rise
 *   maskImage()      , clip-path image reveals on enter viewport
 *   parallax()       , layered hero parallax (bg slower than fg)
 *   pinShowcase()    , pinned horizontal bike showcase (Home)
 *   counter()        , animated number counters on scroll into view
 *   marquee()        , infinite marquee loop
 *   magneticButtons(), primary CTAs pulled toward the cursor
 *   cursor()         , physical cursor: spring ring, magnet/label/media/text states
 *   progress()       , scroll progress bar tied to Lenis
 *   transitions()    , MPA page wipe between navigations
 */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion } from './utils.js';

const REDUCED = prefersReducedMotion();
let inited = false;

/* ────────────────────────────────────────────────────────────────
   splitText, break an element into word (and inner char) spans,
   preserving <br> line breaks. Returns false if already processed.
   ──────────────────────────────────────────────────────────────── */
function splitText(el) {
  if (el.dataset.splitDone) return false;
  el.dataset.splitDone = 'true';

  // Flatten inline content into lines (null = <br> boundary)
  const lines = [[]];
  const walk = (node, current) => {
    node.childNodes.forEach((c) => {
      if (c.nodeType === 3) {
        c.textContent
          .split(/\s+/)
          .filter(Boolean)
          .forEach((w) => current.push(w));
      } else if (c.nodeType === 1 && c.tagName === 'BR') {
        lines.push([]);
      } else if (c.nodeType === 1 && c.tagName !== 'SCRIPT') {
        walk(c, current);
      }
    });
  };
  walk(el, lines[0]);

  const allWords = lines.flat();
  if (!allWords.length) return false;

  el.setAttribute('aria-label', allWords.join(' '));
  el.textContent = '';

  const makeWord = (word) => {
    const ws = document.createElement('span');
    ws.className = 'word';
    ws.setAttribute('aria-hidden', 'true');
    word.split('').forEach((ch) => {
      const cs = document.createElement('span');
      cs.className = 'char';
      cs.textContent = ch;
      ws.appendChild(cs);
    });
    return ws;
  };

  lines.forEach((line, li) => {
    line.forEach((word, wi) => {
      el.appendChild(makeWord(word));
      if (wi < line.length - 1) el.appendChild(document.createTextNode(' '));
    });
    if (li < lines.length - 1 && lines[li + 1].length) el.appendChild(document.createElement('br'));
  });
  return true;
}

/* ────────────────────────────────────────────────────────────────
   splitHeadline, headline reveals animating words/characters in on
   load and again on scroll into view.
   ──────────────────────────────────────────────────────────────── */
export function splitHeadline(selector = 'h1, h2, h3, .display, .h-display, [data-split]', opts = {}) {
  if (REDUCED) return;
  const els = gsap.utils.toArray(selector);
  els.forEach((el) => {
    // children own their animation (e.g. hero line spans)
    if (el.querySelector('[data-split]')) return;
    if (el.closest('[data-no-split]')) return;
    // don't mangle interactive/structural content
    // icons/images inside a heading would be dropped by the word walk
    if (el.querySelector('a, button, output, input, [data-count], svg, img, i[data-lucide]')) return;
    if (!splitText(el)) return;

    const targets = el.querySelectorAll('.char');
    if (!targets.length) return;
    const delay = parseFloat(el.dataset.delay || opts.delay || 0);

    const tween = gsap.fromTo(
      targets,
      { yPercent: 120, rotate: 5, opacity: 0 },
      {
        yPercent: 0,
        rotate: 0,
        opacity: 1,
        duration: 0.9,
        ease: 'expo.out',
        stagger: { each: 0.02, from: 'start' },
        delay,
        immediateRender: true,
        paused: true,
      },
    );
    replayable(el, opts.start ?? 'top 88%', tween);
  });
}

/* ────────────────────────────────────────────────────────────────
   reveal, [data-reveal] elements plus parent-driven [data-stagger]
   ──────────────────────────────────────────────────────────────── */
/* Replay-on-entry helper: the tween is built paused at its "from" state,
   played when the trigger enters the viewport, and reset when it leaves in
   either direction, so the animation runs every single time the element
   scrolls into view, not just once. */
function replayable(triggerEl, start, tween) {
  ScrollTrigger.create({
    trigger: triggerEl,
    start,
    onEnter: () => tween.play(),
    onEnterBack: () => tween.play(0),   // coming back up from below: replay, don't stay blank
    onLeave: () => tween.pause(0),
    onLeaveBack: () => tween.pause(0),
  });
}

export function reveal() {
  if (REDUCED) return;
  gsap.utils.toArray('[data-reveal]').forEach((el) => {
    const tween = gsap.fromTo(
      el,
      { y: 28, autoAlpha: 0 },
      {
        y: 0,
        autoAlpha: 1,
        duration: 0.85,
        ease: 'power3.out',
        immediateRender: true,
        paused: true,
      },
    );
    replayable(el, 'top 88%', tween);
  });

  gsap.utils.toArray('[data-stagger]').forEach((group) => {
    const items = Array.from(group.children).filter(
      (c) => !c.hasAttribute('data-reveal') && !c.hasAttribute('data-split'),
    );
    if (!items.length) return;
    const amt = parseFloat(group.dataset.stagger || '0.08');
    const axis = group.dataset.staggerAxis || 'y';
    const dist = axis === 'y' ? 30 : 40;
    const from = { opacity: 0 };
    from[axis === 'y' ? 'y' : 'x'] = dist;
    const tween = gsap.fromTo(
      items,
      from,
      {
        opacity: 1,
        [axis]: 0,
        duration: 0.8,
        ease: 'power3.out',
        stagger: amt,
        immediateRender: true,
        paused: true,
      },
    );
    replayable(group, 'top 85%', tween);
  });
}

/* ────────────────────────────────────────────────────────────────
   maskImage, clip-path reveals (no plain fades)
   ──────────────────────────────────────────────────────────────── */
export function maskImage() {
  if (REDUCED) return;
  gsap.utils.toArray('[data-mask]').forEach((el) => {
    const dir = el.dataset.mask || 'up';
    const fromMap = {
      up: 'polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)',
      left: 'polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%)',
      right: 'polygon(100% 0%, 100% 0%, 100% 100%, 100% 100%)',
      none: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)',
    };
    const tween = gsap.fromTo(
      el,
      { clipPath: fromMap[dir] || fromMap.up },
      {
        clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)',
        duration: 1.15,
        ease: 'expo.inOut',
        immediateRender: true,
        paused: true,
      },
    );
    replayable(el, 'top 82%', tween);
  });
}

/* ────────────────────────────────────────────────────────────────
   parallax, [data-par-img] images drift slower than foreground.
   scale is preserved inside the tween so GSAP doesn't strip the CSS
   pre-scale used for parallax headroom.
   ──────────────────────────────────────────────────────────────── */
export function parallax() {
  if (REDUCED) return;
  gsap.utils.toArray('[data-par-img]').forEach((el) => {
    gsap.fromTo(
      el,
      { yPercent: -10, scale: 1.12 },
      {
        yPercent: 10,
        scale: 1.12,
        ease: 'none',
        scrollTrigger: {
          trigger: el.closest('section') || el.parentElement,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      },
    );
  });
  gsap.utils.toArray('[data-par]').forEach((el) => {
    const speed = parseFloat(el.dataset.speed || '0.2');
    const dist = 60 * speed;
    gsap.fromTo(
      el,
      { y: dist },
      {
        y: -dist,
        ease: 'none',
        scrollTrigger: {
          trigger: el.parentElement,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      },
    );
  });

  // Hero background video: subtle scrub so it drifts slower than content.
  gsap.utils.toArray('.hero__video').forEach((el) => {
    gsap.fromTo(
      el,
      { scale: 1.12, yPercent: -2 },
      {
        scale: 1.12,
        yPercent: 2,
        ease: 'none',
        scrollTrigger: {
          trigger: el.closest('.hero'),
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      },
    );
  });
}

/* ────────────────────────────────────────────────────────────────
   pinShowcase, home pinned horizontal bike showcase
   ──────────────────────────────────────────────────────────────── */
export function pinShowcase() {
  const section = document.querySelector('[data-showcase]');
  if (!section) return;
  const track = section.querySelector('.showcase__track');
  if (!track) return;

  const isDesktop = window.matchMedia('(min-width: 880px)').matches;
  if (REDUCED || !isDesktop) {
    section.style.overflowX = 'auto';
    track.style.width = 'max-content';
    return;
  }

  const getDist = () => track.scrollWidth - window.innerWidth + 48;

  gsap.to(track, {
    x: () => -getDist(),
    ease: 'none',
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: () => '+=' + getDist() * 1.05,
      pin: true,
      refreshPriority: 1, // pins refresh before reveals so triggers below them are offset correctly
      scrub: 1,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  });

  const bar = section.querySelector('.showcase__progress-bar');
  if (bar) {
    gsap.fromTo(
      bar,
      { scaleX: 0 },
      {
        scaleX: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: () => '+=' + getDist() * 1.05,
          scrub: true,
        },
      },
    );
  }
}

/* ────────────────────────────────────────────────────────────────
   counter, number counters on scroll into view
   ──────────────────────────────────────────────────────────────── */
export function counter() {
  const els = gsap.utils.toArray('[data-count]');
  els.forEach((el) => {
    const end = parseFloat(el.dataset.count);
    const decimals = (el.dataset.decimals || '').length || 0;
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const dur = parseFloat(el.dataset.duration || '1.8');
    const obj = { v: 0 };
    if (REDUCED) {
      el.textContent = prefix + end.toLocaleString('en-US', { maximumFractionDigits: decimals }) + suffix;
      return;
    }
    el.textContent = prefix + (0).toLocaleString('en-US', { maximumFractionDigits: decimals }) + suffix;
    const tween = gsap.to(obj, {
      v: end,
      duration: dur,
      ease: 'expo.out',
      immediateRender: true,
      paused: true,
      onUpdate: () => {
        el.textContent =
          prefix + obj.v.toLocaleString('en-US', { maximumFractionDigits: decimals }) + suffix;
      },
    });
    replayable(el, 'top 88%', tween);
  });
}

/* ────────────────────────────────────────────────────────────────
   marquee, infinite loop
   ──────────────────────────────────────────────────────────────── */
export function marquee() {
  if (REDUCED) return;
  document.querySelectorAll('[data-marquee]').forEach((el) => {
    const inner = el.querySelector('.marquee__inner');
    if (!inner) return;
    const half = inner.scrollWidth / 2;
    gsap.to(inner, {
      x: -half,
      ease: 'none',
      duration: parseFloat(el.dataset.marquee || '28'),
      repeat: -1,
    });
  });
}

/* ────────────────────────────────────────────────────────────────
   magneticButtons, subtle pull on primary CTAs
   ──────────────────────────────────────────────────────────────── */
export function magneticButtons() {
  if (REDUCED || !window.matchMedia('(hover: hover)').matches) return;
  gsap.utils.toArray('[data-magnetic]').forEach((btn) => {
    const strength = parseFloat(btn.dataset.magnetic || '0.35');
    const xTo = gsap.quickTo(btn, 'x', { duration: 0.4, ease: 'power3.out' });
    const yTo = gsap.quickTo(btn, 'y', { duration: 0.4, ease: 'power3.out' });
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * strength);
      yTo((e.clientY - (r.top + r.height / 2)) * strength);
    });
    btn.addEventListener('pointerleave', () => {
      xTo(0);
      yTo(0);
    });
  });
}

/* ────────────────────────────────────────────────────────────────
   cursor, a physical pointer with contextual states
   ----------------------------------------------------------------
   Two layers: a tight accent dot (where the pointer really is) and a
   ring that trails on a critically-damped spring, squashing along
   its own velocity like something with mass.

   The ring reads the page and changes shape:
     magnet  , snaps to and wraps buttons/nav links (their own radius),
               following the pointer inside by a few px
     label   , accent disc with icon + verb over rich targets
               (View, Play, Read, Zoom, Drag, Open)
     media   , large white disc in difference blend over imagery
     text    , I-beam sized to the text's line height
     link    , inline text links, ring tightens and takes the accent
     press   , pointerdown compresses, release pops
   Native cursor is hidden only while the custom one is active; it
   comes back the moment the pointer leaves the window. Touch and
   reduced-motion users never see any of this.
   ──────────────────────────────────────────────────────────────── */
const CURSOR_ICONS = {
  view: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  read: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  zoom: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/><path d="M11 8v6"/><path d="M8 11h6"/>',
  drag: '<path d="M8 8 4 12l4 4"/><path d="m16 8 4 4-4 4"/><path d="M4 12h16"/>',
  open: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
  add: '<path d="M12 5v14"/><path d="M5 12h14"/>',
};
const CURSOR_VERBS = { view: 'View', play: 'Play', read: 'Read', zoom: 'Zoom', drag: 'Drag', open: 'Open', add: 'Add' };

export function cursor() {
  if (REDUCED || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const dot = document.querySelector('.cursor-dot');
  const ring = document.querySelector('.cursor-ring');
  if (!dot || !ring) return;

  /* build the ring's inner parts once */
  ring.innerHTML = '';
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('class', 'cursor-ring__icon');
  icon.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  label.className = 'cursor-ring__label';
  ring.append(icon, label);

  /* ---- selectors, in priority order ---- */
  const MAGNET_SEL = '.btn, button:not(.js-no-magnet), [role="button"], .nav-link, .icon-btn, .btn-icon, .menu-btn, .pill, .chip, [data-cursor="magnet"], select';
  const LABEL_SEL = '[data-cursor-label], [data-cursor]:not([data-cursor="magnet"]):not([data-cursor="none"]), .product-card, .lineup__panel, .journal__card, .gallery-main, .hero-widget__card, a[target="_blank"]';
  const MEDIA_SEL = 'img, video, picture, canvas, .showcase__media, .story-photo, .collage-card, figure';
  const TEXT_SEL = 'p, h1, h2, h3, h4, h5, h6, li, dt, dd, blockquote, figcaption, small, time, .kicker, .eyebrow';
  const INPUT_SEL = 'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="submit"]):not([type="button"]), textarea';
  const LINK_SEL = 'a, label, summary, input[type="checkbox"], input[type="radio"], input[type="range"]';

  const kindFor = (el) => {
    if (el.dataset.cursor && CURSOR_ICONS[el.dataset.cursor]) return el.dataset.cursor;
    if (el.matches('a[target="_blank"]')) return 'open';
    if (el.classList.contains('journal__card')) return 'read';
    if (el.classList.contains('gallery-main')) return 'zoom';
    if (el.querySelector && el.querySelector('video')) return 'play';
    return 'view';
  };

  /* ---- state ---- */
  const px = { x: innerWidth / 2, y: innerHeight / 2 };       // real pointer
  const cur = { x: px.x, y: px.y, vx: 0, vy: 0, w: 36, h: 36, r: 18, sx: 1, sy: 1, rot: 0 }; // ring, simulated
  const target = { w: 36, h: 36, r: 18 };
  let mode = 'default';
  let el = null;            // element the ring is reacting to
  let pressed = false;
  let visible = false;
  let idleT = 0;

  const setMode = (m, node = null, kind = null) => {
    if (m === mode && node === el) return;
    mode = m; el = node;
    ring.dataset.mode = m;
    dot.dataset.mode = m;
    if (m === 'label' && kind) {
      icon.innerHTML = CURSOR_ICONS[kind];
      label.textContent = node.dataset.cursorLabel || CURSOR_VERBS[kind];
    }
    ring.classList.toggle('is-label', m === 'label');
    ring.classList.toggle('is-hover', m === 'link' || m === 'magnet');
  };

  const resolve = (node) => {
    if (!node || node.nodeType !== 1) return setMode('default');
    if (node.closest('[data-cursor="none"]')) return setMode('hidden');
    const magnet = node.closest(MAGNET_SEL);
    if (magnet) return setMode('magnet', magnet);
    const lab = node.closest(LABEL_SEL);
    if (lab) return setMode('label', lab, kindFor(lab));
    const input = node.closest(INPUT_SEL);
    if (input) return setMode('text', input);
    const link = node.closest(LINK_SEL);
    if (link) return setMode('link', link);
    const media = node.closest(MEDIA_SEL);
    if (media) return setMode('media', media);
    const text = node.closest(TEXT_SEL);
    if (text && text.textContent.trim()) return setMode('text', text);
    setMode('default');
  };

  /* ---- geometry per mode ---- */
  const radiusOf = (node, h) => {
    const v = parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0;
    return Math.min(v + 6, h / 2);
  };
  const measure = () => {
    if (mode === 'magnet' && el) {
      const b = el.getBoundingClientRect();
      if (!b.width) return setMode('default');
      target.w = b.width + 12; target.h = b.height + 12; target.r = radiusOf(el, target.h);
      target.x = b.left + b.width / 2 + (px.x - (b.left + b.width / 2)) * 0.12;
      target.y = b.top + b.height / 2 + (px.y - (b.top + b.height / 2)) * 0.12;
      return;
    }
    if (mode === 'text' && el) {
      const cs = getComputedStyle(el);
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3 || 24;
      target.w = 2; target.h = Math.min(Math.max(lh * 0.9, 16), 120); target.r = 1;
    } else if (mode === 'label') { target.w = target.h = 92; target.r = 46; }
    else if (mode === 'media') { target.w = target.h = 80; target.r = 40; }
    else if (mode === 'link') { target.w = target.h = 22; target.r = 11; }
    else if (mode === 'hidden') { target.w = target.h = 0; target.r = 0; }
    else { target.w = target.h = 36; target.r = 18; }
    target.x = px.x; target.y = px.y;
  };

  /* ---- spring integrator (critically damped, frame-rate independent) ---- */
  const SPRING = { k: 260, d: 32 };      // stiffness / damping
  let last = performance.now();
  const tick = () => {
    const now = performance.now();
    const dt = Math.min(0.032, (now - last) / 1000) || 0.016;
    last = now;
    measure();

    const ax = (target.x - cur.x) * SPRING.k - cur.vx * SPRING.d;
    const ay = (target.y - cur.y) * SPRING.k - cur.vy * SPRING.d;
    cur.vx += ax * dt; cur.vy += ay * dt;
    cur.x += cur.vx * dt; cur.y += cur.vy * dt;

    const ease = mode === 'magnet' ? 0.28 : 0.18;
    cur.w += (target.w - cur.w) * ease;
    cur.h += (target.h - cur.h) * ease;
    cur.r += (target.r - cur.r) * ease;

    /* velocity squash: only when the ring is a free-floating disc */
    const speed = Math.hypot(cur.vx, cur.vy);
    const free = mode === 'default' || mode === 'media';
    const stretch = free ? Math.min(speed / 2400, 0.42) : 0;
    const tsx = 1 + stretch, tsy = 1 - stretch * 0.55;
    cur.sx += (tsx - cur.sx) * 0.3; cur.sy += (tsy - cur.sy) * 0.3;
    if (free && speed > 40) cur.rot = Math.atan2(cur.vy, cur.vx) * 180 / Math.PI;
    else if (!free) cur.rot = 0;

    const press = pressed ? 0.86 : 1;
    idleT = speed < 6 ? idleT + dt : 0;
    const breathe = mode === 'default' && idleT > 1.6 ? 1 + Math.sin(now / 420) * 0.05 : 1;

    gsap.set(ring, {
      x: cur.x, y: cur.y, width: cur.w, height: cur.h, borderRadius: cur.r,
      rotation: cur.rot, scaleX: cur.sx * press * breathe, scaleY: cur.sy * press * breathe,
      xPercent: -50, yPercent: -50,
    });
    gsap.set(dot, { x: px.x, y: px.y, xPercent: -50, yPercent: -50, scale: pressed ? 0.6 : 1 });
  };

  /* ---- events ---- */
  const show = () => { if (!visible) { visible = true; document.documentElement.classList.add('cursor-on'); ring.classList.add('is-on'); dot.classList.add('is-on'); } };
  const hide = () => { visible = false; document.documentElement.classList.remove('cursor-on'); ring.classList.remove('is-on'); dot.classList.remove('is-on'); };

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    px.x = e.clientX; px.y = e.clientY;
    if (!visible) { cur.x = px.x; cur.y = px.y; show(); }
  }, { passive: true });
  document.addEventListener('pointerover', (e) => resolve(e.target));
  document.addEventListener('pointerdown', (e) => { if (e.button === 0) pressed = true; });
  window.addEventListener('pointerup', () => { pressed = false; });
  document.documentElement.addEventListener('mouseleave', hide);
  document.documentElement.addEventListener('mouseenter', show);
  window.addEventListener('blur', () => { pressed = false; });
  /* scrolling under a still pointer changes what's beneath it */
  let scrollRaf = 0;
  window.addEventListener('scroll', () => {
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => { scrollRaf = 0; if (visible) resolve(document.elementFromPoint(px.x, px.y)); });
  }, { passive: true });

  gsap.ticker.add(tick);
}

/* ────────────────────────────────────────────────────────────────
   progress, scroll progress bar tied to Lenis scroll position
   ──────────────────────────────────────────────────────────────── */
export function progress() {
  const bar = document.querySelector('.scroll-progress__bar');
  if (!bar) return;
  if (REDUCED || !window.lenis) {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return;
  }
  window.lenis.on('scroll', ({ progress }) => {
    bar.style.transform = `scaleX(${progress})`;
  });
}

/* ────────────────────────────────────────────────────────────────
   transitions, MPA page wipe. Wipe in on leave; on arrival (if we
   came from an internal navigation) curtains part to reveal the page.
   ──────────────────────────────────────────────────────────────── */
export function transitions() {
  const overlay = document.querySelector('.page-curtains');
  if (!overlay) return;
  const spans = Array.from(overlay.children);
  spans.forEach((s, i) => s.style.setProperty('--i', i));
  if (REDUCED) return;

  const isInternal = (href) => {
    if (!href) return false;
    if (/^(https?:)?\/\//.test(href) || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return false;
    if (href.startsWith('/')) return true;
    return false;
  };

  const cover = () => {
    overlay.classList.add('is-active');
    spans.forEach((s) => {
      s.style.transition = 'none';
      s.style.transform = 'scaleY(1)';
      s.style.transformOrigin = '0 0';
    });
  };
  const reveal = () => {
    overlay.classList.remove('is-active');
    spans.forEach((s, i) => {
      s.style.transformOrigin = '0 100%';
      s.style.transition = `transform 1s cubic-bezier(0.76,0,0.24,1) ${i * 40}ms`;
      s.style.transform = 'scaleY(0)';
    });
    setTimeout(() => {
      spans.forEach((s) => {
        s.style.transition = '';
        s.style.transform = '';
      });
    }, 1200);
  };

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const href = a.getAttribute('href');
    if (!isInternal(href)) return;
    e.preventDefault();
    cover();
    sessionStorage.setItem('__soko-wipe', '1');
    const dest = href === '' ? '/' : href;
    setTimeout(() => {
      window.location.href = dest;
    }, 700);
  });

  window.addEventListener('pageshow', (event) => {
    const wipe = sessionStorage.getItem('__soko-wipe');
    sessionStorage.removeItem('__soko-wipe');
    if (!wipe && !event.persisted) return;
    cover();
    requestAnimationFrame(() =>
      requestAnimationFrame(() => reveal()),
    );
  });
}

/* ────────────────────────────────────────────────────────────────
   init, call from main.js once the DOM is ready
   ──────────────────────────────────────────────────────────────── */
export function initAnimations() {
  if (inited) return;
  inited = true;

  splitHeadline();
  reveal();
  maskImage();
  parallax();
  pinShowcase();
  counter();
  marquee();
  magneticButtons();
  cursor();
  progress();
  transitions();
}
