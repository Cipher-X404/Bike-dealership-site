/*
 * catalog.js, single source of truth for the 12-model lineup.
 * Used by the nav search overlay and the shop page's add-to-cart wiring.
 * The shop page cards themselves are authored in HTML; data-* attributes
 * mirror these ids so JS never re-renders the grid.
 */

export const CATALOG = [
  { id: '0001-commuter', name: 'SOKO 01 · Commuter', cat: 'commuter', catLabel: 'the one most people start with', price: 1350000, img: '/images/bike-commuter.webp', specs: ['140 km', '95 km/h'] },
  { id: '0002-cargo', name: 'SOKO 02 · Cargo', cat: 'delivery', catLabel: 'built around the box', price: 1650000, img: '/images/bike-delivery.webp', specs: ['180 kg', '110 km'] },
  { id: '0003-trail', name: 'SOKO 03 · Trail', cat: 'adventure', catLabel: 'dual-sport, road legal', price: 1890000, img: '/images/bike-adventure.webp', specs: ['Travel 200 mm', '85 km/h'] },
  { id: '0001-pro', name: 'SOKO Pro · Performance', cat: 'performance', catLabel: 'the fast one', price: 2450000, img: '/images/bike-pro.webp', specs: ['7.9 kW', '120 km/h'] },
  { id: '0004-deluxe', name: 'SOKO 01 Deluxe', cat: 'commuter', catLabel: 'long seat, two-up daily', price: 1520000, img: '/images/bike-commuter-side.webp', specs: ['140 km', 'Seat 2 up'] },
  { id: '0002-plus', name: 'SOKO 02 Plus', cat: 'delivery', catLabel: 'cold-chain box', price: 1980000, img: '/images/bike-delivery.webp', specs: ['210 kg', 'Box Cold-chain 80 L'] },
  { id: '0003-x', name: 'SOKO 03 X', cat: 'adventure', catLabel: 'enduro spec', price: 2150000, img: '/images/bike-adventure.webp', specs: ['Travel 240 mm', 'Modes Trek + Sport'] },
  { id: '0001-sport', name: 'SOKO 01 Sport', cat: 'performance', catLabel: 'commuter frame, sharper tune', price: 1880000, img: '/images/bike-pro.webp', specs: ['105 km/h', '5.5 kW'] },
  { id: '0004-courier', name: 'SOKO 04 · Courier', cat: 'delivery', catLabel: 'step-through, rider-first', price: 1420000, img: '/images/collage-courier.webp', specs: ['120 kg', '130 km'] },
  { id: '0001-night', name: 'SOKO 01 Night', cat: 'commuter', catLabel: 'ring headlight, night pack', price: 1410000, img: '/images/collage-headlight.webp', specs: ['140 km', 'Lighting Ring LED'] },
  { id: '0003-scrambler', name: 'SOKO 03 Scrambler', cat: 'adventure', catLabel: 'studio-spec street tracker', price: 2050000, img: '/images/hero-studio.webp', specs: ['Travel 180 mm', '95 km/h'] },
  { id: '0001-pro-r', name: 'SOKO Pro R', cat: 'performance', catLabel: 'track tune, road plates', price: 2690000, img: '/images/collage-architecture.webp', specs: ['9.2 kW', '130 km/h'] },
  { id: 'acc-helmet', name: 'SOKO Aero Helmet', cat: 'accessory', catLabel: 'full-face, ECE-certified', price: 85000, img: '/images/accessory-helmet.webp', specs: ['ECE 22.06', 'Weight 1,180 g'] },
  { id: 'acc-battery', name: 'SOKO Swap Battery', cat: 'accessory', catLabel: 'second pack, swap and go', price: 320000, img: '/images/accessory-battery.webp', specs: ['2.9 kWh', 'Weight 14 kg'] },
  { id: 'acc-charger', name: 'SOKO Fast Charger', cat: 'accessory', catLabel: '0 to 80% in two hours', price: 145000, img: '/images/tech-battery.webp', specs: ['Output 3.6 kW', '0 to 80% 2 h'] },
  { id: 'acc-lock', name: 'SOKO Smart Lock', cat: 'accessory', catLabel: 'GPS, alarm, app remote', price: 65000, img: '/images/tech-gps.webp', specs: ['Tracking GPS', 'Alarm 110 dB'] },
  { id: 'acc-gloves', name: 'SOKO Ride Gloves', cat: 'accessory', catLabel: 'knuckle armour, touchscreen tips', price: 28000, img: '/images/collage-gloves.webp', specs: ['Armour Knuckle', 'Sizes S to XXL'] },
  { id: 'acc-openface', name: 'SOKO Open-face Helmet', cat: 'accessory', catLabel: 'city helmet, ECE-certified', price: 62000, img: '/images/collage-helmet.webp', specs: ['ECE 22.06', 'Weight 980 g'] },
  { id: 'acc-lights', name: 'SOKO Ring Light Kit', cat: 'accessory', catLabel: 'signature ring LED upgrade', price: 48000, img: '/images/tech-lights.webp', specs: ['Output 2,400 lm', 'Fits 01, 02'] },
  { id: 'acc-mount', name: 'SOKO Ride Mount', cat: 'accessory', catLabel: 'phone dock with live telemetry', price: 22000, img: '/images/tech-app.webp', specs: ['Charging USB-C 18 W', 'Fits All models'] },
  { id: 'acc-disclock', name: 'SOKO Disc Lock', cat: 'accessory', catLabel: 'hardened disc lock with reminder cable', price: 38000, img: '/images/tech-lock.webp', specs: ['Shackle 10 mm', 'Alarm Motion'] },
  { id: 'acc-topbox', name: 'SOKO Top Box 45 L', cat: 'accessory', catLabel: 'lockable, quick-release', price: 95000, img: '/images/lifestyle-1.webp', specs: ['Volume 45 L', 'Fits 01, 02, 04'] },
];

export const CATS = [
  { key: 'all', label: 'All' },
  { key: 'commuter', label: 'Commuter' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'adventure', label: 'Adventure' },
  { key: 'performance', label: 'Performance' },
  { key: 'accessory', label: 'Accessories' },
];

export const money = (n) => '₦' + Number(n || 0).toLocaleString('en-NG');
