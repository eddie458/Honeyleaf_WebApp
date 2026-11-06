import { describe, expect, it } from 'vitest';
import { compose, constrain, fold, pose, type Fold, type Matrix, type Pt } from './fold';

const W = 594;
const H = 840;
const CORNER = { x: W, y: H };
const near = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps);
const nearPt = (a: Pt, b: Pt) => {
  near(a.x, b.x);
  near(a.y, b.y);
};
const apply = (m: Matrix, p: Pt): Pt => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] });
/** Across the fold. */
const reflected = (p: Pt, f: Fold): Pt => {
  const d = 2 * ((p.x - f.mid.x) * f.normal.x + (p.y - f.mid.y) * f.normal.y);
  return { x: p.x - d * f.normal.x, y: p.y - d * f.normal.y };
};
const PAGE = [
  { x: 0, y: 0 },
  { x: W, y: 0 },
  { x: W, y: H },
  { x: 0, y: H },
];

describe('page fold', () => {
  it('is flat when the corner has not moved', () => {
    const f = fold(CORNER, CORNER, W, H);
    expect(f.progress).toBe(0);
    const q = pose(f, W, false);
    // The whole page stays, and the back page is cut off past the outer edge.
    for (const c of PAGE) {
      expect(apply(q.flat, c).y).toBeLessThanOrEqual(1e-9);
      expect(apply(q.flat, apply(q.back, c)).y).toBeGreaterThanOrEqual(-1e-9);
    }
  });

  it('maps the corner onto the pointer', () => {
    const f = fold(CORNER, { x: W - 200, y: H - 60 }, W, H);
    nearPt(reflected(CORNER, f), { x: W - 200, y: H - 60 });
  });

  it('places the back page so its spine-side corner meets the pointer', () => {
    const f = fold(CORNER, { x: 100, y: H - 40 }, W, H);
    // Back page point (0, H) is the leaf's outer corner (W, H), which is now at the pointer.
    nearPt(apply(f.backMatrix, { x: 0, y: H }), { x: 100, y: H - 40 });
  });

  it('keeps the leaf attached at the spine', () => {
    const p = constrain(CORNER, { x: -2000, y: H + 500 }, W, H);
    expect(Math.hypot(p.x, p.y - H)).toBeLessThanOrEqual(W + 1e-6);
  });

  it('is fully turned when the corner reaches the far side', () => {
    const f = fold(CORNER, { x: -W, y: H }, W, H);
    near(f.progress, 1, 1e-9);
    // Nothing of the front is left.
    const q = pose(f, W, false);
    for (const c of PAGE) expect(apply(q.flat, c).y).toBeGreaterThanOrEqual(-1e-6);
  });
});

describe('leaf pose', () => {
  const f = fold(CORNER, { x: 150, y: H - 120 }, W, H);

  it('cuts the leaf along the fold', () => {
    const q = pose(f, W, false);
    nearPt(apply(q.flat, f.mid), { x: 0, y: 0 });
    // In the box the corner is past the cut (y > 0), the spine this side of it.
    expect(apply(q.flat, CORNER).y).toBeGreaterThan(0);
    expect(apply(q.flat, { x: 0, y: 0 }).y).toBeLessThan(0);
  });

  it('leaves what is inside the box where it was', () => {
    const q = pose(f, W, false);
    nearPt(apply(compose(q.edge, q.flat), { x: 123, y: 456 }), { x: 123, y: 456 });
  });

  it('folds the back page over onto the kept side of the cut', () => {
    const q = pose(f, W, false);
    // Its corner on the pointer, and the fold where it was.
    expect(apply(q.flat, apply(q.back, { x: 0, y: H })).y).toBeLessThan(0);
    nearPt(apply(q.back, { x: W - f.mid.x, y: f.mid.y }), f.mid);
  });

  it('keeps the sheen on the fold from inside the back page', () => {
    const q = pose(f, W, false);
    nearPt(apply(compose(q.back, q.sheen), { x: 40, y: -70 }), apply(q.edge, { x: 40, y: -70 }));
  });

  it('mirrors all of it for a left page', () => {
    const q = pose(f, W, true);
    const flip = (p: Pt): Pt => ({ x: W - p.x, y: p.y });
    expect(apply(q.flat, flip(CORNER)).y).toBeGreaterThan(0);
    expect(apply(q.flat, flip({ x: 0, y: 0 })).y).toBeLessThan(0);
    nearPt(apply(q.back, flip({ x: 0, y: H })), flip({ x: 150, y: H - 120 }));
    nearPt(apply(compose(q.back, q.sheen), { x: 40, y: -70 }), apply(q.edge, { x: 40, y: -70 }));
  });

  it('never needs more than the reach in PageTurn.module.css', () => {
    let furthest = 0;
    for (const corner of [CORNER, { x: W, y: 0 }]) {
      for (let x = -2000; x <= 2000; x += 40) {
        for (let y = -2000; y <= 2000; y += 40) {
          const { mid } = fold(corner, { x, y }, W, H);
          for (const c of PAGE) furthest = Math.max(furthest, Math.hypot(c.x - mid.x, c.y - mid.y));
        }
      }
    }
    expect(furthest).toBeLessThan(1100);
  });
});
