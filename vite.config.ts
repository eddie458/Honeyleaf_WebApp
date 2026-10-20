import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { mockApi } from './scripts/dev/mock-api.mjs';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * Records which npm packages actually end up in the built bundle, so the
 * license check (scripts/check-licenses.mjs) judges what ships, not every
 * package that happens to be installed.
 */
function bundledPackages(): Plugin {
  return {
    name: 'honeyleaf-bundled-packages',
    apply: 'build',
    generateBundle(_options, bundle) {
      const packages = new Set<string>();
      for (const out of Object.values(bundle)) {
        if (out.type !== 'chunk') continue;
        const ids = (out as { moduleIds?: string[] }).moduleIds ?? Object.keys(out.modules ?? {});
        for (const id of ids) {
          const found = id.replaceAll('\\', '/').match(/node_modules\/((?:@[^/]+\/)?[^/]+)/g);
          const last = found?.[found.length - 1];
          if (last) packages.add(last.slice('node_modules/'.length));
        }
      }
      mkdirSync(here('./node_modules/.honeyleaf'), { recursive: true });
      writeFileSync(here('./node_modules/.honeyleaf/bundled.json'), JSON.stringify([...packages].sort(), null, 2) + '\n');
    },
  };
}

export default defineConfig(({ mode }) => ({
  root: here('./client'),
  // Relative base: index.php adds a <base href> for wherever the diary lives,
  // so the same build works at the domain root or in a subfolder.
  base: './',
  // `npm run dev:mock` answers /api from memory (development only).
  plugins: [react(), bundledPackages(), ...(mode === 'mock' ? [mockApi()] : [])],
  build: {
    outDir: here('./dist'),
    emptyOutDir: true,
    assetsDir: 'assets',
    target: 'es2022',
    sourcemap: false,
    // One ~300 KB (gzipped) bundle is fine for a diary that stays open;
    // scripts/check-dist.mjs keeps the whole first load under 1.5 MB.
    chunkSizeWarningLimit: 1100,
  },
  server: {
    port: 5173,
    // `npm run dev` talks to the PHP server on :8787 (`npm run api`, see README).
    proxy: mode === 'mock' ? undefined : { '/api': { target: 'http://127.0.0.1:8787' } },
  },
  css: { modules: { localsConvention: 'camelCaseOnly' as const } },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
}));
