/*
 * lottie.js, lazy Lottie scenes
 * ----------------------------------------------------------------
 * Any element with [data-lottie="/lottie/x.json"] becomes a scene.
 * - lottie-web (light, SVG) is only downloaded when the first scene
 *   is near the viewport, so pages without scenes pay nothing.
 * - Scenes play once per entry and replay on every re-entry (the
 *   site-wide rule for reveals). data-lottie-loop="true" loops.
 * - The static markup next to the scene stays in the DOM for SEO and
 *   assistive tech; .is-ready hides it visually once the scene renders.
 * - Reduced motion: jump to the final frame, no playback.
 */
import { prefersReducedMotion } from './utils.js';

let lib = null;
async function loadLib() {
  if (!lib) {
    const mod = await import('lottie-web/build/player/lottie_light');
    lib = mod.default || mod;
  }
  return lib;
}

export function initLottie() {
  const els = document.querySelectorAll('[data-lottie]');
  if (!els.length || typeof IntersectionObserver !== 'function') return;
  const REDUCED = prefersReducedMotion();

  const mount = async (el) => {
    const lottie = await loadLib();
    const loop = el.dataset.lottieLoop === 'true';
    const anim = lottie.loadAnimation({
      container: el,
      renderer: 'svg',
      loop,
      autoplay: false,
      path: el.dataset.lottie,
      rendererSettings: { preserveAspectRatio: el.dataset.lottieFit || 'xMidYMid meet', progressiveLoad: true },
    });
    anim.addEventListener('DOMLoaded', () => {
      el.classList.add('is-ready');
      el.closest('[data-lottie-host]')?.classList.add('is-ready');
      if (REDUCED) anim.goToAndStop(Math.max(0, anim.totalFrames - 1), true);
      else if (el.__visible) anim.goToAndPlay(0, true);
    });
    anim.addEventListener('data_failed', () => el.classList.add('is-failed'));
    return anim;
  };

  const io = new IntersectionObserver((entries) => {
    entries.forEach(async (e) => {
      const el = e.target;
      el.__visible = e.isIntersecting;
      if (e.isIntersecting) {
        if (!el.__anim) { el.__anim = mount(el); return; }
        const anim = await el.__anim;
        if (!REDUCED && anim.isLoaded) anim.goToAndPlay(0, true);
      } else if (el.__anim) {
        const anim = await el.__anim;
        if (anim.isLoaded) anim.pause();
      }
    });
  }, { threshold: 0.3, rootMargin: '0px 0px 120px 0px' });

  els.forEach((el) => io.observe(el));
}
