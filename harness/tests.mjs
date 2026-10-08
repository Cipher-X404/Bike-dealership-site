// Per-page assertions for the DOM harness.
// NOTE: this Node/V8 build mis-parses `async ({...}) => {}` inside object
// literals, so every test is an `async function` expression.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// cardAudit: every card in the manifest must exist, have media, and the
// media file must exist on disk (absolute /images/... paths resolve site-wide).
function cardAudit(qa, manifest, expect, label) {
  for (const [sel, min, needImg] of manifest) {
    const els = qa(sel);
    expect(els.length >= min, `${label}: ${sel} ×${els.length} (need ≥${min})`);
    let broken = 0;
    for (const el of els) {
      const imgs = el.tagName === 'IMG' ? [el] : el.querySelectorAll('img');
      if (imgs.length === 0) {
        // video media card is legitimate (poster or source present)
        const vids = el.querySelectorAll('video');
        const ok = vids.length > 0 && [...vids].every((v) => v.getAttribute('poster') || v.querySelector('source'));
        if (needImg && !ok) broken++;
        continue;
      }
      for (const im of imgs) {
        const s = im.getAttribute('src') || '';
        if (!s.startsWith('/images/')) { broken++; continue; }
        if (!fs.existsSync(path.join(ROOT, 'public', s))) broken++;
      }
    }
    expect(broken === 0, `${label}: ${sel} images all resolve on disk`);
  }
}

const idx = {
  name: 'index',
  run: async function ({ q, qa, expect }) {
    expect(q('.hero') && q('.hero__title'), 'hero present');
    expect(qa('.hero__line').length === 2, 'hero two lines');
    expect(q('.hero-widget') && q('.js-hero-num'), 'hero widget present');
    expect(qa('.hero-widget__seg').length === 4, 'widget 4 segments');
    expect(q('[data-lineup]') && q('.js-lineup-prev') && q('.js-lineup-next'), 'lineup carousel controls');
    expect(q('#ratings'), 'ratings section');
    expect(q('[data-story-carousel]'), 'story carousel');
    expect(q('#site-nav') && q('.js-cart-count'), 'navbar hydrated');
    expect(q('footer') !== null, 'footer present');
    // trust architecture (purchase funnel sections)
    expect(qa('.how-step').length === 3, 'how-it-works 3 steps');
    expect(qa('.stats-band .stat').length === 4, 'stats band 4 counters');
    expect(qa('.stats-band [data-count]').length === 4, 'stats counters wired');
    expect(qa('.paydel-card').length === 2, 'pay & delivery cards');
    expect(q('[data-crossing]') !== null && qa('.leg').length === 5, 'crossing: 5 legs Guangzhou → door');
    expect(qa('.stamp').length === 3, '3 guarantee stamps');
    expect(q('[data-seam-word]') !== null, 'outline seam word');
    expect(!/showroom|test ride|swap station|RC 1894732/i.test(document.body.textContent), 'no stale physical-presence copy');
    expect(q('.closing-cta'), 'closing test-ride CTA');
    // hero background = video with dark overlay (not a static image)
    const hvid = q('.hero__bg-video');
    expect(hvid && hvid.tagName === 'VIDEO' && hvid.hasAttribute('muted'), 'hero bg is muted video');
    expect(hvid.getAttribute('poster'), 'hero video has poster fallback');
    expect(qa('.hero__bg-img').length === 0, 'old static hero img gone');
    // cowboy-pattern sections
    expect(q('[data-tech-carousel]') && q('.js-showcase-track'), 'tech carousel wired');
    expect(qa('.showcase__panel').length === 9, 'tech carousel 9 panels');
    expect(q('.js-showcase-prev') && q('.js-showcase-next') && q('.js-showcase-i'), 'carousel controls + counter');
    expect(q('.js-showcase-bar'), 'carousel progress bar');
    expect(q('.showcase__viewport'), 'carousel clipped viewport (no overflow)');
    expect(q('.rideband-wall[data-showcase]') && q('.rideband-wall .showcase__track img'), 'community photo wall (pinned) wired');
    // featured picks: video media cards
    const vids = qa('.product-card__vid');
    expect(vids.length === 6, 'featured cards 6 videos');
    expect(vids.every((v) => v.hasAttribute("muted") && v.hasAttribute("loop") && v.hasAttribute("poster")), "videos muted/loop/poster");
    expect(vids.every((v) => /^https:\/\/assets\.mixkit\.co\/videos\/\d+\/\d+-720\.mp4$/.test(v.src)), 'video srcs are mixkit 720p');
    expect(qa('.product-card .img-wrap img').length === 0, 'featured imgs replaced by video');
    // hero flip-cell number
    expect(q('.hero-num') && qa('.js-hero-cell').length === 2, 'hero flip-cell counter');
    expect(qa('.hero-widget__num').length === 0, 'old plain number gone');
    // navbar guest state: icon shown, avatar hidden
    const navLink = q('.js-account-link');
    expect(navLink && !navLink.classList.contains('is-authed'), 'navbar guest: not authed class');
    expect(navLink.querySelector('.js-account-avatar').hidden === true, 'navbar guest: avatar hidden');
    expect(navLink.querySelector('.js-account-icon') !== null, 'navbar guest: icon present');
    expect(qa('.finder__card').length === 4, 'finder 4 ride archetypes');
    expect(qa('.finder__card').every((a) => /\?cat=/.test(a.getAttribute('href') || '')), 'finder cards deep-link to shop filters');
    expect(qa('.journal__card').length === 3, 'dispatch 3 cards');
    expect(q('.rideband') && q('.rideband__intro'), 'ride band editorial intro');
    expect(qa('.rideband__strip img').length >= 10, 'ride band photo strip');
    // scroll depth: index must be a long scroll (≥10 full sections + pinned showcase distance)
    const sections = qa('main > section').length;
    expect(sections >= 10, `long scroll: ${sections} top-level sections (need ≥10)`);
    // card display audit
    cardAudit(qa, [
      ['.hero-widget__card', 4, true],
      ['.lineup__panel', 4, true],
      ['.ratings__card', 3, true],
      ['.product-card', 6, true],
      ['.story-photo', 4, true],
      ['.collage-card', 3, true],
      ['.how-step', 3, false],
      ['.stamp', 3, false],
      ['.paydel-card', 2, false],
      ['.finder__card', 4, true],
      ['.journal__card', 3, true],
      ['.showcase__media', 8, true],
    ], expect, 'idx');
  },
};

