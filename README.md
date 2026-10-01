# SOKO Moto — e-bike dealer storefront

Multi-page storefront for SOKO Moto, a family-run, Igbo-Nigerian-owned e-bike dealer operating from its own hub in **Guangzhou, China**, shipping worldwide with Nigeria first. The business sources, verifies, ships, and supports bikes. It does not manufacture, and it has no physical presence in Nigeria. Keep copy consistent with that.

## Stack

| Layer | Choice |
| --- | --- |
| Build | Vite 8, PostCSS 8 + Autoprefixer |
| Styling | Tailwind CSS 4 via `@tailwindcss/vite`, hand-written CSS in `src/css/` |
| Motion | GSAP 3 (ScrollTrigger, ScrollToPlugin), Lenis 1 smooth scroll |
| Icons | Lucide 1 (tree-shaken through `src/js/icons.js`) |
| Markup / logic | Vanilla HTML, CSS, JS (ES modules) |

Fonts: General Sans (body), Clash Display (display + logo), Cabinet Grotesk (headings), JetBrains Mono (dashboard numerals). Loaded from `public/fonts` via `src/css/fonts.css`.

Design tokens live in `src/css/variables.css`:
`--color-bg #0D0D0D`, `--color-text #F5F3EF`, `--color-accent #FF5A1F`, `--color-secondary #2B2B2B`, `--color-success #3DDC97`.

## Run

```bash
npm ci
npm run dev        # http://localhost:5173
npm run build      # -> dist/
npm run preview
```

## Pages

`index.html` is the only root entry. Everything else is under `pages/`:

| Route | Purpose |
| --- | --- |
| `/` | Home: video hero + auto-advancing widget, lineup, tech carousel, story carousel, "The Crossing" shipping lane, finder, journal |
| `pages/shop.html` | The lineup, filterable grid |
| `pages/product.html` | PDP: swatch gallery, financing calculator, factory-warranty line, add to cart |
| `pages/cart.html` · `pages/checkout.html` · `pages/order-confirmation.html` | Cart → checkout (incl. "Split in 3") → receipt (gated on a successful transaction) |
| `pages/about.html` | Founder, hub live-hours chip, timeline, values |
| `pages/contact.html` | Pre-shipment **unit verification booker** (live video at the Guangzhou bench) + message form |
| `pages/faq.html` | Grouped FAQ |
| `pages/login.html` · `pages/signup.html` | Auth against localStorage (signup has strength + guessability trackers) |
| `pages/dashboard.html` | Member "OPS Deck" (orders manifest, wallet, garage, addresses, support, notifications, settings) |
| `pages/admin.html` | Admin OPS Deck (orders, inventory, customers, analytics, settings). Admin-gated |
| `pages/404.html` | Not found |

Shared navbar and footer are partials in `src/components/`, injected by `src/js/chrome.js`.

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Customer | `chidi@example.com` | `demo1234` |
| Admin | `admin@sokomoto.ng` | `admin1234` |

## Guarantee model (site-wide copy)

1. **90-day arrival guarantee**: if it doesn't arrive, or isn't what you verified on video, we make it right.
2. **Factory warranty passed through per model** (shown on the PDP, e.g. Battery 18 mo · Motor 12 mo).
3. **Lifetime remote support**, parts shipped from Guangzhou; repairs via partner workshops in Nigeria.

Plus 7-day returns. Do not reintroduce "2-year warranty", showrooms, test rides, swap stations, or any Nigerian address / RC number.

## State (all localStorage, no backend)

| Key | Contents |
| --- | --- |
| `soko-cart-v1` | Cart lines |
| `soko-users-v1`, `soko-session-v1` | Accounts and the active session |
| `soko-orders-v1`, `soko-wishlist-v1`, `soko-wallet-v1`, `soko-notifs-v1` | Member data |
| `soko-addr-v1`, `soko-cards-v1`, `soko-garage-v1`, `soko-tickets-v1`, `soko-prefs-v1`, `soko-refs-v1` | Member data |
| `soko-verify-v1` | Unit-verification bookings (`VR-XXXX`) |
| `soko-a-orders-v1`, `soko-a-inventory-v1`, `soko-a-customers-v1`, `soko-a-settings-v1` | Admin store |

`src/js/account.js` is the single data layer; both decks and the checkout go through it.

## Key modules

