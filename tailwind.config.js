// ---------------------------------------------------------------------------
// Tailwind CSS v4 — configuration shim (optional)
// ---------------------------------------------------------------------------
// Tailwind v4 is "CSS-first": the real config lives in the CSS via
// @theme { ... } inside src/css/main.css. This file exists only as a
// compatibility entry point (e.g. for editor integrations/tooling that still
// look for a tailwind.config.js) and for any JS-driven config later.
//
// Anything placed here will NOT automatically apply — v4 does not read this
// file by default. Migrate values into @theme in the CSS when needed.
// ---------------------------------------------------------------------------
export default {
  content: [
    './index.html',
    './pages/**/*.html',
    './src/**/*.{js,html,css}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
