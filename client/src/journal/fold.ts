// Page-turn geometry: peeling a page by its corner.
//
// Coordinates are the turning leaf's own frame: x from the spine (0) to the
// outer edge (W), y from top (0) to bottom (H). Dragging the corner C to P
// folds the page along the perpendicular bisector of C–P. The part on C's
// side lifts off; its back (the next page, mirrored) lies over the rest.
// Everything here is pure math so it can be unit-tested.

export interface Pt {
  x: number;
  y: number;
}

/** CSS matrix(a, b, c, d, e, f) = [[a c e], [b d f]]. */
export type Matrix = [number, number, number, number, number, number];

export interface Fold {
  /** CSS matrix() placing the back page (its own coordinates) onto the flap. */
  backMatrix: Matrix;
  /** A point on the fold line and the unit normal pointing toward the corner. */
  mid: Pt;
  normal: Pt;
  /** 0 = flat, 1 = fully turned. */
  progress: number;
}

const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const dot = (a: Pt, b: Pt) => a.x * b.x + a.y * b.y;
const len = (a: Pt) => Math.hypot(a.x, a.y);

/** Keeps the leaf attached at the spine: the corner can't travel further than the page allows. */
export function constrain(corner: Pt, p: Pt, w: number, h: number): Pt {
  const spineSame: Pt = { x: 0, y: corner.y };
  const spineOther: Pt = { x: 0, y: h - corner.y };
  let q = { ...p };
  const d1 = len(sub(q, spineSame));
  if (d1 > w) q = { x: spineSame.x + ((q.x - spineSame.x) * w) / d1, y: spineSame.y + ((q.y - spineSame.y) * w) / d1 };
  const diag = Math.hypot(w, h);
  const d2 = len(sub(q, spineOther));
  if (d2 > diag) q = { x: spineOther.x + ((q.x - spineOther.x) * diag) / d2, y: spineOther.y + ((q.y - spineOther.y) * diag) / d2 };
  return q;
}

export function fold(corner: Pt, pointer: Pt, w: number, h: number): Fold {
  const p = constrain(corner, pointer, w, h);
  const cp = sub(corner, p);
  const dist = len(cp);
  // Flat: the fold lies on the outer edge, with the back page just past it.
  if (dist < 0.5) return { backMatrix: [1, 0, 0, 1, w, 0], mid: corner, normal: { x: 1, y: 0 }, progress: 0 };
  const n = { x: cp.x / dist, y: cp.y / dist };
  const m = { x: (corner.x + p.x) / 2, y: (corner.y + p.y) / 2 };
  // Back page coordinates u map to leaf point X = (w - u.x, u.y), then reflect.
  const l11 = 1 - 2 * n.x * n.x;
  const l12 = -2 * n.x * n.y;
  const l22 = 1 - 2 * n.y * n.y;
  const k = 2 * dot(m, n);
  const tx = k * n.x;
  const ty = k * n.y;
  // T(u) = L·(A·u + (w, 0)) + t, with A = diag(-1, 1).
  const a = -l11;
  const b = -l12;
  const c = l12;
  const d = l22;
  const e = l11 * w + tx;
  const f = l12 * w + ty;
  const progress = Math.min(1, Math.max(0, (corner.x - p.x) / (2 * w)));
  return { backMatrix: [a, b, c, d, e, f], mid: m, normal: n, progress };
}

/** a after b. */
export function compose(a: Matrix, b: Matrix): Matrix {
  return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
}

export function invert(m: Matrix): Matrix {
  const det = m[0] * m[3] - m[1] * m[2];
  const a = m[3] / det;
  const b = -m[1] / det;
  const c = -m[2] / det;
  const d = m[0] / det;
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
}

/** Where each moving part of the leaf goes for a fold (see PageTurn.module.css). */
export interface Pose {
  /** A box laid along the fold, its y axis toward the corner: the leaf is cut off at its y = 0. */
  edge: Matrix;
  /** Undoes `edge`, so what's inside the box stays where it was. */
  flat: Matrix;
  /** The back page, onto the flap. */
  back: Matrix;
  /** Keeps the sheen along the fold from inside the back page. */
  sheen: Matrix;
}

/** `mirrored`: a left page, whose spine is at x = w, turning back to the right. */
export function pose(f: Fold, w: number, mirrored: boolean): Pose {
  const m = mirrored ? { x: w - f.mid.x, y: f.mid.y } : f.mid;
  const n = mirrored ? { x: -f.normal.x, y: f.normal.y } : f.normal;
  const flip: Matrix = [-1, 0, 0, 1, w, 0];
  const back = mirrored ? compose(compose(flip, f.backMatrix), flip) : f.backMatrix;
  const edge: Matrix = [n.y, -n.x, n.x, n.y, m.x, m.y];
  return { edge, flat: invert(edge), back, sheen: compose(invert(back), edge) };
}

export const matrixCss = (m: Matrix) => `matrix(${m.map((v) => v.toFixed(5)).join(', ')})`;
