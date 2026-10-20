// Generates tileable procedural textures into client/public/library/textures.
// Textures are grayscale "light maps": the app multiplies them over a scene
// color, so one file serves every tint (honey oak, painted pine, dark attic…).
//
//   wood-planks.gen.png  1024×384, three full-length glued boards, seamless
//
// Only the large, smooth grain lives in the PNG (it compresses well and
// scales up softly). Fine fibers, pores, paper grain, leather, kraft, linen
// and the stamp speckle are small hand-written SVG noise textures next to it,
// which the browser renders crisply at any zoom.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng } from './lib/png.mjs';
import { makePeriodicNoise, fbm, mulberry32, smoothstep } from './lib/noise.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'client/public/library/textures');
mkdirSync(outDir, { recursive: true });

/**
 * Flat-sawn boards: each board is a plane cut through a slightly tapering log.
 * The ring index is the distance from the pith line. Boards cut away from the
 * pith (pith outside the board) show long, gently waving grain; a board cut
 * near the pith shows figured arches. Knots bend the rings around them. The
 * taper is periodic so the tile wraps horizontally.
 */
function woodPlanks({ width = 1024, height = 384, seed = 23 } = {}) {
  const px = new Uint8Array(width * height);
  const rand = mulberry32(seed);
  const warpNoise = makePeriodicNoise(seed + 1);
  const streakNoise = makePeriodicNoise(seed + 2);
  const toneNoise = makePeriodicNoise(seed + 3);

  // Three full-length boards with hand-picked character.
  const spec = [
    { tone: 0.985, center: -0.55, across: 5, lift: 0.5, taper: 1.6, knots: [{ u: 0.72, v: 0.62, size: 0.05 }] },
    { tone: 0.955, center: 0.5, across: 4.5, lift: 1.8, taper: 2.4, knots: [] },
    { tone: 1.0, center: 1.5, across: 5.5, lift: 0.4, taper: 1.9, knots: [{ u: 0.18, v: 0.35, size: 0.035 }] },
  ].map((b) => ({ ...b, phase: rand(), phase2: rand(), wobble: rand() }));
  const boards = spec.length;
  const boardH = height / boards;

  const ringHash = (i, b) => {
    const s = Math.sin(i * 127.1 + b * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  // Wrapped horizontal distance so knots near the tile edge tile cleanly.
  const du = (a, b) => {
    const d = Math.abs(a - b) % 1;
    return Math.min(d, 1 - d);
  };

  for (let y = 0; y < height; y++) {
    const b = Math.min(boards - 1, Math.floor(y / boardH));
    const s = spec[b];
    const v = (y - b * boardH) / boardH;
    for (let x = 0; x < width; x++) {
      const u = x / width;
      const c = s.center + 0.05 * Math.sin(2 * Math.PI * (u + s.wobble));
      const dv = (v - c) * s.across * 2;
      const warp = 0.5 * fbm(warpNoise, u * 6, v * 2 + b * 3.7, 6, 64, 3);
      let r =
        Math.sqrt(dv * dv + s.lift * s.lift) +
        s.taper * Math.sin(2 * Math.PI * (u + s.phase)) +
        0.5 * Math.sin(2 * Math.PI * (2 * u + s.phase2)) +
        warp;

      // Knots: rings swell around them; the knot itself is a dark core.
      let knotDark = 0;
      for (const k of s.knots) {
        const kx = du(u, k.u) / (k.size * 2.6); // stretched along the grain
        const ky = (v - k.v) / (k.size * 4.5);
        const d2 = kx * kx + ky * ky;
        r += 2.2 * Math.exp(-d2 * 1.2);
        const d = Math.sqrt(d2);
        knotDark = Math.max(knotDark, 1 - smoothstep(0.12, 0.32, d));
      }

      r = Math.max(0, r);
      const ring = Math.floor(r);
      const t = r - ring;
      const h = ringHash(ring, b);
      // Late wood: a soft, fairly broad dark band near the end of each ring.
      const start = 0.42 + h * 0.2;
      const late = smoothstep(start, start + 0.36, t) * (1 - smoothstep(0.9, 1, t));
      const lateAmp = 0.06 + h * 0.07;

      const streak = fbm(streakNoise, u * 48, v * 10 + b * 9.1, 48, 64, 2);
      const drift = fbm(toneNoise, u * 3, v * 0.8 + b * 1.9, 3, 64, 2);

      let l = s.tone - late * lateAmp - (streak * 0.5 + 0.5) * 0.04 + drift * 0.035 - knotDark * 0.28;

      const edge = y - b * boardH;
      if (edge === 0) l -= 0.16;
      else if (edge === 1) l -= 0.05;
      else if (edge >= boardH - 2) l -= 0.03;

      px[y * width + x] = Math.max(0, Math.min(255, Math.round(l * 255)));
    }
  }
  return encodePng(width, height, px, 1);
}

const wood = woodPlanks();
writeFileSync(join(outDir, 'wood-planks.gen.png'), wood);
console.log(`wood-planks.gen.png  ${(wood.length / 1024).toFixed(0)} KB`);
