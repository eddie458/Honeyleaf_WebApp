// Copies self-hosted fonts out of the Fontsource packages, checks accent
// coverage, measures real metrics and writes library/manifests/fonts.json.
//
// Normalization: every family gets a size-adjust so its optical size matches
// the target (clamped), and ascent/descent overrides so that, after
// size-adjust, all fonts share one ascent and descent. The result: the same
// font-size looks the same size in every family and sits on the same baseline.
//
// Optical size blends x-height with cap height, because pure x-height
// matching gives script fonts enormous capitals. Both are measured from the
// real glyph outlines: several fonts ship wrong OS/2 xHeight values.

import { createRequire } from 'node:module';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const fontkit = require('fontkit');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = JSON.parse(readFileSync(join(root, 'client/assets-src/fonts.json'), 'utf8'));
const libDir = join(root, 'client/public/library');
const outFonts = join(libDir, 'fonts');
const outLicenses = join(root, 'licenses/fonts');
const SUBSETS = ['latin', 'latin-ext'];
// Characters every font must render (the brief asks for á, é, ñ and ü at least).
const MUST_HAVE = 'áéíóúÁÉÍÓÚñÑüÜçÇàèìòùâêîôûäëïöÿß¿¡«»€';

rmSync(outFonts, { recursive: true, force: true });
mkdirSync(outFonts, { recursive: true });
mkdirSync(outLicenses, { recursive: true });
mkdirSync(join(libDir, 'manifests'), { recursive: true });

const { target } = source;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round = (v) => Math.round(v * 10000) / 10000;
const problems = [];
const manifest = { version: 1, generated: 'scripts/build-fonts.mjs', fonts: [] };
// Credits (with their links) go to licenses/fonts/, not into the shipped
// manifest: the app never needs them, and no other site's address ships.
const credits = [];

for (const f of source.fonts) {
  const pkgDir = join(root, 'node_modules/@fontsource', f.pkg);
  if (!existsSync(pkgDir)) {
    problems.push(`${f.id}: package @fontsource/${f.pkg} is not installed`);
    continue;
  }
  const meta = JSON.parse(readFileSync(join(pkgDir, 'metadata.json'), 'utf8'));
  const ranges = JSON.parse(readFileSync(join(pkgDir, 'unicode.json'), 'utf8'));
  const license = meta.license?.type ?? 'unknown';
  if (!['OFL-1.1', 'Apache-2.0'].includes(license)) problems.push(`${f.id}: license ${license} is not allowed`);

  const dir = join(outFonts, f.id);
  mkdirSync(dir, { recursive: true });
  copyFileSync(join(pkgDir, 'LICENSE'), join(dir, 'LICENSE.txt'));
  copyFileSync(join(pkgDir, 'LICENSE'), join(outLicenses, `${f.id}.txt`));

  const faces = [];
  for (const weight of f.weights) {
    if (!meta.weights.includes(weight)) {
      problems.push(`${f.id}: weight ${weight} not available (has ${meta.weights.join(', ')})`);
      continue;
    }
    for (const subset of SUBSETS) {
      if (!meta.subsets.includes(subset)) continue;
      const file = `${f.pkg}-${subset}-${weight}-normal.woff2`;
      const from = join(pkgDir, 'files', file);
      if (!existsSync(from)) {
        problems.push(`${f.id}: missing ${file}`);
        continue;
      }
      const name = `${f.id}-${subset}-${weight}.woff2`;
      copyFileSync(from, join(dir, name));
      faces.push({ weight, subset, file: `fonts/${f.id}/${name}`, unicodeRange: ranges[subset] });
    }
  }

  // Metrics and coverage come from the regular latin face.
  const regular = join(pkgDir, 'files', `${f.pkg}-latin-${f.weights[0]}-normal.woff2`);
  const font = fontkit.openSync(regular);
  const upm = font.unitsPerEm;
  const glyphTop = (ch) => font.glyphForCodePoint(ch.codePointAt(0)).bbox.maxY;
  const xHeight = glyphTop('x') / upm;
  const capHeight = glyphTop('H') / upm;
  const optical = (1 - target.capWeight) * xHeight + target.capWeight * capHeight * target.capToX;
  const missing = [...MUST_HAVE].filter((ch) => !font.hasGlyphForCodePoint(ch.codePointAt(0)));
  if (missing.length) problems.push(`${f.id}: missing glyphs ${missing.join(' ')}`);

  credits.push(`${f.name} (${license}): ${meta.license?.attribution ?? 'see LICENSE'}`);
  const sizeAdjust = clamp((target.optical / optical) * (f.tweak ?? 1), target.minAdjust, target.maxAdjust);
  manifest.fonts.push({
    id: f.id,
    name: f.name,
    family: `HL ${f.name}`,
    category: f.category,
    license,
    weights: f.weights.filter((w) => meta.weights.includes(w)),
    faces,
    metrics: {
      sizeAdjust: round(sizeAdjust),
      // Overrides are scaled by size-adjust, so divide to land on the target.
      ascentOverride: round(target.ascent / sizeAdjust),
      descentOverride: round(target.descent / sizeAdjust),
      lineGapOverride: 0,
    },
    measured: { unitsPerEm: upm, xHeight: round(xHeight), capHeight: round(capHeight), optical: round(optical) },
  });
  console.log(
    `${f.id.padEnd(16)} x-height ${xHeight.toFixed(3)}  cap ${capHeight.toFixed(3)}  optical ${optical.toFixed(3)}  size-adjust ${(sizeAdjust * 100).toFixed(1)}%  faces ${faces.length}`,
  );
}

if (problems.length) {
  console.error('\nFont build failed:\n  ' + problems.join('\n  '));
  process.exit(1);
}

writeFileSync(join(libDir, 'manifests/fonts.json'), JSON.stringify(manifest, null, 2) + '\n');
writeFileSync(join(outLicenses, 'CREDITS.txt'), `The fonts in Honeyleaf and their licenses (full texts beside this file):\n\n${credits.join('\n')}\n`);
console.log(`\nfonts.json written (${manifest.fonts.length} families)`);