const shop = {
  name: 'shop',
  run: async function ({ q, qa, expect }) {
    expect(qa('.sr-card').length === 22, '22 static product cards in HTML (12 machines + 10 kit)');
    expect(qa('.sr-card[data-cat="accessory"]').length === 10, '10 kit cards');
    expect(q('.shop-toolbar') && q('.shop-index') && q('.compare__table'), 'toolbar, hero index rail and compare table');
    expect(qa('.compare__table tbody tr').length >= 8, 'compare table has spec rows');
    expect(qa('.route__leg').length === 5, 'crossing timeline has 5 legs');
    expect(qa('[data-count-for]').length >= 10 && qa('[data-count-for="all"]').every((b) => b.textContent.trim() === '22'), 'category counts wired');
    expect(q('.js-visible-count'), 'visible-count control');
    expect(qa('.filter-pill[data-filter]').length >= 5, 'filter pills');
    expect(q('.js-sort'), 'sort select');
    const card = q('.sr-card');
    expect(card && card.dataset.id, 'card has data-id');
    expect(q('.js-add'), 'add-to-cart buttons exist');
    expect(qa('.guar-item').length === 4, 'guarantees strip 4 items');
    expect(qa('.paydel-card').length === 2, 'pay & delivery cards');
    expect(q('.shop-end'), 'closing test-ride CTA');
    // scroll depth: shop = hero + marquee + 22-card catalog + compare + guarantees + pay/delivery + CTA
    const sections = qa('main > section').length;
    expect(sections >= 5, `long scroll: ${sections} top-level sections (need ≥5)`);
    expect(qa('.sr-card').length >= 20, 'catalog has 20+ cards driving scroll height');
    cardAudit(qa, [
      ['.sr-card', 22, true],
      ['.guar-item', 4, false],
    ], expect, 'shop');
  },
};

