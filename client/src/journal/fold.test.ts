import { describe, expect, it } from 'vitest';
import { constrain, fold, reflect } from './fold';

const W = 594;
const H = 840;
const near = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe('page fold', () => {
  it('is flat when the corner has not moved', () => {
    const f = fold({ x: W, y: H }, { x: W, y: H }, W, H);
    expect(f.lifted).toHaveLength(0);
    expect(f.progress).toBe(0);
  });

  it('lifts the corner region and maps the corner onto the pointer', () => {
    const f = fold({ x: W, y: H }, { x: W - 200, y: H - 60 }, W, H);
    expect(f.lifted.length).toBeGreaterThanOrEqual(3);
    // Reflecting the corner across the fold lands it on the pointer.
    const c = reflect({ x: W, y: H }, f.mid, f.normal);
    near(c.x, W - 200, 1e-6);
    near(c.y, H - 60, 1e-6);
  });

  it('places the back page so its spine-side corner meets the pointer', () => {
    const f = fold({ x: W, y: H }, { x: 100, y: H - 40 }, W, H);
    const [a, b, c, d, e, g] = f.backMatrix;
    // Back page point (0, H) is the leaf's outer corner (W, H), which is now at the pointer.
    const x = a * 0 + c * H + e;
    const y = b * 0 + d * H + g;
    near(x, 100, 1e-6);
    near(y, H - 40, 1e-6);
  });

  it('keeps the leaf attached at the spine', () => {
    const p = constrain({ x: W, y: H }, { x: -2000, y: H + 500 }, W, H);
    expect(Math.hypot(p.x, p.y - H)).toBeLessThanOrEqual(W + 1e-6);
  });

  it('is fully turned when the corner reaches the far side', () => {
    const f = fold({ x: W, y: H }, { x: -W, y: H }, W, H);
    near(f.progress, 1, 1e-9);
    expect(f.front.length === 0 || f.front.every((q) => Math.abs(q.x) < 1e-6)).toBe(true);
  });
});
