/*
 * scrollstory.js, scroll-driven sections with GSAP + ScrollTrigger
 * -----------------------------------------------------------------
 * Strictly scrub-tied (no autoplay / setTimeout). Both sections skip
 * their pins under prefers-reduced-motion and fall back to a static state.
 *
 *   Section A · [data-brand-story], pinned statement → strip "blinds"
 *              image reveal → scrubbed lifestyle crossfade → payoff CTA.
 *   Section B · [data-tech-pin]    , pinned feature explorer: list item
 *              per scroll segment + crossfading portrait photo.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion } from './utils.js';

const REDUCED = prefersReducedMotion();
const MOBILE = () => window.matchMedia('(max-width: 899px)').matches;

/* ────────────────────────────────────────────────────────────────
   Section A · Brand Story
   ──────────────────────────────────────────────────────────────── */
function initBrandStory() {
  const section = document.querySelector('[data-brand-story]');
  if (!section) return;

  const stage = section.querySelector('.story-stage');
  const stripWrap = section.querySelector('.story-strips');
  const photos = gsap.utils.toArray(section.querySelectorAll('.story-photo'));
  const statement = section.querySelector('[data-story-statement]');
  const line1 = section.querySelector('[data-story-line="1"]');
  const line2 = section.querySelector('[data-story-line="2"]');
  const payoff = section.querySelector('[data-story-payoff]');
  const captions = gsap.utils.toArray(section.querySelectorAll('[data-story-caption]'));
  const route = section.querySelector('[data-story-route-progress]');
  const routeCursor = section.querySelector('[data-story-route-cursor]');
  const routeNodes = gsap.utils.toArray(section.querySelectorAll('[data-story-route-node]'));

  if (!stage || !stripWrap || !statement || !line1 || !line2 || !payoff || photos.length < 2) return;

  const baseImg = photos[0]; // rendered by the strips
  const cross = photos.slice(1); // scrubbed crossfades
  const payoffKids = gsap.utils.toArray(payoff.children);
  const routeLength = route?.getTotalLength() || 0;
  const routeMotion = { distance: 0 };
  const updateRouteCursor = () => {
    if (!routeLength || !routeCursor) return;
    const point = route.getPointAtLength(routeMotion.distance);
    routeCursor.setAttribute('cx', point.x);
    routeCursor.setAttribute('cy', point.y);
  };

  // ── Build vertical strips (fewer on mobile) ───────────────────
  const buildStrips = () => {
    stripWrap.innerHTML = '';
    const n = MOBILE() ? 6 : 10;
    const w = 100 / n;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span');
      s.className = 'story-strip';
      s.style.clipPath = `inset(0 ${100 - (i + 1) * w}% 0 ${i * w}%)`;
      s.style.backgroundImage = `url(${baseImg.getAttribute('src')})`;
      frag.appendChild(s);
    }
    stripWrap.appendChild(frag);
    return gsap.utils.toArray(stripWrap.querySelectorAll('.story-strip'));
  };

  const strips = buildStrips();

  // ── Initial states ────────────────────────────────────────────
  gsap.set(line1, { opacity: 0 });
  gsap.set(line2, { opacity: 0.3 });
  gsap.set(cross, { autoAlpha: 0 });
  gsap.set(captions, { autoAlpha: 0 });
  gsap.set(payoffKids, { autoAlpha: 0 });
  if (routeLength) {
    gsap.set(route, { strokeDasharray: routeLength, strokeDashoffset: routeLength });
    gsap.set(routeCursor, { autoAlpha: 0 });
    gsap.set(routeNodes, { autoAlpha: 0 });
    updateRouteCursor();
  }

  if (REDUCED) {
    gsap.set(strips, { yPercent: 0 });
    gsap.set(statement, { autoAlpha: 0 });
    gsap.set(cross[cross.length - 1], { autoAlpha: 1 });
    gsap.set(payoffKids, { autoAlpha: 1 });
    if (routeLength) {
      gsap.set(route, { strokeDashoffset: 0 });
      gsap.set(routeNodes, { autoAlpha: 1 });
    }
    return;
  }

  gsap.set(strips, { yPercent: -101 });

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: () => '+=' + (MOBILE() ? 200 : 330) + '%',
      pin: true,
      refreshPriority: 1, // pins refresh before reveals so triggers below them are offset correctly
      scrub: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  });

  // 1 · line 1 in, 2 · line 2 up to full opacity
  tl.to(line1, { opacity: 1, duration: 0.9 }, 0);
  tl.to(line2, { opacity: 1, duration: 0.9 }, 0.8);
  // 3 · blind reveal (staggered strips)
  tl.to(strips, { yPercent: 0, duration: 1.3, ease: 'power3.inOut', stagger: 0.07 }, 1.8);
  // 4 · first lifestyle image arrives while the statement lifts away
  tl.to(cross[0], { autoAlpha: 1, duration: 0.8 }, 3.7);
  tl.to(statement, { autoAlpha: 0, y: -36, duration: 0.9, ease: 'power2.inOut' }, 3.8);
  if (routeLength) {
    tl.to(route, { strokeDashoffset: 0, duration: 3.6 }, 3.7);
    tl.to(routeMotion, { distance: routeLength, duration: 3.6, onUpdate: updateRouteCursor }, 3.7);
    tl.to(routeCursor, { autoAlpha: 1, duration: 0.2 }, 3.7);
    tl.to(routeNodes[0], { autoAlpha: 1, duration: 0.2 }, 3.8);
    tl.to(routeNodes[1], { autoAlpha: 1, duration: 0.2 }, 5.5);
    tl.to(routeNodes[2], { autoAlpha: 1, duration: 0.2 }, 7.0);
  }
  tl.to(captions[0], { autoAlpha: 1, y: 0, duration: 0.55, ease: 'power2.out' }, 4.35);
  // 5 · scrubbed crossfades (opacity only)
  tl.to(cross[0], { autoAlpha: 0, duration: 0.8 }, 5.5);
  tl.to(cross[1], { autoAlpha: 1, duration: 0.8 }, 5.5);
  tl.to(captions[0], { autoAlpha: 0, y: -10, duration: 0.35 }, 5.5);
  tl.fromTo(captions[1], { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.55, ease: 'power2.out' }, 5.8);
  tl.to(cross[1], { autoAlpha: 0, duration: 0.8 }, 7.0);
  tl.to(cross[2], { autoAlpha: 1, duration: 0.8 }, 7.0);
  tl.to(captions[1], { autoAlpha: 0, y: -10, duration: 0.35 }, 7.0);
  tl.fromTo(captions[2], { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.55, ease: 'power2.out' }, 7.3);
  // 6 · payoff on the final image
  tl.to(captions[2], { autoAlpha: 0, y: -10, duration: 0.35 }, 8.0);
  tl.fromTo(
    payoffKids,
    { y: 28, autoAlpha: 0 },
    { y: 0, autoAlpha: 1, duration: 0.7, ease: 'power2.out', stagger: 0.1 },
    8.0,
  );
}