const product = {
  name: 'product',
  run: async function ({ q, qa, store, expect, window }) {
    expect(q('.pdp__context') && q('.pdp__num'), 'pdp context row + ghost number');
    expect(q('.pdp__num') && /No\.?\s?01/.test(q('.pdp__num').textContent), 'ghost number text');
    expect(qa('.pdp__trust > span').length >= 4, 'trust row 4 chips');
    expect(q('h1') && /SOKO 01/.test(q('h1').textContent), 'h1 SOKO 01');
    expect(q('.js-qty'), 'qty control');
    const plus = q('.js-qty-plus');
    plus.dispatchEvent(new window.Event('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 60));
    expect(q('.js-qty').textContent.trim() === '2', 'qty plus → 2');
    const add = q('.js-add');
    add.dispatchEvent(new window.Event('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 120));
    const cartRaw = store.get('soko-cart-v1');
    const cart = cartRaw ? JSON.parse(cartRaw) : [];
    const line = cart.find((c) => c.id === '0001-commuter');
    expect(!!line && line.qty === 2, 'add-to-cart wrote 0001-commuter qty 2 to store');
    // card display audit
    cardAudit(qa, [
      ['.product-card', 4, true],
      ['[data-thumb]', 3, true],
      ['.tech__stage', 1, true],
    ], expect, 'product');
  },
};

const cart = {
  name: 'cart',
  run: async function ({ q, qa, expect, window }) {
    expect(!!q('.js-cart-items'), 'cart items container');
    expect(q('.js-subtotal') && q('.js-total'), 'subtotal/total rows');
    expect(qa('.steps__item').length === 3, 'steps rail 3 items');
    expect(q('.steps__item.is-current') !== null, 'steps: cart is current');
    const items = qa('.cart-item');
    expect(items.length === 1 && items[0].dataset.id === '0001-commuter', 'seeded line rendered');
    expect(items.length === 1 && /1,350,000/.test(q('.js-subtotal').textContent), 'subtotal shows ₦1,350,000');
    const badge = q('.js-cart-count');
    expect(badge && badge.textContent.trim() === '1' && !badge.hidden, 'navbar badge shows 1');
    const plus = items[0] ? items[0].querySelector('[data-act="plus"]') : null;
    if (plus) {
      plus.dispatchEvent(new window.Event('click', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 120));
      expect(/2,700,000/.test(q('.js-subtotal').textContent), 'qty plus re-renders total ₦2,700,000');
    }
  },
};

const checkout = {
  name: 'checkout',
  run: async function ({ q, qa, expect }) {
    expect(q('[data-checkout-form]'), 'checkout form present');
    expect(q('#co-email'), 'email field');
    expect(qa('input[name="pay"], #co-payment input[type="radio"]').length >= 3, 'payment radios');
    expect(qa('.steps__item').length === 3 && q('.steps__item.is-current') !== null, 'steps rail, shipping current');
    expect(q('[data-place-order]') && q('.js-place-label #co-total'), 'place-order button with live total');
    expect(q('#co-signin') !== null, 'signin prompt (guest)');
    // rebuilt: state select + other
    const st = q('#co-state');
    expect(st && st.tagName === 'SELECT' && st.options.length >= 24, 'state select with ≥24 states');
    expect([...st.options].some((o) => o.value === 'Other'), 'state select has Other');
    expect(q('#co-state-other-wrap').hidden, 'other-state input hidden by default');
    // rebuilt: live "your order" summary
    expect(q('#co-items') && q('#co-deliver-to.is-live'), 'live summary (items + deliver-to)');
    expect(q('#co-subtotal') && q('#co-delivery') && q('#co-total-side'), 'live summary totals');
    expect(q('#co-error'), 'validation line present');
    expect(q('.js-place-spin'), 'processing spinner present');
    expect(q('.summary') !== null, 'live order summary aside');
  },
};

const login = {
  name: 'login',
  run: async function ({ q, qa, expect, window }) {
    expect(q('.auth') && q('.auth__brand') && q('.auth__panel'), 'two-panel auth layout');
    expect(q('form[data-auth="login"]'), 'login form');
    expect(q('#login-email') && q('#login-pass'), 'login fields');
    expect(qa('[data-demo]').length >= 2, 'demo prefill buttons');
    q('#login-email').value = 'chidi@example.com';
    q('#login-pass').value = 'wrongpass';
    q('form[data-auth="login"]').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 150));
    const err = q('.auth__error');
    expect(err && err.textContent.trim().length > 0, 'error shown for wrong password');
    const demoBtn = qa('[data-demo]')[0];
    demoBtn.dispatchEvent(new window.Event('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 60));
    expect(q('#login-email').value === 'chidi@example.com' && q('#login-pass').value === 'demo1234', 'demo prefill fills fields');
    // successful login → navbar swaps icon for initials avatar (no double display)
    q('#login-email').value = 'chidi@example.com';
    q('#login-pass').value = 'demo1234';
    q('form[data-auth="login"]').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 200));
    const authLink = q('.js-account-link');
    expect(authLink.classList.contains('is-authed'), 'authed: class set on account link');
    expect(authLink.querySelector('.js-account-avatar').hidden === false, 'authed: avatar shown');
    const iconSvg = authLink.querySelector('.js-account-icon');
    expect(iconSvg.hasAttribute('hidden') || getComputedStyle(iconSvg).display === 'none', 'authed: icon hidden (no space-sharing)');
  },
};

const signup = {
  name: 'signup',
  run: async function ({ q, qa, store, expect, window }) {
    expect(q('.auth') && q('.auth__brand') && q('.auth__panel'), 'two-panel auth layout');
    expect(q('form[data-auth="signup"]'), 'signup form');
    expect(q('#su-first') && q('#su-last') && q('#su-email') && q('#su-pass') && q('#su-pass2'), 'signup fields');
    // sentry tracker present
    expect(q('[data-sentry]'), 'sentry strength tracker present');
    expect(qa('.sentry__bars [data-lvl]').length === 5, 'sentry 5 strength bars');
    expect(qa('.sentry__rules li').length === 4, 'sentry 4 rules');
    expect(qa('#sentry-flags li').length === 6, 'sentry 6 snooper flags');
    q('#su-first').value = 'Test'; q('#su-last').value = 'Rider';
    q('#su-email').value = 'test@rider.ng';
    const setPw = (v) => {
      const p = q('#su-pass'); p.value = v;
      p.dispatchEvent(new window.Event('input', { bubbles: true }));
    };
    // weak: no special char → must be blocked by the rules gate
    setPw('password1'); q('#su-pass2').value = 'password1';
    q('form[data-auth="signup"]').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 150));
    expect(q('.auth__error') !== null, 'weak password blocked by gate');
    // guessable: repeat + name detected by snooper
    setPw('Test1111'); q('#su-pass2').value = 'Test1111';
    q('form[data-auth="signup"]').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 150));
    const flagsOn = qa('#sentry-flags li.is-hit').length;
    expect(flagsOn >= 1, `snooper flags guessable password (${flagsOn} hit)`);
    expect(q('#sentry-ok') !== null && q('#sentry-ok').hidden, 'no sentry OK on guessable pw');
    // strong: letters + number + special, not guessable
    setPw('Ride!hardx22'); q('#su-pass2').value = 'Ride!hardx22';
    q('form[data-auth="signup"]').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 150));
    const usersRaw = store.get('soko-users-v1');
    const users = usersRaw ? JSON.parse(usersRaw) : [];
    expect(users.some((u) => u.email === 'test@rider.ng'), 'strong password → user persisted');
    expect(q('#sentry-ok').hidden === false, 'sentry OK for strong password');
  },
};

