// Geometry for decorations: boxes are a center, a size and a rotation, all in
// page units, so moving, turning and resizing never depend on screen size.

export interface Point {
  x: number;
  y: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Degrees, clockwise. */
  rot: number;
}

export type Corner = 'nw' | 'ne' | 'sw' | 'se';

const RAD = Math.PI / 180;

export function rotate(p: Point, deg: number, around: Point = { x: 0, y: 0 }): Point {
  const a = deg * RAD;
  const dx = p.x - around.x;
  const dy = p.y - around.y;
  return { x: around.x + dx * Math.cos(a) - dy * Math.sin(a), y: around.y + dx * Math.sin(a) + dy * Math.cos(a) };
}

/** A page point in the box's own frame (origin at its center, unrotated). */
export function toLocal(box: Box, p: Point): Point {
  return rotate({ x: p.x - box.x, y: p.y - box.y }, -box.rot);
}

export function toPage(box: Box, local: Point): Point {
  const r = rotate(local, box.rot);
  return { x: box.x + r.x, y: box.y + r.y };
}

export function contains(box: Box, p: Point, slop = 0): boolean {
  const l = toLocal(box, p);
  return Math.abs(l.x) <= box.w / 2 + slop && Math.abs(l.y) <= box.h / 2 + slop;
}

export function corners(box: Box): Record<Corner, Point> {
  const hw = box.w / 2;
  const hh = box.h / 2;
  return {
    nw: toPage(box, { x: -hw, y: -hh }),
    ne: toPage(box, { x: hw, y: -hh }),
    sw: toPage(box, { x: -hw, y: hh }),
    se: toPage(box, { x: hw, y: hh }),
  };
}

const OPPOSITE: Record<Corner, Corner> = { nw: 'se', ne: 'sw', sw: 'ne', se: 'nw' };

/** Normalizes any angle to (-180, 180]. */
export function normAngle(deg: number): number {
  let a = deg % 360;
  if (a <= -180) a += 360;
  if (a > 180) a -= 360;
  return a;
}

/** Rotation snaps to straight (0/90/180/270) when it comes close. */
export function snapAngle(deg: number, tolerance = 4): number {
  const a = normAngle(deg);
  for (const straight of [-180, -90, 0, 90, 180]) {
    if (Math.abs(a - straight) <= tolerance) return straight === -180 ? 180 : straight;
  }
  return Math.round(a * 10) / 10;
}

/** Angle (degrees) of the line from `from` to `to`. */
export function angleOf(from: Point, to: Point): number {
  return Math.atan2(to.y - from.y, to.x - from.x) / RAD;
}

/**
 * Resizes by dragging one corner to `p`; the opposite corner stays put.
 * With `keepAspect` (stickers, photos) the box scales uniformly.
 */
export function resizeFromCorner(box: Box, corner: Corner, p: Point, keepAspect: boolean, min = 16): Box {
  const anchor = corners(box)[OPPOSITE[corner]];
  const local = rotate({ x: p.x - anchor.x, y: p.y - anchor.y }, -box.rot);
  const sx = corner === 'ne' || corner === 'se' ? 1 : -1;
  const sy = corner === 'sw' || corner === 'se' ? 1 : -1;
  let w = Math.max(min, local.x * sx);
  let h = Math.max(min, local.y * sy);
  if (keepAspect) {
    const scale = Math.max(w / box.w, h / box.h);
    w = Math.max(min, box.w * scale);
    h = Math.max(min, box.h * scale);
  }
  const center = toPage({ ...box, x: anchor.x, y: anchor.y }, { x: (sx * w) / 2, y: (sy * h) / 2 });
  return { ...box, x: center.x, y: center.y, w, h };
}

/** Two-finger gesture: pinch scales, twist rotates, and the pair drags. */
export function twoFinger(start: { a: Point; b: Point; box: Box }, now: { a: Point; b: Point }, min = 16, max = 2000): Box {
  const d0 = Math.hypot(start.b.x - start.a.x, start.b.y - start.a.y) || 1;
  const d1 = Math.hypot(now.b.x - now.a.x, now.b.y - now.a.y);
  const scale = d1 / d0;
  const turn = angleOf(now.a, now.b) - angleOf(start.a, start.b);
  const m0 = { x: (start.a.x + start.b.x) / 2, y: (start.a.y + start.b.y) / 2 };
  const m1 = { x: (now.a.x + now.b.x) / 2, y: (now.a.y + now.b.y) / 2 };
  // The box center keeps its place relative to the fingers.
  const rel = rotate({ x: (start.box.x - m0.x) * scale, y: (start.box.y - m0.y) * scale }, turn);
  const w = Math.min(max, Math.max(min, start.box.w * scale));
  const h = Math.min(max, Math.max(min, start.box.h * scale));
  return { x: m1.x + rel.x, y: m1.y + rel.y, w, h, rot: snapAngle(start.box.rot + turn) };
}

/** A strip of washi tape laid from one point to another. */
export function tapeBetween(a: Point, b: Point, width: number): Box {
  const length = Math.max(width, Math.hypot(b.x - a.x, b.y - a.y));
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, w: length, h: width, rot: normAngle(angleOf(a, b)) };
}

/** Keeps at least `visible` units of a box on the page. */
export function keepOnPage(box: Box, pageW: number, pageH: number, visible = 24): Box {
  const x = Math.min(pageW - visible + box.w / 2, Math.max(visible - box.w / 2, box.x));
  const y = Math.min(pageH - visible + box.h / 2, Math.max(visible - box.h / 2, box.y));
  return { ...box, x, y };
}