/* ────────────────────────────────────────────────────────────────
   Section B · Packed full of tech
   ──────────────────────────────────────────────────────────────── */
function initTechPin() {
  const section = document.querySelector('[data-tech-pin]');
  if (!section) return;

  const items = gsap.utils.toArray(section.querySelectorAll('[data-tech-item]'));
  const stage = section.querySelector('[data-tech-stage]');
  if (!items.length || !stage) return;
  const imgs = gsap.utils.toArray(stage.querySelectorAll('img'));

  const paint = (opacityFor) => {
    imgs.forEach((img, i) => {
      const o = opacityFor(i);
      img.style.opacity = o;
      img.style.visibility = o > 0.01 ? 'visible' : 'hidden';
    });
  };

  // initial → first item active, first image visible
  paint((i) => (i === 0 ? 1 : 0));
  items.forEach((item, i) => item.classList.toggle('is-active', i === 0));

  if (REDUCED) {
    items.forEach((item) => (item.style.opacity = '1'));
    return;
  }

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => '+=' + items.length * (MOBILE() ? 60 : 100) + 'vh',
    pin: true,
    refreshPriority: 1, // pins refresh before reveals so triggers below them are offset correctly
    scrub: true,
    anticipatePin: 1,
    invalidateOnRefresh: true,
    onUpdate(self) {
      const n = items.length;
      // progress * n (not n-1) so the LAST item also owns a full segment
      const pos = Math.min(n - 1, self.progress * n);
      const idx = Math.floor(pos);
      const frac = pos - idx;

      // crossfade images between the current and the next feature
      paint((i) => {
        if (i === idx) return 1 - frac;
        if (i === idx + 1) return frac;
        return 0;
      });

      items.forEach((item, i) => item.classList.toggle('is-active', i === idx));
    },
  });
}

/* ── Boot (called from main.js after DOM ready) ────────────────── */
export function initScrollStories() {
  initBrandStory();
  initTechPin();
}
