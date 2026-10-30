// Pencil drawings: how wide a stroke is drawn, and the eraser, which rubs out
// the parts of strokes it passes over and splits a line where it is cut, like
// a rubber on paper. Pure geometry on the save format, in page units.

import { toLocal, type Point } from './transform';
import type { Decoration, Stroke, StrokePoint } from './types';

export type Drawing = Extract<Decoration, { type: 'drawing' }>;

/** Across the eraser's round tip, page units (8 mm). */
export const ERASER_SIZE = 32;

/** Bits of a cut line shorter than this are crumbs: they are brushed away too. */
const CRUMB = 2;

/** How wide a stroke is drawn at full pressure. */
export function strokeWidth(st: Stroke): number {
  return st.size * (st.tool === 'brush' ? 2.2 : 1.6);
}

/** Points along the eraser's path from `a` to `b` (not `a` itself), `step` apart at most, so it leaves no gaps. */
export function sweep(a: Point, b: Point, step: number): Point[] {
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
  return Array.from({ length: n }, (_, i) => ({ x: a.x + ((b.x - a.x) * (i + 1)) / n, y: a.y + ((b.y - a.y) * (i + 1)) / n }));
}

/**
 * Rubs the eraser over a page's drawings, its tip centered on each page point
 * of `at` in turn. Returns the same array when nothing was touched; a drawing
 * with no lines left is gone. Locked drawings, and everything that is not a
 * drawing, stay as they are.
 */
export function erase(decorations: Decoration[], at: Point[], radius = ERASER_SIZE / 2): Decoration[] {
  let changed = false;
  const out = decorations.flatMap((d) => {
    if (d.type !== 'drawing' || d.locked) return [d];
    const left = eraseDrawing(d, at, radius);
    if (left === d) return [d];
    changed = true;
    return left ? [left] : [];
  });
  return changed ? out : decorations;
}

/** One drawing after the eraser: itself when untouched, null when nothing is left. */
export function eraseDrawing(d: Drawing, at: Point[], radius: number): Drawing | null {
  // Strokes are kept in the drawing's own frame: from its top-left corner, before it was turned or flipped.
  const tips = at
    .map((p) => {
      const l = toLocal(d, p);
      return { x: (d.flipX ? -l.x : l.x) + d.w / 2, y: l.y + d.h / 2 };
    })
    .filter((c) => c.x > -radius && c.y > -radius && c.x < d.w + radius && c.y < d.h + radius);
  let strokes = d.strokes;
  for (const c of tips) {
    let cut = false;
    const next = strokes.flatMap((st) => {
      const pieces = rubOut(st.points, c, radius + strokeWidth(st) / 2);
      if (!pieces) return [st];
      cut = true;
      return pieces.map((points) => ({ ...st, points }));
    });
    if (cut) strokes = next;
  }
  if (strokes === d.strokes) return d;
  return strokes.length ? { ...d, strokes } : null;
}

/** The pieces of a line left outside the circle (`c`, `r`), or null when the eraser misses it. */
function rubOut(points: StrokePoint[], c: Point, r: number): StrokePoint[][] | null {
  const r2 = r * r;
  const first = points[0];
  if (!first) return null;
  const inside = (p: Point) => (p.x - c.x) ** 2 + (p.y - c.y) ** 2 < r2;
  if (points.length === 1) return inside(first) ? [] : null;
  const pieces: StrokePoint[][] = [];
  let piece: StrokePoint[] = inside(first) ? [] : [first];
  let hit = piece.length === 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const span = within(a, b, c, r2);
    if (!span) {
      if (!piece.length) piece.push(a);
      piece.push(b);
      continue;
    }
    hit = true;
    const [t0, t1] = span;
    if (t0 > 0) piece.push(between(a, b, t0));
    if (piece.length > 1) pieces.push(piece);
    piece = t1 < 1 ? [between(a, b, t1), b] : [];
  }
  if (piece.length > 1) pieces.push(piece);
  return hit ? pieces.filter((p) => lengthOf(p) >= CRUMB) : null;
}

/** Where the segment a→b runs inside the circle, as [from, to] along it (0..1), or null. */
function within(a: Point, b: Point, c: Point, r2: number): [number, number] | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const fx = a.x - c.x;
  const fy = a.y - c.y;
  const A = dx * dx + dy * dy;
  const C = fx * fx + fy * fy - r2;
  if (A < 1e-9) return C < 0 ? [0, 1] : null;
  const B = 2 * (fx * dx + fy * dy);
  const disc = B * B - 4 * A * C;
  if (disc <= 0) return null;
  const root = Math.sqrt(disc);
  const t0 = Math.max(0, (-B - root) / (2 * A));
  const t1 = Math.min(1, (-B + root) / (2 * A));
  return t0 < t1 ? [t0, t1] : null;
}

const round = (n: number, k: number) => Math.round(n * k) / k;

/** A new end where a line was cut, rounded like every saved point. */
function between(a: StrokePoint, b: StrokePoint, t: number): StrokePoint {
  return { x: round(a.x + (b.x - a.x) * t, 10), y: round(a.y + (b.y - a.y) * t, 10), p: round(a.p + (b.p - a.p) * t, 100) };
}

function lengthOf(points: StrokePoint[]): number {
  let n = 0;
  for (let i = 1; i < points.length; i++) n += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
  return n;
}
