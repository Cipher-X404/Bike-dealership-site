import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
import { readdirSync, readFileSync } from 'node:fs';

// ---------------------------------------------------------------------------
// Shared partial injection (navbar + footer)
// ---------------------------------------------------------------------------
// Pages contain <!-- @@NAVBAR@@ --> and <!-- @@FOOTER@@ --> markers; this
// plugin inlines the shared fragments (src/components/*.html) at serve/build
// time so dev and build produce identical markup without a separate build step.
const partials = {
  '<!-- @@NAVBAR@@ -->': () => readFileSync(resolve(import.meta.dirname, 'src/components/navbar.html'), 'utf-8'),
  '<!-- @@FOOTER@@ -->': () => readFileSync(resolve(import.meta.dirname, 'src/components/footer.html'), 'utf-8'),
};

function injectPartials() {
  return {
    name: 'inject-partials',
    transformIndexHtml(html) {
      let out = html;
      for (const [marker, read] of Object.entries(partials)) {
        out = out.replace(marker, read());
      }
      return out;
    },
  };
}

// ---------------------------------------------------------------------------
// Multi-page app (MPA) — build input map
// ---------------------------------------------------------------------------
// Every "page" is its own HTML entry point:
//   - index.html        → sources root of the project (public home)
//   - pages/*.html      → flattened into the site root on build (e.g.
//                         pages/shop.html builds to shop.html)
//
// `rollupOptions.input` mirrors WHAT vite (the dev server middleware) does at
// runtime for root-relative URLs like /shop.html, so dev and build always
// agree on which URLs exist.
// ---------------------------------------------------------------------------

const pagesDir = resolve(import.meta.dirname, 'pages');

const pageEntries = Object.fromEntries(
  readdirSync(pagesDir)
    .filter((file) => file.endsWith('.html'))
    .map((file) => [
      /* export name           */ file.replace(/\.html$/, ''),
      /* absolute source path  */ resolve(pagesDir, file),
    ]),
);

export default defineConfig({
  // Tailwind CSS v4 via the official Vite plugin + shared partial injection.
  plugins: [tailwindcss(), injectPartials()],

  server: {
    host: true,
    // Allow the sandboxed preview host (any *.e2b.app subdomain).
    allowedHosts: ['.e2b.app'],
  },

  build: {
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        ...pageEntries,
      },
    },
  },
});
