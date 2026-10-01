// DOM harness: boots a page (source HTML + inlined partials) in jsdom,
// loads the real app module graph (CSS stubbed), runs the page's inline
// scripts, then executes the named test.
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const ROOT = '/home/user/project';
const page = process.argv[2] || 'index.html';
const testName = process.argv[3] || 'generic';

const navbar = fs.readFileSync(path.join(ROOT, 'src/components/navbar.html'), 'utf8');
const footer = fs.readFileSync(path.join(ROOT, 'src/components/footer.html'), 'utf8');
let html = fs.readFileSync(path.join(ROOT, page), 'utf8');
html = html.replaceAll('<!-- @@NAVBAR@@ -->', navbar);
html = html.replaceAll('<!-- @@FOOTER@@ -->', footer);

const url = 'http://localhost/' + page;
const dom = new JSDOM(html, { url, runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;

// ── localStorage shim (Map-based, set before app modules run) ──────────
const store = new Map();
const localStorageShim = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => void store.set(String(k), String(v)),
  removeItem: (k) => void store.delete(String(k)),
  clear: () => void store.clear(),
  key: (i) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};
globalThis.localStorage = localStorageShim;
const sessionStore = new Map();
globalThis.sessionStorage = {
  getItem: (k) => (sessionStore.has(k) ? sessionStore.get(k) : null),
  setItem: (k, v) => void sessionStore.set(String(k), String(v)),
  removeItem: (k) => void sessionStore.delete(String(k)),
  clear: () => void sessionStore.clear(),
};
Object.defineProperty(window, '__harnessStorage', { value: localStorageShim });

// ── Global surface the app expects ─────────────────────────────────────
const g = globalThis;
g.window = window;
g.document = window.document;
g.navigator = window.navigator;
g.location = window.location;
g.history = window.history;
g.Window = window.Window;
g.HTMLElement = window.HTMLElement;
g.Element = window.Element;
g.Node = window.Node;
g.SVGElement = window.SVGElement;
g.CustomEvent = window.CustomEvent;
g.Event = window.Event;
g.MutationObserver = window.MutationObserver;
g.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
window.HTMLElement.prototype.scrollIntoView = () => {};
g.IntersectionObserver = class {
  constructor(cb) { this.cb = cb; }
  observe() { this.cb([], this); }
  unobserve() {} disconnect() {} takeRecords() { return []; }
};
g.getComputedStyle = window.getComputedStyle.bind(window);
g.matchMedia = (q) => ({
  matches: false, media: q, onchange: null,
  addListener() {}, removeListener() {},
  addEventListener() {}, removeEventListener() {},
  dispatchEvent() { return false; },
});
window.matchMedia = g.matchMedia;
g.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
g.cancelAnimationFrame = (id) => clearTimeout(id);
window.requestAnimationFrame = g.requestAnimationFrame;
window.cancelAnimationFrame = g.cancelAnimationFrame;
g.scrollTo = () => {};
g.requestIdleCallback = (cb) => setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 50 }), 0);
g.cancelIdleCallback = (id) => clearTimeout(id);
// performance: keep Node's; do NOT clobber jsdom's.
window.scrollTo = () => {};
window.scrollBy = () => {};
if (!window.matchMedia) window.matchMedia = g.matchMedia;

// ── HTMLMediaElement: jsdom play() returns undefined; app expects Promise ─
try {
  const proto = window.HTMLMediaElement.prototype;
  proto.play = () => Promise.resolve();
  proto.pause = () => {};
  Object.defineProperty(proto, 'currentTime', { configurable: true, get() { return 0; }, set() {} });
} catch {}

// ── Optional pre-boot store seed (HARNESS_SEED = '{"k":"v"}') ──────────
if (process.env.HARNESS_SEED) {
  try {
    const seed = JSON.parse(process.env.HARNESS_SEED);
    for (const [k, v] of Object.entries(seed)) store.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  } catch (e) { console.error('bad HARNESS_SEED', e.message); }
}

