// Every library that ships to the browser must carry one of the allowed
// open licenses. "Ships" means "is in the built bundle": the build records
// that list (vite.config.ts, bundledPackages). Packages that are installed
// but never bundled (build tools, unused helpers) are listed, not judged.
// Writes the shipped libraries' license texts to licenses/THIRD-PARTY.txt.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ALLOWED = new Set(['MIT', 'ISC', 'Apache-2.0', 'OFL-1.1', 'CC0-1.0']);
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const bundledFile = join(root, 'node_modules', '.honeyleaf', 'bundled.json');
if (!existsSync(bundledFile)) {
  console.error('No record of the built bundle: run `npm run build` first.');
  process.exit(1);
}
const shipped = new Set(JSON.parse(readFileSync(bundledFile, 'utf8')));

/** Everything the runtime dependencies pull in, resolved like Node does. */
const installed = new Map();
function visit(name, fromDir) {
  if (installed.has(name)) return;
  let dir = fromDir;
  let pkgDir = null;
  for (;;) {
    const candidate = join(dir, 'node_modules', name);
    if (existsSync(join(candidate, 'package.json'))) {
      pkgDir = candidate;
      break;
    }
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  if (!pkgDir) return;
  const meta = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
  const license = typeof meta.license === 'string' ? meta.license : (meta.license?.type ?? 'UNKNOWN');
  installed.set(name, { version: meta.version, license, dir: pkgDir });
  for (const dep of Object.keys(meta.dependencies ?? {})) visit(dep, pkgDir);
  for (const dep of Object.keys(meta.peerDependencies ?? {})) if (!meta.peerDependenciesMeta?.[dep]?.optional) visit(dep, pkgDir);
}
for (const dep of Object.keys(pkg.dependencies ?? {})) visit(dep, root);
for (const name of shipped) if (!installed.has(name)) visit(name, root);

const bad = [];
let notices = 'Honeyleaf ships these open-source libraries in its code. Their licenses follow.\n(Fonts: see licenses/fonts/.)\n\n';
console.log('Shipped in the bundle:');
for (const name of [...shipped].sort()) {
  const info = installed.get(name);
  if (!info) {
    bad.push(`${name} (not found in node_modules)`);
    continue;
  }
  const ok = info.license.split(/\s+OR\s+|[()]/).some((l) => ALLOWED.has(l.trim()));
  console.log(`  ${ok ? 'ok ' : 'NO '} ${name}@${info.version}  ${info.license}`);
  if (!ok) bad.push(`${name}@${info.version} (${info.license})`);
  const file = readdirSync(info.dir).find((f) => /^(licen[sc]e|copying)/i.test(f));
  notices += `==== ${name}@${info.version} (${info.license}) ====\n${file ? readFileSync(join(info.dir, file), 'utf8').trim() : '(license text not included in the package)'}\n\n`;
}
const unused = [...installed.keys()].filter((n) => !shipped.has(n)).sort();
if (unused.length) console.log(`Installed but not in the bundle (not judged): ${unused.map((n) => `${n} (${installed.get(n).license})`).join(', ')}`);

mkdirSync(join(root, 'licenses'), { recursive: true });
writeFileSync(join(root, 'licenses', 'THIRD-PARTY.txt'), notices);

if (bad.length) {
  console.error('\nThese shipped libraries are not under an allowed license:\n  ' + bad.join('\n  '));
  process.exit(1);
}
console.log(`\nAll ${shipped.size} shipped libraries are MIT, ISC, Apache-2.0, OFL-1.1 or CC0-1.0.`);
