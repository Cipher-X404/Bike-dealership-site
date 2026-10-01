"""
shop-data.py, single source for the lineup shown on /pages/shop.html.
Run: python3 scripts/shop-data.py  -> rewrites the card block in pages/shop.html
(between <!-- @@CARDS@@ --> markers), the CATALOG array in src/js/catalog.js
and the ItemList JSON-LD in the shop <head>.
"""
import json, os, re

ROOT = os.path.join(os.path.dirname(__file__), '..')
SITE = 'https://sokomoto.ng'

# (id, name, short, cat, badge, price, img, w, h, color, kicker, ledger[(label,value)x3], alt, wide)
P = [
    ('0001-commuter', 'SOKO 01 · Commuter', 'SOKO 01', 'commuter', 'Bestseller', 1350000, '/images/bike-commuter.webp', 1448, 1086, 'Graphite',
     'City · the one most people start with', [('Range', '140 km'), ('Top speed', '95 km/h'), ('Weight', '47 kg')],
     'SOKO 01 Commuter, matte graphite electric motorcycle in side profile', True),
    ('0002-cargo', 'SOKO 02 · Cargo', 'SOKO 02', 'delivery', None, 1650000, '/images/bike-delivery.webp', 1448, 1086, 'Graphite',
     'Delivery · built around the box', [('Payload', '180 kg'), ('Range', '110 km'), ('Box', '60 L')],
     'SOKO 02 Cargo electric motorcycle with rear delivery box', False),
    ('0003-trail', 'SOKO 03 · Trail', 'SOKO 03', 'adventure', None, 1890000, '/images/bike-adventure.webp', 1448, 1086, 'Sand',
     'Adventure · dual-sport, road legal', [('Travel', '200 mm'), ('Top speed', '85 km/h'), ('Clearance', '260 mm')],
     'SOKO 03 Trail dual-sport electric motorcycle with knobbly tyres', False),
    ('0001-pro', 'SOKO Pro · Performance', 'SOKO Pro', 'performance', 'Limited', 2450000, '/images/bike-pro.webp', 1448, 1086, 'Graphite',
     'Flagship · the fast one', [('Peak power', '7.9 kW'), ('Top speed', '120 km/h'), ('0 to 60', '3.9 s')],
     'SOKO Pro performance electric motorcycle, orange accents', True),
    ('0004-deluxe', 'SOKO 01 Deluxe', 'SOKO 01 Deluxe', 'commuter', 'New', 1520000, '/images/bike-commuter-side.webp', 1536, 1024, 'Sand',
     'City · long seat, two-up daily', [('Range', '140 km'), ('Seat', '2 up'), ('Weight', '49 kg')],
     'SOKO 01 Deluxe commuter with long two-up seat', False),
    ('0002-plus', 'SOKO 02 Plus', 'SOKO 02 Plus', 'delivery', None, 1980000, '/images/bike-delivery.webp', 1448, 1086, 'Graphite',
     'Delivery · cold-chain box', [('Payload', '210 kg'), ('Box', 'Cold-chain 80 L'), ('Range', '105 km')],
     'SOKO 02 Plus cargo electric motorcycle with insulated box', False),
    ('0003-x', 'SOKO 03 X', 'SOKO 03 X', 'adventure', None, 2150000, '/images/bike-adventure.webp', 1448, 1086, 'Sand',
     'Adventure · enduro spec', [('Travel', '240 mm'), ('Modes', 'Trek + Sport'), ('Weight', '58 kg')],
     'SOKO 03 X enduro-spec electric motorcycle', False),
    ('0001-sport', 'SOKO 01 Sport', 'SOKO 01 Sport', 'performance', None, 1880000, '/images/bike-pro.webp', 1448, 1086, 'Graphite',
     'Sport · commuter frame, sharper tune', [('Top speed', '105 km/h'), ('Peak power', '5.5 kW'), ('Range', '120 km')],
     'SOKO 01 Sport electric motorcycle', False),
    # ── new machines ──
    ('0004-courier', 'SOKO 04 · Courier', 'SOKO 04', 'delivery', 'New', 1420000, '/images/collage-courier.webp', 1023, 1537, 'Graphite',
     'Delivery · step-through, rider-first', [('Payload', '120 kg'), ('Range', '130 km'), ('Step-through', 'Yes')],
     'SOKO 04 Courier step-through electric motorcycle ridden through the city at dusk', False),
    ('0001-night', 'SOKO 01 Night', 'SOKO 01 Night', 'commuter', None, 1410000, '/images/collage-headlight.webp', 1024, 1536, 'Graphite',
     'City · ring headlight, night pack', [('Range', '140 km'), ('Lighting', 'Ring LED'), ('Weight', '47 kg')],
     'SOKO 01 Night commuter with signature ring LED headlight', False),
    ('0003-scrambler', 'SOKO 03 Scrambler', 'SOKO 03 Scrambler', 'adventure', None, 2050000, '/images/hero-studio.webp', 1915, 821, 'Graphite',
     'Adventure · studio-spec street tracker', [('Travel', '180 mm'), ('Top speed', '95 km/h'), ('Tyres', 'Mixed')],
     'SOKO 03 Scrambler street tracker in the studio', False),
    ('0001-pro-r', 'SOKO Pro R', 'SOKO Pro R', 'performance', 'Limited', 2690000, '/images/collage-architecture.webp', 1024, 1536, 'Graphite',
     'Flagship · track tune, road plates', [('Peak power', '9.2 kW'), ('Top speed', '130 km/h'), ('0 to 60', '3.4 s')],
     'SOKO Pro R performance electric motorcycle outside a concrete building', False),
    # ── kit ──
    ('acc-helmet', 'SOKO Aero Helmet', 'Aero Helmet', 'accessory', None, 85000, '/images/accessory-helmet.webp', 1448, 1086, 'Graphite',
     'Kit · full-face, ECE-certified', [('Standard', 'ECE 22.06'), ('Weight', '1,180 g'), ('Visor', 'Pinlock')],
     'SOKO Aero full-face helmet', False),
    ('acc-battery', 'SOKO Swap Battery', 'Swap Battery', 'accessory', None, 320000, '/images/accessory-battery.webp', 1448, 1086, 'Graphite',
     'Kit · second pack, swap and go', [('Capacity', '2.9 kWh'), ('Weight', '14 kg'), ('Fits', '01, 02, 04')],
     'SOKO swap battery pack', False),
    ('acc-charger', 'SOKO Fast Charger', 'Fast Charger', 'accessory', None, 145000, '/images/tech-battery.webp', 1086, 1448, 'Graphite',
     'Kit · 0 to 80% in two hours', [('Output', '3.6 kW'), ('0 to 80%', '2 h'), ('Plug', 'Type G')],
     'SOKO fast charger connected to a battery', False),
    ('acc-lock', 'SOKO Smart Lock', 'Smart Lock', 'accessory', None, 65000, '/images/tech-gps.webp', 1086, 1448, 'Graphite',
     'Kit · GPS, alarm, app remote', [('Tracking', 'GPS'), ('Alarm', '110 dB'), ('Battery', '30 days')],
     'SOKO smart lock with GPS tracking', False),
    ('acc-gloves', 'SOKO Ride Gloves', 'Ride Gloves', 'accessory', 'New', 28000, '/images/collage-gloves.webp', 1024, 1536, 'Black',
     'Kit · knuckle armour, touchscreen tips', [('Armour', 'Knuckle'), ('Sizes', 'S to XXL'), ('Touch', 'Yes')],
     'SOKO riding gloves resting on a fuel tank', False),
    ('acc-openface', 'SOKO Open-face Helmet', 'Open-face Helmet', 'accessory', None, 62000, '/images/collage-helmet.webp', 1024, 1536, 'Sand',
     'Kit · city helmet, ECE-certified', [('Standard', 'ECE 22.06'), ('Weight', '980 g'), ('Visor', 'Drop-down')],
     'SOKO open-face helmet on a motorcycle seat', False),
    ('acc-lights', 'SOKO Ring Light Kit', 'Ring Light Kit', 'accessory', None, 48000, '/images/tech-lights.webp', 1086, 1448, 'Graphite',
     'Kit · signature ring LED upgrade', [('Output', '2,400 lm'), ('Fits', '01, 02'), ('Fitting', '40 min')],
     'SOKO ring LED headlight upgrade', False),
    ('acc-mount', 'SOKO Ride Mount', 'Ride Mount', 'accessory', None, 22000, '/images/tech-app.webp', 1086, 1448, 'Graphite',
     'Kit · phone dock with live telemetry', [('Charging', 'USB-C 18 W'), ('Fits', 'All models'), ('App', 'SOKO Ride')],
     'Phone mounted on SOKO handlebars showing the ride app', False),
    ('acc-disclock', 'SOKO Disc Lock', 'Disc Lock', 'accessory', None, 38000, '/images/tech-lock.webp', 1086, 1448, 'Graphite',
     'Kit · hardened disc lock with reminder cable', [('Shackle', '10 mm'), ('Alarm', 'Motion'), ('Weight', '620 g')],
     'SOKO disc lock fitted to a front brake disc', False),
    ('acc-topbox', 'SOKO Top Box 45 L', 'Top Box 45 L', 'accessory', None, 95000, '/images/lifestyle-1.webp', 1536, 1024, 'Graphite',
     'Kit · lockable, quick-release', [('Volume', '45 L'), ('Fits', '01, 02, 04'), ('Lock', 'Keyed')],
     'Courier smiling on a SOKO with a rear top box at sunset', False),
]