// ── Errors we want to see ──────────────────────────────────────────────
const errors = [];
window.addEventListener('error', (e) => errors.push('window.onerror: ' + e.message));
window.console.error = (...a) => errors.push('console.error: ' + a.map(String).join(' ').slice(0, 300));

// ── Boot the real app graph ────────────────────────────────────────────
await import(path.join(ROOT, 'src/js/main.js'));

// ── Load external <script type="module" src> page controllers ─────────
const extScripts = [...html.matchAll(/<script\b[^>]*>/g)]
  .map((m) => m[0])
  .filter((tag) => /type=["']module["']/.test(tag) && /src=["']/.test(tag))
  .map((tag) => (tag.match(/src=["']([^"']+)["']/) || [])[1])
  .filter((s) => s && s.startsWith('/src/') && s !== '/src/js/main.js');
const seen = new Set(['/src/js/main.js']);
for (const src of extScripts) {
  if (seen.has(src)) continue;
  seen.add(src);
  const abs = path.join(ROOT, src);
  let code = fs.readFileSync(abs, 'utf8');
  code = code.replaceAll('/src/js/', path.join(ROOT, 'src/js') + '/');
  const tmp = path.join(ROOT, `__ext_${testName}_${seen.size}.mjs`);
  fs.writeFileSync(tmp, code);
  try {
    await import(pathToFileURLish(tmp));
  } catch (err) {
    errors.push(`ext:${src}: ${err.message}`);
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
}

// ── Run the page's inline <script> blocks (module imports rewritten) ──
const inlineScripts = [...html.matchAll(/<script(?![^>]*src)([^>]*)>([\s\S]*?)<\/script>/g)]
  .filter((m) => !/type\s*=\s*["'](?!module|text\/javascript)/.test(m[1])) // skip JSON-LD etc.
  .map((m) => m[2]);
for (let i = 0; i < inlineScripts.length; i++) {
  let code = inlineScripts[i].trim();
  if (!code) continue;
  code = code.replaceAll('/src/js/', path.join(ROOT, 'src/js') + '/');
  const tmp = path.join(ROOT, `__inline_${testName}_${i}.mjs`);
  fs.writeFileSync(tmp, code);
  try {
    await import(pathToFileURLish(tmp));
  } catch (err) {
    errors.push(`inline#${i}: ${err.message}`);
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
}

// ── Let async init / rAFs settle ───────────────────────────────────────
await new Promise((r) => setTimeout(r, 900));

// ── Run the test ───────────────────────────────────────────────────────
const tests = (await import('./tests.mjs')).default;
const t = tests[testName];
if (!t) { console.log(`NO TEST "${testName}"`); process.exit(2); }

let failures = 0;
const q = (s, w = window) => w.document.querySelector(s);
const qa = (s, w = window) => [...w.document.querySelectorAll(s)];
const expect = (cond, label) => {
  if (cond) { console.log(`  ok  ${label}`); }
  else { failures++; console.log(`  FAIL ${label}`); }
};

try {
  await t.run({ window, document: window.document, q, qa, store, expect });
} catch (err) {
  failures++;
  console.log('  FAIL threw: ' + (err && err.stack ? err.stack.split('\n').slice(0, 4).join(' | ') : String(err)));
}

const noise = ['Missing plugin', 'Invalid property scrollTrigger', 'Not implemented'];
const realErrors = errors.filter((e) => !noise.some((n) => e.includes(n)));
if (realErrors.length) {
  failures += realErrors.length;
  console.log('  JS ERRORS:');
  realErrors.slice(0, 8).forEach((e) => console.log('   ' + e));
}

console.log(failures === 0 ? `PASS ${testName}` : `FAIL(${failures}) ${testName}`);
process.exit(failures === 0 ? 0 : 1);

function pathToFileURLish(p) {
  return 'file://' + p;
}
