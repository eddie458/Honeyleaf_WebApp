// The arithmetic of moving the desk: where its layers go for a zoom, and how a
// flick carries on after the finger lets go, the way a phone's own scrolling does.

export interface Zoom {
  level: number;
  x: number;
  y: number;
  writing?: boolean;
}

/** The stage's transform for a zoom, with (x, y) in the middle of the window. Empty: the whole desk (see .stage). */
export function stageTransform(zoom: Zoom | null, stage: { w: number; h: number }, fitted: number): string {
  if (!zoom) return '';
  const scale = fitted * zoom.level;
  return `translate(${(stage.w / 2 - zoom.x) * scale}px, ${(stage.h / 2 - zoom.y) * scale}px) scale(${scale})`;
}

/** Where a finger was, and when (ms). */
export interface Touch {
  t: number;
  x: number;
  y: number;
}

/** Only the end of a drag says how it was let go. */
const FLICK_MS = 100;
/** A finger still this long before lifting was setting the page down, not flicking it. */
const REST_MS = 60;
/** Slower than this (pixels per ms) isn't a flick. */
const MIN_SPEED = 0.25;
const MAX_SPEED = 4;
/** How quickly a glide dies away: it travels this many ms' worth of its starting speed in all. */
const GLIDE_MS = 325;
/** Slow enough to call it stopped. */
export const STOPPED = 0.02;

/** How fast a finger was going as it lifted (pixels per ms), or null if it wasn't a flick. */
export function flickOf(trail: readonly Touch[], now: number): { x: number; y: number } | null {
  const end = trail.filter((p) => now - p.t <= FLICK_MS);
  const first = end[0];
  const last = end[end.length - 1];
  if (!first || !last || last.t <= first.t || now - last.t > REST_MS) return null;
  const x = (last.x - first.x) / (last.t - first.t);
  const y = (last.y - first.y) / (last.t - first.t);
  const speed = Math.hypot(x, y);
  if (speed < MIN_SPEED) return null;
  const k = Math.min(1, MAX_SPEED / speed);
  return { x: x * k, y: y * k };
}

/** A glide's speed `ms` later. */
export function slowed(v: { x: number; y: number }, ms: number): { x: number; y: number } {
  const k = Math.exp(-ms / GLIDE_MS);
  return { x: v.x * k, y: v.y * k };
}
