/*
 * chrome.js, shared page-chrome behaviors (footer + back-to-top)
 * Runs on every page.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion } from './utils.js';

const REDUCED = prefersReducedMotion();

export function initChrome() {
  // ── Signature wordmark: drifts left as you scroll the page ─────
  const word = document.querySelector('.footer-word__track');
  if (word && !REDUCED) {
    const half = word.scrollWidth / 2;
    gsap.fromTo(
      word,
      { x: 0 },
      {
        x: () => -half * 0.55,
        ease: 'none',
        scrollTrigger: {
          trigger: '.site-footer',
          start: 'top bottom',
          end: 'bottom bottom',
          scrub: 1,
        },
      },
    );
  }

  // ── Back to top ────────────────────────────────────────────────
  document.querySelectorAll('.js-back-to-top').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (window.lenis) {
        window.lenis.scrollTo(0, { duration: 1.1, easing: (t) => 1 - Math.pow(1 - t, 4) });
      } else {
        window.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' });
      }
    });
  });
}