const about = {
  name: 'about',
  run: async function ({ q, qa, expect }) {
    const img = q('.hub-band__media img');
    expect(!!img && /about-hub\.webp$/.test(img.getAttribute('src') || ''), 'hub band with about-hub.webp');
    expect(qa('.tl-item').length === 6, 'timeline 6 items');
    expect(qa('[data-count]').length >= 4, 'stat counters present');
    const body = (document.body.textContent || '');
    expect(!/we craft|we build|we assemble|in-house|manufactur/i.test(body), 'no manufacturer claims');
    expect(/dealer|import|source|inspection|QC/i.test(body), 'dealer framing present');
    expect(q('.journey[data-journey]') && q('.journey__track'), 'journey auto-carousel wired');
    expect(qa('.journey__slide').length === 4, 'journey 4 slides');
    expect(qa('.journey__seg').length === 4, 'journey 4 rail segments');
    expect(q('.journey__num'), 'journey counter present');
    expect(q('img[data-par-img]') !== null, 'parallax image wired (hub band)');
    cardAudit(qa, [
      ['.journey__slide', 4, true],
      ['.founder-img', 1, true],
      ['.hub-band__media', 1, true],
    ], expect, 'about');
  },
};

const contact = {
  name: 'contact',
  run: async function ({ q, qa, expect, window, store }) {
    expect(q('[data-contact-form]'), 'contact form');
    expect(qa('.page-head .chip, .page-head__meta .chip').length >= 3, 'page-head meta chips');
    expect(qa('.contact-card').length >= 4, 'contact cards');
    expect(q('[data-verify]') !== null && q('[data-verify]').hidden === false, 'verification booker shown by default');
    expect(qa('.vday').length === 8, '8 bookable days');
    expect(qa('.vslot').length === 5 && qa('.vslot:not([disabled])').length === 0, 'slots locked until a day is picked');
    qa('.vday')[1].click();
    expect(qa('.vslot:not([disabled])').length >= 3, 'slots unlock after picking a day');
    q('.vslot:not([disabled])').click();
    expect(q('[data-verify-summary]').classList.contains('is-live'), 'summary goes live with day + slot');
    q('#ct-name').value = 'Harness'; q('#ct-phone').value = '08000000000'; q('#ct-email').value = 'harness@x.ng';
    q('[data-contact-form]').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 120));
    expect(q('[data-verify-done]') !== null && /VR-\d{4}/.test(q('[data-verify-done]').textContent), 'booking confirmed with VR- reference');
    expect(/VR-/.test(store.get('soko-verify-v1') || ''), 'booking persisted to store');
    // plain message path
    const topic = q('#ct-topic'); topic.value = 'Something else'; topic.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(q('[data-verify]').hidden === true && q('#ct-msg').required === true, 'message path restores textarea');
    q('[data-contact-form] button[type="submit"]').hidden = false;
    q('#ct-name').value = 'Harness'; q('#ct-phone').value = '08000000000';
    q('#ct-email').value = 'harness@x.ng'; q('#ct-msg').value = 'hi';
    q('[data-contact-form]').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 120));
    const btn = q('[data-contact-form] button[type="submit"]');
    expect(btn && /sent/i.test(btn.textContent), 'submit feedback on button');
  },
};

const faq = {
  name: 'faq',
  run: async function ({ q, qa, expect }) {
    expect(qa('.page-head .chip, .page-head__meta .chip').length >= 3, 'page-head meta chips');
    expect(qa('.faq-group').length >= 4, 'faq groups');
    expect(qa('details.faq-item').length >= 10, 'faq items');
    const body = (document.body.textContent || '');
    expect(!/we craft|we build|we assemble|frames are pressed/i.test(body), 'no manufacturer claims');
    expect(/import house|vetted factories|40-point/i.test(body), 'dealer sourcing framing');
    expect(/30\+ countries/i.test(body), 'global shipping claim');
  },
};