CAT_LABEL = {'commuter': 'Commuter', 'delivery': 'Delivery', 'adventure': 'Adventure', 'performance': 'Performance', 'accessory': 'Kit'}
money = lambda n: '₦' + format(n, ',')

def card(i, p):
    (pid, name, short, cat, badge, price, img, w, h, color, kicker, ledger, alt, wide) = p
    n = f'{i:02d}'
    cls = 'sr-card' + (' sr-card--wide' if wide else '')
    badge_html = f'<span class="sr-card__badge">{badge}</span>' if badge else ''
    ledger_html = ''.join(f'<div><dt>{l}</dt><dd>{v}</dd></div>' for l, v in ledger)
    return f'''            <article class="{cls}" data-cat="{cat}" data-id="{pid}" data-name="{name}" data-short="{short}" data-price="{price}" data-img="{img}" data-color="{color}" data-index="{n}">
              <a class="sr-card__media" href="/pages/product.html" data-mask aria-label="View {name}">
                <img src="{img}" alt="{alt}" loading="lazy" decoding="async" width="{w}" height="{h}" />
                <span class="sr-card__plate" aria-hidden="true">{n}</span>
                {badge_html}
              </a>
              <div class="sr-card__body" data-reveal>
                <p class="sr-card__cat">{kicker}</p>
                <div class="sr-card__row">
                  <h3><a href="/pages/product.html">{name}</a></h3>
                  <span class="sr-card__price">{money(price)}</span>
                </div>
                <dl class="sr-card__ledger">{ledger_html}</dl>
                <div class="sr-card__actions">
                  <a class="sr-card__more" href="/pages/product.html">Details <i data-lucide="arrow-right" class="icon-16"></i></a>
                  <button class="btn btn--secondary btn--sm js-add" type="button"><i data-lucide="shopping-bag" class="icon-16"></i> Add to cart</button>
                </div>
              </div>
            </article>
'''

