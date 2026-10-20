// Checks the built app (dist/) against Honeyleaf's rules:
//  1. nothing points at another domain (no CDNs, fonts, analytics);
//  2. no system or UI-kit fonts are named in the styles;
//  3. the first load stays under 1.5 MB gzipped.

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
if (!existsSync(dist)) {
  console.error('dist/ is missing: run `npm run build` first.');
  process.exit(1);
}

const walk = (dir) => readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : [join(dir, name)]));
const files = walk(dist);
const text = files.filter((f) => /\.(html|js|css|json|svg|webmanifest|txt)$/.test(f) && !f.includes(`${join('library', 'fonts')}`));
const problems = [];

// 1. Foreign URLs. Strings that are never fetched are allowed: SVG namespaces
//    and links inside libraries' error messages (React, ProseMirror).
const ALLOWED = [/^https?:\/\/www\.w3\.org\//, /^https:\/\/react\.dev\/errors\//, /^https:\/\/reactjs\.org\/docs\/error-decoder/, /^https:\/\/prosemirror\.net\/docs\//];
for (const f of text) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/https?:\/\/[^\s"'`)<>\\]+/g)) {
    if (!ALLOWED.some((re) => re.test(m[0]))) problems.push(`${relative(dist, f)}: refers to another site: ${m[0].slice(0, 80)}`);
  }
}

// 2. Fonts: only our own self-hosted families (generic fallbacks are fine).
const FORBIDDEN = [/\bInter\b/, /\bRoboto\b/, /system-ui/, /-apple-system/, /Segoe UI/, /Helvetica/, /\bArial\b/, /BlinkMacSystemFont/];
for (const f of files.filter((x) => x.endsWith('.css'))) {
  const css = readFileSync(f, 'utf8');
  for (const re of FORBIDDEN) if (re.test(css)) problems.push(`${relative(dist, f)}: names a system/UI-kit font (${re.source})`);
}

// 3. First load: the shell, the boot fonts, textures, the desk's art and manifests.
const gz = (f) => gzipSync(readFileSync(f)).length;
const raw = (f) => statSync(f).size;
const pick = (pattern) => files.filter((f) => pattern.test(relative(dist, f).replaceAll('\\', '/')));
const bootFonts = ['patrick-hand', 'caveat', 'dancing-script', 'special-elite', 'lora'];
const groups = {
  shell: pick(/^(index\.html|assets\/index-[^/]+\.(js|css))$/),
  fonts: pick(new RegExp(`^library/fonts/(${bootFonts.join('|')})/[^/]+-latin-400\\.woff2$`)),
  textures: pick(/^library\/textures\//),
  desk: pick(/^library\/props\//),
  manifests: pick(/^library\/manifests\//),
};
let total = 0;
for (const [name, list] of Object.entries(groups)) {
  const size = list.reduce((n, f) => n + (f.endsWith('.woff2') || f.endsWith('.png') ? raw(f) : gz(f)), 0);
  total += size;
  console.log(`  ${name.padEnd(10)} ${(size / 1024).toFixed(0).padStart(6)} KB  (${list.length} files)`);
}
console.log(`  ${'total'.padEnd(10)} ${(total / 1024).toFixed(0).padStart(6)} KB gzipped`);
if (total > 1.5 * 1024 * 1024) problems.push(`first load is ${(total / 1024 / 1024).toFixed(2)} MB gzipped (budget 1.5 MB)`);

if (problems.length) {
  console.error('\nDist check failed:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('Dist check passed: no foreign URLs, no system fonts, first load within budget.');