const fof = {
  name: 'fof',
  run: async function ({ q, expect }) {
    expect(q('.fof-num') && q('.fof-num').textContent.trim() === '404', '404 number');
    expect(q('.page-head__glow') !== null, 'glow present');
    expect(q('h1') && /wrong turn/i.test(q('h1').textContent), '404 headline');
    const a = [...document.querySelectorAll('.fof-actions a')];
    expect(a.some((x) => x.getAttribute('href') === '/pages/shop.html'), 'shop CTA');
  },
};

const confirm = {
  name: 'confirm',
  run: async function ({ q, qa, expect }) {
    expect(q('.confirm-card') && q('.confirm-badge'), 'confirm card + badge');
    expect(qa('.confirm-step').length === 3, 'next-steps timeline 3 steps');
    expect(q('.confirm-step.is-done') !== null, 'step 1 done');
    expect(qa('.confirm-meta .line').length === 4, 'meta lines');
    const track = [...document.querySelectorAll('.confirm-next a')];
    expect(track.some((a) => a.getAttribute('href') === '/pages/dashboard.html'), 'track link → dashboard');
  },
};

const confirmDemo = {
  name: 'confirm-demo',
  run: async function ({ q, expect }) {
    expect(q('.js-confirm-lead').textContent.includes('Demo order SM-9000 is recorded in this browser'), 'query reference loads the matching local demo order');
    expect(q('.js-confirm-total').textContent === '₦1,451,250', 'order total is read from the saved record');
    expect(q('.js-confirm-payment').textContent === 'Card · Flutterwave · simulated', 'payment method and selected gateway are shown as simulated');
    expect(q('.js-confirm-tracking').textContent === 'SM-9000', 'order reference appears in the tracking details');
    expect(q('.js-confirm-track').getAttribute('href') === '/pages/shop.html', 'guest is not sent to a dashboard they cannot access');
    expect(!/email was sent|payment was collected/i.test(q('.js-confirm-lead').textContent), 'copy does not claim payment or email delivery');
  },
};

const dashboard = {
  name: 'dashboard',
  run: async function ({ q, qa, expect, store }) {
    expect(q('.dash-nav [data-view]') !== null, 'dash nav views');
    expect(q('.js-view-title'), 'view title');
    expect(q('.js-guest-guard') !== null, 'guest guard present');
    // log in as demo customer and re-check guest view
    const users = JSON.parse(store.get('soko-users-v1') || '[]');
    expect(users.some((u) => u.email === 'chidi@example.com'), 'demo user seeded');
    expect(qa('[data-view-panel]').length === 9, '9 view panels');
    expect(qa('.dash-nav [data-view]').length === 9, '9 nav views');
    expect(q('.welcome') && q('.js-welcome-heading'), 'welcome band');
    expect(q('.js-kpis') && q('.js-recent-orders') && q('.js-quick-actions'), 'overview widgets');
    expect(q('.js-wallet-balance') && q('.js-ref-code') && q('.js-wallet-txns') && q('.js-cards'), 'wallet hooks');
    expect(q('.js-garage') && q('.js-tickets') && q('.js-notifs') && q('.js-addresses'), 'garage/support/notif hooks');
    expect(q('.js-set-name') && q('.js-pw-change') && q('.js-delete-account') && q('.js-save-profile'), 'settings hooks');
    expect(q('.js-toast') && q('[data-logout]') && q('.dash-modal') === null, 'toast + logout wired');
    expect(q('.js-app').hidden === true, 'app hidden for guest (guard active)');
    expect(q('.js-guest-guard').hidden === false, 'guest guard visible for guest');
  },
};

const deckUser = {
  name: 'deck-user',
  run: async function ({ q, qa, expect }) {
    expect(q('.js-app').hidden === false, 'app shown for seeded session');
    expect(q('.dash-nav [data-view].is-active') !== null, 'active rail navigation marker');
    expect(qa('.dash-nav a[data-label]').length === 9, '9 labelled rail stations');
    expect(q('.dash-side') === null, 'old sidebar gone');
    expect(q('.js-kpis').children.length === 4, '4 kpis in ledger band');
    expect(q('[data-manifest]') !== null, 'shipping manifest rendered');
    expect(qa('.mr-node').length === 5, '5 route nodes (Guangzhou → door)');
    expect(qa('.mr-node.done, .mr-node.doing').length >= 1, 'route progress marked');
    expect(q('.js-overview-notifs').children.length >= 1, 'overview activity feed');
    expect(/\d\d:\d\d/.test(q('.js-dash-clock').textContent), 'rail clock ticking');
    expect(q('.js-view-path').textContent === 'OVERVIEW', 'command strip path');
    expect(q('.js-user-initial').textContent.trim().length >= 1, 'avatar initials');
    expect(q('.js-orders').children.length >= 1, 'orders list rendered');
    expect(/₦/.test(q('.js-wallet-balance').textContent), 'wallet balance rendered');
    // nav → orders updates path + ink target
    q('.dash-nav [data-view="orders"]').click();
    expect(q('.js-view-path').textContent === 'ORDERS', 'path updates on nav');
    expect(q('[data-view-panel="orders"]').hidden === false, 'orders panel shown');
    // manifest details opens modal
    q('.dash-nav [data-view="overview"]').click();
    q('[data-manifest] .js-order-detail').click();
    expect(q('.dash-modal') !== null, 'manifest details opens modal');
  },
};