cards = '\n'.join(card(i + 1, p) for i, p in enumerate(P))

# ── shop.html ──
path = os.path.join(ROOT, 'pages', 'shop.html')
html = open(path, encoding='utf-8').read()
html = re.sub(r'(<!-- @@CARDS@@ -->\n)[\s\S]*?(\n\s*<!-- @@/CARDS@@ -->)', lambda m: m.group(1) + cards + m.group(2), html)
itemlist = {
    '@context': 'https://schema.org', '@type': 'ItemList', 'name': 'SOKO Moto lineup', 'numberOfItems': len(P),
    'itemListElement': [{
        '@type': 'ListItem', 'position': i + 1,
        'item': {'@type': 'Product', 'name': p[1], 'image': SITE + p[6], 'url': SITE + '/pages/product.html', 'brand': {'@type': 'Brand', 'name': 'SOKO Moto'},
                 'offers': {'@type': 'Offer', 'priceCurrency': 'NGN', 'price': str(p[5]), 'availability': 'https://schema.org/InStock', 'url': SITE + '/pages/product.html'}}
    } for i, p in enumerate(P)]
}
html = re.sub(r'<script type="application/ld\+json" data-itemlist>[\s\S]*?</script>',
              '<script type="application/ld+json" data-itemlist>' + json.dumps(itemlist, ensure_ascii=False, separators=(',', ':')) + '</script>', html)
# counts used by the hero index + pills
counts = {}
for p in P: counts[p[3]] = counts.get(p[3], 0) + 1
html = re.sub(r'data-count-for="(\w+)">\d+<', lambda m: f'data-count-for="{m.group(1)}">{len(P) if m.group(1)=="all" else counts.get(m.group(1),0)}<', html)
html = re.sub(r'(<b class="js-visible-count">)\d+(</b>) of \d+', lambda m: f'{m.group(1)}{len(P)}{m.group(2)} of {len(P)}', html)
open(path, 'w', encoding='utf-8').write(html)

# ── catalog.js ──
cpath = os.path.join(ROOT, 'src', 'js', 'catalog.js')
js = open(cpath, encoding='utf-8').read()
rows = []
for p in P:
    (pid, name, short, cat, badge, price, img, w, h, color, kicker, ledger, alt, wide) = p
    specs = json.dumps([f'{v}' if l in ('Range', 'Top speed', 'Payload', 'Peak power', 'Capacity', 'Standard') else f'{l} {v}' for l, v in ledger[:2]], ensure_ascii=False).replace('"', "'")
    rows.append(f"  {{ id: '{pid}', name: '{name}', cat: '{cat}', catLabel: '{kicker.split(' · ')[1] if ' · ' in kicker else kicker}', price: {price}, img: '{img}', specs: {specs} }},")
js = re.sub(r'export const CATALOG = \[\n[\s\S]*?\n\];', 'export const CATALOG = [\n' + '\n'.join(rows) + '\n];', js)
open(cpath, 'w', encoding='utf-8').write(js)
print('cards', len(P), 'counts', counts)
