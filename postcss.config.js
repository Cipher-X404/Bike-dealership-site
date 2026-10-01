// PostCSS v8 pipeline.
// NOTE: With Tailwind CSS v4 + the @tailwindcss/vite plugin, Tailwind's own
// handling (including vendor prefixing) runs through the plugin, so
// postcss.config.js mainly exists here for extra plugins such as Autoprefixer.
export default {
  plugins: {
    // Run first so it can add vendor prefixes to everything else.
    autoprefixer: {},
    // Intentionally minimal — Tailwind v4 is wired up via vite.config.js,
    // not through PostCSS.
  },
};