const deckUserActions = {
  name: 'deck-user-actions',
  run: async function ({ q, window, expect, store }) {
    const read = (key, fallback) => JSON.parse(store.get(key) || JSON.stringify(fallback));
    const userId = 'u-demo';
    q('.dash-nav [data-view="wallet"]').click();
    const balanceBefore = read('soko-wallet-v1', {})[userId].balance;
    q('.js-topup').click();
    q('.js-topup-amt[data-amt="10000"]').click();
    q('.js-topup-go').click();
    expect(read('soko-wallet-v1', {})[userId].balance === balanceBefore + 10000, 'wallet top-up saves a local demo credit');

    q('.js-add-card').click();
    q('.js-card-last4').value = '9134';
    q('.js-card-exp').value = '12/30';
    q('.js-card-save').click();
    expect(read('soko-cards-v1', {})[userId].some((card) => card.last4 === '9134'), 'payment method form saves only its demo card label');

    q('.dash-nav [data-view="addresses"]').click();
    const addressMap = read('soko-addr-v1', {});
    const defaultAddress = addressMap[userId].find((address) => address.isDefault);
    q(`.js-addr-edit[data-id="${defaultAddress.id}"]`).click();
    q('.js-addr-line2').value = 'Floor 2';
    q('.js-addr-save').click();
    expect(read('soko-addr-v1', {})[userId].find((address) => address.id === defaultAddress.id).line2 === 'Floor 2', 'address editor preserves optional address line 2');
    q(`.js-addr-remove[data-id="${defaultAddress.id}"]`).click();
    const afterRemoval = read('soko-addr-v1', {})[userId];
    expect(!afterRemoval.some((address) => address.id === defaultAddress.id) && afterRemoval.some((address) => address.isDefault), 'removing the default promotes another saved address');

    q('.js-add-addr').click();
    q('.js-addr-label').value = 'Test stop';
    q('.js-addr-name').value = 'Chidi Okeke';
    q('.js-addr-phone').value = '08030001234';
    q('.js-addr-line1').value = '4 Harbour Road';
    q('.js-addr-line2').value = '';
    q('.js-addr-city').value = 'Port Harcourt';
    q('.js-addr-state').value = 'Rivers';
    q('.js-addr-country').value = 'Nigeria';
    q('.js-addr-save').click();
    expect(read('soko-addr-v1', {})[userId].some((address) => address.label === 'Test stop' && !address.line2), 'address form accepts an omitted optional second line');

    q('.dash-nav [data-view="support"]').click();
    const ticketCount = read('soko-tickets-v1', {})[userId].length;
    q('.js-tk-subject').value = 'Browser demo check';
    q('.js-tk-detail').value = 'Testing the saved support request flow.';
    q('.js-tk-submit').click();
    expect(read('soko-tickets-v1', {})[userId].length === ticketCount + 1, 'support request is saved to the local account');

    q('.dash-nav [data-view="settings"]').click();
    const sms = q('.js-pref-sms');
    sms.checked = !sms.checked;
    sms.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(read('soko-prefs-v1', {})[userId].sms === sms.checked, 'notification preference persists when toggled');
    q('.js-set-city').value = 'Port Harcourt';
    q('.js-save-profile').click();
    expect(read('soko-users-v1', []).find((user) => user.id === userId).city === 'Port Harcourt', 'profile save updates the account record');
  },
};

