// Shadows always fall to the bottom-right (light from the top-left), however
// a decoration is turned or flipped. CSS drop-shadow offsets are applied in the
// element's own rotated space, so the desk-space offset is counter-rotated.

export function localOffset(rotDeg: number, flipX: boolean | undefined, dx: number, dy: number): [number, number] {
  const a = (rotDeg * Math.PI) / 180;
  let x = Math.cos(a) * dx + Math.sin(a) * dy;
  const y = -Math.sin(a) * dx + Math.cos(a) * dy;
  if (flipX) x = -x;
  return [x, y];
}

export function dropShadow(rotDeg: number, flipX: boolean | undefined, dx: number, dy: number, blur: number, alpha: number): string {
  const [x, y] = localOffset(rotDeg, flipX, dx, dy);
  return `drop-shadow(${x.toFixed(2)}px ${y.toFixed(2)}px ${blur}px rgb(58 34 16 / ${alpha}))`;
}

/** Deterministic pseudo-random numbers from a seed (torn edges, stamp coverage). */
export function seeded(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
