// Seeded, tileable gradient noise for procedural textures.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * 2-D Perlin noise that tiles with period (px, py) lattice cells.
 * Returns roughly [-1, 1].
 */
export function makePeriodicNoise(seed) {
  const rand = mulberry32(seed);
  const perm = new Uint16Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const gx = new Float32Array(256);
  const gy = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const a = rand() * Math.PI * 2;
    gx[i] = Math.cos(a);
    gy[i] = Math.sin(a);
  }
  const mod = (a, m) => ((a % m) + m) % m;
  const grad = (ix, iy, px, py, dx, dy) => {
    const h = perm[(perm[mod(ix, px) & 255] + mod(iy, py)) & 511];
    return gx[h] * dx + gy[h] * dy;
  };
  return (x, y, px = 256, py = 256) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const u = fade(fx);
    const v = fade(fy);
    const n00 = grad(x0, y0, px, py, fx, fy);
    const n10 = grad(x0 + 1, y0, px, py, fx - 1, fy);
    const n01 = grad(x0, y0 + 1, px, py, fx, fy - 1);
    const n11 = grad(x0 + 1, y0 + 1, px, py, fx - 1, fy - 1);
    return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v) * 1.41;
  };
}

/** Fractal sum of periodic noise. Periods double with each octave. */
export function fbm(noise, x, y, px, py, octaves = 4, gain = 0.5) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise(x * f, y * f, px * f, py * f);
    norm += amp;
    amp *= gain;
    f *= 2;
  }
  return sum / norm;
}

export const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
