/*
 * collage.js, scroll-linked parallax for the editorial gallery
 * -----------------------------------------------------------------
 * Each card glides at its own speed, driven strictly by scroll position
 * (ScrollTrigger scrub, no autoplay). "Rising" cards drift upward faster
 * than the page; "lagging" cards start pushed down and only catch up as
 * the section leaves the viewport. Reduced-motion users get a static
 * collage and paused videos.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion } from './utils.js';

const REDUCED = prefersReducedMotion();

export function initCollage() {
  const section = document.querySelector('.collage');
  if (!section) return;

  const cards = gsap.utils.toArray(section.querySelectorAll('.collage-card'));
  const videos = section.querySelectorAll('video');

  if (REDUCED) {
    videos.forEach((v) => v.pause());
    return;
  }

  // smaller drift on phones so it never feels jumpy
  const isSmall = window.matchMedia('(max-width: 640px)').matches;
  const factor = isSmall ? 0.45 : 1;

  cards.forEach((card) => {
    const speed = parseFloat(card.dataset.speed || '0.2');
    const travel = (Math.abs(speed) * 56 + 10) * factor;
    const rising = speed >= 0;

    gsap.fromTo(
      card,
      rising ? { y: 0 } : { y: travel },
      rising ? { y: -travel } : { y: 0 },
      {
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.6, // smooth settle on pause, resumes naturally
        },
      },
    );
  });
}