const deckAdmin = {
  name: 'deck-admin',
  run: async function ({ q, qa, expect, window, store }) {
    expect(q('.js-app').hidden === false, 'admin app shown');
    expect(q('.js-not-admin-guard').hidden === true, 'not-admin guard hidden');
    expect(qa('.dash-nav a[data-label]').length === 6, '6 labelled rail stations');
    expect(q('.dash-side') === null, 'old sidebar gone');
    expect(q('.js-kpis').children.length === 4, '4 kpis');
    expect(q('.js-chart svg') !== null, 'revenue svg');
    expect(/^\d+$/.test(q('.js-open-count').textContent), 'open-orders chip numeric');
    expect(/\d\d:\d\d/.test(q('.js-dash-clock').textContent), 'Lagos-local clock');
    expect(qa('.js-latest-orders tbody tr').length >= 1, 'latest orders rows');
    expect(qa('.js-admin-inventory tbody tr').length >= 1, 'inventory rows');
    expect(qa('.js-admin-customers tbody tr').length >= 1, 'customer rows');
    q('.dash-nav [data-view="analytics"]').click();
    expect(q('.js-view-path').textContent === 'ANALYTICS', 'path updates');
    expect(qa('.js-trend-chart .bar-col').length === 12, '12 trend bars');
    q('.js-trend-range').value = '6';
    q('.js-trend-range').dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(qa('.js-trend-chart .bar-col').length === 6, 'analytics range selector updates the chart');

    q('.dash-nav [data-view="orders"]').click();
    q('.js-order-search').value = 'ORD-1066';
    q('.js-order-search').dispatchEvent(new window.Event('input', { bubbles: true }));
    expect(qa('.js-admin-orders tbody tr').length === 1, 'order search narrows the ledger');
    const status = q('.js-admin-orders tbody .js-status-set');
    status.value = 'shipped';
    status.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(JSON.parse(store.get('soko-a-orders-v1')).find((order) => order.id === 'ORD-1066').status === 'shipped', 'inline status control persists order updates');
    q('.js-order-search').value = '';
    q('.js-order-search').dispatchEvent(new window.Event('input', { bubbles: true }));
    q('.js-check-all').checked = true;
    q('.js-check-all').dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(q('.js-bulk-bar').hidden === false, 'select-all reveals bulk actions');
    q('.js-bulk-clear').click();
    expect(q('.js-bulk-bar').hidden === true, 'clear selection hides bulk actions');
    q('.js-admin-orders tbody .js-order-view').click();
    expect(q('.dash-modal') !== null, 'order detail action opens its dialog');
    q('.dash-modal__close').click();

    const stockBefore = JSON.parse(store.get('soko-a-inventory-v1')).find((product) => product.id === '0001-commuter').stock;
    q('.dash-nav [data-view="inventory"]').click();
    q('.js-stock-plus[data-id="0001-commuter"]').click();
    expect(JSON.parse(store.get('soko-a-inventory-v1')).find((product) => product.id === '0001-commuter').stock === stockBefore + 1, 'stock stepper updates local inventory');
    q('.js-price[data-id="0001-commuter"]').value = '1400000';
    q('.js-price[data-id="0001-commuter"]').dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(JSON.parse(store.get('soko-a-inventory-v1')).find((product) => product.id === '0001-commuter').price === 1400000, 'price editor persists changes');
    q('.js-product-add').click();
    q('.js-p-name').value = 'Harness touring bike';
    q('.js-p-price').value = '1720000';
    q('.js-p-stock').value = '4';
    q('.js-product-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    expect(JSON.parse(store.get('soko-a-inventory-v1')).some((product) => product.name === 'Harness touring bike'), 'add inventory form creates a local stock item');

    q('.dash-nav [data-view="customers"]').click();
    q('.js-admin-customers tbody .js-customer-view').click();
    expect(q('.dash-modal h3')?.textContent.trim().length > 0, 'customer action opens rider details');
    q('.dash-modal__close').click();

    q('.dash-nav [data-view="settings"]').click();
    q('.js-set-gateway').value = 'Flutterwave';
    q('.js-set-tax').value = '5';
    q('.js-set-enable').checked = false;
    q('.js-admin-settings').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    const settings = JSON.parse(store.get('soko-a-settings-v1'));
    expect(settings.gateway === 'Flutterwave' && settings.taxRate === 5 && settings.ordersEnabled === false, 'settings save updates gateway, tax and order availability');
  },
};

const checkoutFlow = {
  name: 'checkout-flow',
  run: async function ({ q, qa, expect, window, store }) {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const commuterStockBefore = JSON.parse(store.get('soko-a-inventory-v1') || '[]').find((item) => item.id === '0001-commuter')?.stock;
    const form = q('[data-checkout-form]');
    const submit = () => form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    // 1) empty submit → blocked with error, still on step 1
    submit();
    await sleep(80);
    expect(q('#co-error').hidden === false, 'empty submit shows validation error');
    expect(qa('.steps__item')[0].classList.contains('is-current'), 'still on step 1 when invalid');
    // 2) fill everything validly → advance to payment
    q('#co-fname').value = 'Chidi';
    q('#co-lname').value = 'Okafor';
    q('#co-phone').value = '08030001234';
    q('#co-email').value = 'chidi@example.com';
    q('#co-address').value = '14 Marina Road, Victoria Island';
    q('#co-city').value = 'Lagos';
    q('#co-state').value = 'Lagos';
    submit();
    await sleep(120);
    expect(qa('.steps__item')[1].classList.contains('is-current'), 'valid shipping advances to step 2');
    expect(q('#co-error').hidden === true, 'error cleared after valid submit');
    // 3) place a local demo order → receipt
    q('[data-place-order]').dispatchEvent(new window.Event('click', { bubbles: true }));
    await sleep(80);
    expect(q('[data-place-order]').classList.contains('is-processing'), 'processing state shown');
    await sleep(2300);
    const receipt = q('.co-receipt');
    expect(receipt !== null, 'receipt modal opened after settlement');
    expect(receipt && /Order recorded for chidi@example\.com/.test(receipt.textContent), 'receipt identifies the checkout email without claiming delivery');
    expect(receipt && /Tax \(7\.5%\)/.test(receipt.textContent), 'receipt includes configured tax');
    expect(receipt && /Payment method · simulated/.test(receipt.textContent), 'receipt includes method and demo payment state');
    const trackingLink = receipt?.querySelector('.co-receipt__actions .btn--secondary');
    expect(trackingLink?.getAttribute('href')?.startsWith('/pages/order-confirmation.html?ref=SM-') === true, 'guest receipt links to the matching order reference');
    expect(qa('.steps__item')[2].classList.contains('is-current'), 'step 3 (confirmation) active');
    // 4) guest: cart cleared, no order recorded for anonymous user
    expect((store.get('soko-cart-v1') || '') === '[]', 'cart cleared after order');
    const ordersRaw = store.get('soko-orders-v1') || '';
    expect(!/Chidi Okafor/.test(ordersRaw), 'guest order not persisted to user store');
    const adminOrders = JSON.parse(store.get('soko-a-orders-v1') || '[]');
    const guestOrder = adminOrders.find((o) => o.email === 'chidi@example.com');
    expect(guestOrder?.ref && guestOrder.status === 'processing' && guestOrder.paymentStatus === 'simulated', 'guest checkout creates an explicitly demo fulfilment record');
    const commuterStockAfter = JSON.parse(store.get('soko-a-inventory-v1') || '[]').find((item) => item.id === '0001-commuter')?.stock;
    expect(commuterStockBefore !== undefined && commuterStockAfter === commuterStockBefore - 1, 'checkout decrements matching inventory');
    // 5) state select "Other" reveals typed field
    q('#co-state').value = 'Other';
    q('#co-state').dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(q('#co-state-other-wrap').hidden === false, 'Other state reveals typed input');
  },
};

const checkoutMember = {
  name: 'checkout-member',
  run: async function ({ q, expect, window, store }) {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const stockBefore = JSON.parse(store.get('soko-a-inventory-v1') || '[]').find((item) => item.id === '0001-commuter')?.stock;
    expect(q('#co-fname').value === 'Chidi' && q('#co-lname').value === 'Okeke', 'signed-in name is prefilled from the account');
    expect(q('#co-email').value === 'chidi@example.com', 'signed-in email is prefilled');
    expect(q('#co-address').value === '14 Adeola Close, Yaba' && q('#co-city').value === 'Lagos', 'default saved address is prefilled');
    const form = q('[data-checkout-form]');
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await sleep(60);
    q('[data-place-order]').dispatchEvent(new window.Event('click', { bubbles: true }));
    await sleep(2300);
    const userOrders = JSON.parse(store.get('soko-orders-v1') || '[]');
    const memberOrder = userOrders.find((order) => order.userId === 'u-demo' && order.status === 'processing');
    expect(!!memberOrder && memberOrder.paymentStatus === 'simulated' && memberOrder.tax > 0, 'member checkout stores its tax and simulated payment state');
    const adminOrder = JSON.parse(store.get('soko-a-orders-v1') || '[]').find((order) => order.id === memberOrder?.id);
    expect(!!adminOrder && adminOrder.email === 'chidi@example.com' && adminOrder.address.city === 'Lagos', 'member order is linked to the admin fulfilment record');
    expect(JSON.parse(store.get('soko-a-inventory-v1') || '[]').find((item) => item.id === '0001-commuter')?.stock === stockBefore - 1, 'member checkout decrements product inventory');
    expect(q('.co-receipt__actions .btn--secondary').getAttribute('href') === '/pages/dashboard.html#orders', 'member receipt leads to the order desk');
    expect(store.get('soko-cart-v1') === '[]', 'member checkout clears the cart after order recording');
  },
};

const checkoutClosed = {
  name: 'checkout-closed',
  run: async function ({ q, expect, window, store }) {
    const initialOrderCount = JSON.parse(store.get('soko-a-orders-v1') || '[]').length;
    const form = q('[data-checkout-form]');
    expect(q('[data-store-closed]').hidden === false, 'store-closed notice is visible');
    expect(q('[data-place-order]').disabled && q('[data-checkout-form] button[type="submit"]').disabled, 'checkout actions are disabled while paused');
    expect(q('[data-gateway-name]').textContent === 'Flutterwave', 'admin-selected gateway label reaches checkout');
    expect(q('#co-tax-line').hidden === true, 'zero tax preference hides the tax line');
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    expect(q('#co-error').textContent.includes('Checkout is paused'), 'form cannot advance while checkout is paused');
    q('[data-place-order]').dispatchEvent(new window.Event('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(JSON.parse(store.get('soko-a-orders-v1') || '[]').length === initialOrderCount, 'paused checkout does not create an order');
  },
};

export default { idx, shop, product, cart, checkout, "checkout-flow": checkoutFlow, "checkout-member": checkoutMember, "checkout-closed": checkoutClosed, login, signup, about, contact, faq, fof, confirm, "confirm-demo": confirmDemo, dashboard, "deck-user": deckUser, "deck-user-actions": deckUserActions, "deck-admin": deckAdmin };
