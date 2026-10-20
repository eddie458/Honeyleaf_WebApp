// Bakes the white die-cut border into every sticker.
//
// Source art lives in client/assets-src/stickers/<pack>/<name>.svg with the
// drawing inside <g id="art">. The baked copy (written to
// client/public/library/stickers) draws the same shapes first with a thick
// white stroke, so the sticker gets a real die-cut outline that follows its
// silhouette. Every entry in manifests/stickers.json must have a source file.

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'client/assets-src/stickers');
const outDir = join(root, 'client/public/library/stickers');
const manifest = JSON.parse(readFileSync(join(root, 'client/public/library/manifests/stickers.json'), 'utf8'));
const BORDER = 7; // half the die-cut stroke, in source units
const PAD = BORDER + 3;

function extractGroup(svg, id) {
  const idAt = svg.indexOf(`id="${id}"`);
  if (idAt < 0) return null;
  const start = svg.lastIndexOf('<g', idAt);
  if (start < 0) return null;
  const openEnd = svg.indexOf('>', start) + 1;
  const tag = /<g\b|<\/g>/g;
  tag.lastIndex = openEnd;
  let depth = 1;
  let m;
  while ((m = tag.exec(svg))) {
    depth += m[0] === '</g>' ? -1 : 1;
    if (depth === 0) return svg.slice(openEnd, m.index);
  }
  return null;
}

function bake(svg, file) {
  const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1]?.split(/[\s,]+/).map(Number);
  if (!viewBox || viewBox.length !== 4) throw new Error(`${file}: missing viewBox`);
  const art = extractGroup(svg, 'art');
  if (art === null) throw new Error(`${file}: the drawing must be inside <g id="art">`);
  const defs = svg.match(/<defs>[\s\S]*?<\/defs>/)?.[0] ?? '';
  const [x, y, w, h] = viewBox;
  const cut = art.replace(/\sid="[^"]*"/g, '');
  const style =
    `<style>.cut *{fill:#fff!important;stroke:#fff!important;stroke-width:${BORDER * 2}px!important;` +
    `stroke-linejoin:round!important;stroke-linecap:round!important;stroke-dasharray:none!important;` +
    `opacity:1!important;filter:none!important}.cut [fill="none"]{fill:none!important}</style>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x - PAD} ${y - PAD} ${w + PAD * 2} ${h + PAD * 2}" ` +
    `width="${w + PAD * 2}" height="${h + PAD * 2}">${defs}${style}` +
    `<g class="cut">${cut}</g><g>${art}</g></svg>\n`
  );
}

rmSync(outDir, { recursive: true, force: true });
const problems = [];
let count = 0;
for (const pack of manifest.packs) {
  mkdirSync(join(outDir, pack.id), { recursive: true });
  for (const sticker of pack.stickers) {
    const src = join(srcDir, pack.id, `${sticker.id}.svg`);
    if (!existsSync(src)) {
      problems.push(`${pack.id}/${sticker.id}: no source file at ${src}`);
      continue;
    }
    try {
      writeFileSync(join(outDir, pack.id, `${sticker.id}.svg`), bake(readFileSync(src, 'utf8'), src));
      count++;
    } catch (e) {
      problems.push(e.message);
    }
  }
}
// Source files that no manifest line mentions are probably a forgotten line.
for (const pack of readdirSync(srcDir)) {
  const listed = new Set(manifest.packs.find((p) => p.id === pack)?.stickers.map((s) => s.id) ?? []);
  for (const f of readdirSync(join(srcDir, pack))) {
    if (f.endsWith('.svg') && !listed.has(f.slice(0, -4))) console.warn(`note: ${pack}/${f} is not in stickers.json`);
  }
}
if (problems.length) {
  console.error('Sticker build failed:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log(`${count} stickers baked with die-cut borders`);
