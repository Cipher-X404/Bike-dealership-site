/*
 * storycarousel.js, pinned 4-tab scroll-driven story sequence
 * -----------------------------------------------------------------
 * Single ScrollTrigger, pin: true, end "+=400%".
 * self.progress (0 → 1) is mapped onto 4 equal segments; one segment per
 * tab. The active tab's progress bar fills with scroll, completed tabs
 * stay full (success accent), scrubbing backwards reverses everything.
 *
 * Tab clicks use ScrollTrigger.scroll() to the platform's exact scroll
 * position so click state and scroll state never desync.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion } from './utils.js';

const REDUCED = prefersReducedMotion();

export function initStoryCarousel() {
  const section = document.querySelector('.storycarousel');
  if (!section) return;

  const tabs = gsap.utils.toArray(section.querySelectorAll('.story-tab'));
  const fills = gsap.utils.toArray(section.querySelectorAll('.story-tab__fill'));
  const bits = gsap.utils.toArray(section.querySelectorAll('.story-copy__bit'));
  const media = gsap.utils.toArray(section.querySelectorAll('.story-media [data-story-media]'));
  const inset = section.querySelector('.story-inset');
  const live = section.querySelector('.story-live');
  // videos keyed by the tab they belong to (inset video = 0, quality-check bg = 1)
  const videos = gsap.utils.toArray(section.querySelectorAll('video[data-story-video-on]'));

  const syncVideos = (idx) => {
    videos.forEach((v) => {
      const on = Number(v.dataset.storyVideoOn) === idx;
      if (on && v._paused !== false) {
        v.play().catch(() => {});
        v._paused = false;
      } else if (!on && v._paused !== true) {
        v.pause();
        v._paused = true;
      }
    });
  };

  const N = tabs.length || 4;
  if (N < 2) return;

  // ── initial paint: tab 1 active, its media visible ─────────────
  const setVisible = (idx) => {
    media.forEach((m, i) => {
      m.style.opacity = i === idx ? '1' : '0';
      m.style.visibility = i === idx ? 'visible' : 'hidden';
    });
  };
  setVisible(0);
  syncVideos(0);
  if (inset) gsap.set(inset, { autoAlpha: 1 });
  if (live) gsap.set(live, { autoAlpha: 0 });
  bits.forEach((b, i) => {
    b.style.opacity = i === 0 ? '1' : '0';
    b.style.visibility = i === 0 ? 'visible' : 'hidden';
  });

  const paintTabs = (idx) => {
    tabs.forEach((t, i) => {
      t.classList.toggle('is-active', i === idx);
      t.classList.toggle('is-done', i < idx);
    });
  };
  paintTabs(0);

  // ── click → scroll to that tab's segment (keeps state in sync) ─
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => {
      if (REDUCED) {
        paintTabs(i);
        setVisible(i);
        bits.forEach((b, k) => {
          b.style.opacity = k === i ? '1' : '0';
          b.style.visibility = k === i ? 'visible' : 'hidden';
        });
        return;
      }
      const st = ScrollTrigger.getAll().find((t) => t.trigger === section);
      if (!st) return;
      const target = st.start + (i / N) * (st.end - st.start);
      // Keep Lenis & ScrollTrigger in sync by driving whichever owns scroll
      if (window.lenis && window.lenis.scrollTo) {
        window.lenis.scrollTo(target, {
          duration: 0.85,
          easing: (t) => 1 - Math.pow(1 - t, 4),
        });
      } else {
        gsap.to(window, {
          scrollTo: target,
          duration: 0.85,
          ease: 'power3.inOut',
          overwrite: 'auto',
        });
      }
    });
  });

  if (REDUCED) {
    videos.forEach((v) => v.pause());
    return;
  }

  // ── single pinned trigger driving everything ───────────────────
  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => '+=' + (window.matchMedia('(max-width: 640px)').matches ? 240 : 400) + '%',
    pin: true,
    refreshPriority: 1, // pins refresh before reveals so triggers below them are offset correctly
    scrub: true,
    anticipatePin: 1,
    invalidateOnRefresh: true,
    onUpdate(self) {
      const raw = self.progress * N;
      const idx = Math.min(N - 1, Math.floor(raw));
      const frac = raw - idx; // 0..1 within the active segment

      // 1 · fill the active bar proportionally
      fills.forEach((bar, i) => {
        if (i < idx) bar.style.transform = 'scaleX(1)';
        else if (i === idx) bar.style.transform = `scaleX(${frac})`;
        else bar.style.transform = 'scaleX(0)';
      });
      paintTabs(idx);

      // 2 · crossfade media to the active tab (opacity only)
      media.forEach((m, i) => {
        m.style.opacity = i === idx ? '1' : '0';
        m.style.visibility = i === idx ? 'visible' : 'hidden';
      });
      syncVideos(idx);

      // 3 · swap the copy block
      bits.forEach((b, i) => {
        b.style.opacity = i === idx ? '1' : '0';
        b.style.visibility = i === idx ? 'visible' : 'hidden';
      });

      // 4 · floating extras published by tab
      if (inset) gsap.to(inset, { autoAlpha: idx === 0 ? 1 : 0, duration: 0.3, overwrite: 'auto' });
      if (live) gsap.to(live, { autoAlpha: idx === 2 ? 1 : 0, duration: 0.3, overwrite: 'auto' });

      // 5 · subtle pan on the visible media for extra life
      const visible = media[idx];
      if (visible && visible._pan) {
        visible._pan.progress(frac);
      }
    },
  });

  // subtle Ken Burns pans (scrub-progressed)
  media.forEach((m) => {
    m._pan = gsap.fromTo(
      m,
      { scale: 1.05 },
      { scale: 1.12, ease: 'none', paused: true },
    );
  });
}