- `src/js/main.js` boots every page; `home.js`, `animations.js`, `scrollstory.js`, `storycarousel.js`, `collage.js` hold the scroll-driven sections. All reveals replay on every entry into the viewport.
- `src/js/icons.js` registers every Lucide glyph used. **Any new `data-lucide="…"` name must be added here** or `createIcons` throws.
- `src/js/dashboard.user.js` / `dashboard.admin.js` render the OPS Decks. Rail indicator positions are CSS `:has()` rules in `src/css/dashboard.css`.
- `src/js/catalog.js` is the product catalogue used by the shop, PDP, and cart.

## Assets

All raster images are WebP in `public/images/` and carry intrinsic `width`/`height` attributes to avoid layout shift (converted from the originals at q80–84; 20 MB → 3.7 MB). Hero and featured-card videos stream from Mixkit (`https://assets.mixkit.co/videos/{id}/{id}-720.mp4`).

## Testing

A jsdom harness lives in `harness/`. It boots a page, runs the app's own modules, and asserts on DOM + localStorage.

```bash
npm install --no-save jsdom          # not a project dependency

# page suites
node --import ./harness/register.mjs harness/run.mjs index.html idx
node --import ./harness/register.mjs harness/run.mjs pages/shop.html shop
# ... product, about, contact, faq, login, signup, fof, confirm, checkout, dashboard

# seeded suites
export HARNESS_SEED='{"soko-cart-v1":"[{\"id\":\"0001-commuter\",\"name\":\"SOKO 01 · Commuter\",\"price\":1350000,\"qty\":1,\"img\":\"/images/bike-commuter.webp\"}]"}'
node --import ./harness/register.mjs harness/run.mjs pages/cart.html cart
node --import ./harness/register.mjs harness/run.mjs pages/checkout.html checkout-flow

export HARNESS_SEED='{"soko-session-v1":"{\"userId\":\"u-demo\",\"name\":\"Chidi Okeke\",\"email\":\"chidi@example.com\",\"role\":\"customer\"}"}'
node --import ./harness/register.mjs harness/run.mjs pages/dashboard.html deck-user

export HARNESS_SEED='{"soko-session-v1":"{\"userId\":\"u-admin\",\"name\":\"Admin\",\"email\":\"admin@sokomoto.ng\",\"role\":\"admin\"}"}'
node --import ./harness/register.mjs harness/run.mjs pages/admin.html deck-admin
unset HARNESS_SEED

# data-layer smoke (74 checks)
node --import ./harness/register.mjs harness/smoke.mjs
```

The `product` suite must run unseeded. GSAP keeps the Node process alive after a suite finishes; wrap runs in `timeout 60` in CI.

## Security and web-quality notes

- **Headers.** `public/_headers` (Netlify/Cloudflare Pages) and `vercel.json` ship the same policy: a Content-Security-Policy scoped to self + Fontshare (fonts) + Mixkit (video), `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive `Permissions-Policy`, and immutable caching for hashed `/assets/*`. Keep both files in sync if a new external host is added.
- **Inline scripts.** JSON-LD blocks and the per-page module bootstraps are inline, hence `'unsafe-inline'` in `script-src`. Moving to nonces requires a server; on a static host this is the practical floor.
- **Printable invoice.** `dashboard.user.js` builds the invoice as a `text/html` Blob and opens its object URL with `noopener` (no `document.write`, no handle between windows). All interpolated values pass through `esc()`.
- **User content.** Every place that renders localStorage-derived strings (orders, addresses, reviews, admin tables) goes through a module-scope `esc()` helper.
- **Lottie.** Scenes in `public/lottie/*.json` are generated by `scripts/make-lottie.py` (glyph outlines embedded, so no font fetch at runtime). `lottie_light` is a lazy chunk loaded only when a scene approaches the viewport.

## Placeholders to replace before launch

- Canonical / Open Graph URLs, `public/robots.txt`, and `public/sitemap.xml` assume the domain `https://sokomoto.ng`. Search-and-replace once the real domain is known.
- `public/images/og.jpg` (1200×630) is cropped from the hero photo; swap for a designed social card.

- WhatsApp number `wa.me/2348000000000` (about page, contact).
- Founder photo `public/images/founder.webp` and hub photos.
- Mixkit video URLs (swap for owned footage on your own CDN).
- Paystack "Split in 3" is UI-only; wire to a real payment provider.
