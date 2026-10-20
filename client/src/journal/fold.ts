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

export interface Fold {
  /** Polygon of the leaf still lying flat (leaf coordinates). */
  front: Pt[];
  /** Polygon of the leaf that has lifted (leaf coordinates); the page beneath shows here. */
  lifted: Pt[];
  /** Polygon of the back face, in the back page's own coordinates. */
  backClip: Pt[];
  /** Where the lifted part now lies (leaf coordinates). */
  flap: Pt[];
  /** CSS matrix() placing the back page (its own coordinates) onto the flap. */
  backMatrix: [number, number, number, number, number, number];
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

/** Clips a convex polygon to the half-plane (X - m)·n <= 0 (or >= 0 when `keepPositive`). */
export function clipHalfPlane(poly: Pt[], m: Pt, n: Pt, keepPositive: boolean): Pt[] {
  const side = (p: Pt) => (keepPositive ? 1 : -1) * dot(sub(p, m), n);
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const sa = side(a);
    const sb = side(b);
    if (sa >= 0) out.push(a);
    if ((sa >= 0) !== (sb >= 0)) {
      const t = sa / (sa - sb);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

export function reflect(p: Pt, m: Pt, n: Pt): Pt {
  const d = 2 * dot(sub(p, m), n);
  return { x: p.x - d * n.x, y: p.y - d * n.y };
}

export function fold(corner: Pt, pointer: Pt, w: number, h: number): Fold {
  const p = constrain(corner, pointer, w, h);
  const page: Pt[] = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
  const cp = sub(corner, p);
  const dist = len(cp);
  if (dist < 0.5) {
    return { front: page, lifted: [], backClip: [], flap: [], backMatrix: [1, 0, 0, 1, 0, 0], mid: corner, normal: { x: 1, y: 0 }, progress: 0 };
  }
  const n = { x: cp.x / dist, y: cp.y / dist };
  const m = { x: (corner.x + p.x) / 2, y: (corner.y + p.y) / 2 };
  const front = clipHalfPlane(page, m, n, false);
  const lifted = clipHalfPlane(page, m, n, true);
  const flap = lifted.map((q) => reflect(q, m, n));
  // Back page coordinates u map to leaf point X = (w - u.x, u.y), then reflect.
  const backClip = lifted.map((q) => ({ x: w - q.x, y: q.y }));
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
  return { front, lifted, backClip, flap, backMatrix: [a, b, c, d, e, f], mid: m, normal: n, progress };
}

export const polygonCss = (pts: Pt[]) => (pts.length < 3 ? 'polygon(0 0, 0 0, 0 0)' : `polygon(${pts.map((q) => `${q.x.toFixed(2)}px ${q.y.toFixed(2)}px`).join(', ')})`);

export const matrixCss = (m: Fold['backMatrix']) => `matrix(${m.map((v) => v.toFixed(5)).join(', ')})`;
