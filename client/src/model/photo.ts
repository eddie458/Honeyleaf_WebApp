// Photos in frames: the shape of each frame, where its window sits, and how
// the picture lies behind that window. Nothing is ever cut from a photo: a
// frame is only a window onto the whole picture, which can be slid about
// and zoomed (the crop) at any time.

import type { PhotoFrame } from './types';

/** Which part of the picture shows: the point (0–1 across and down) at the window's middle, and how far in. */
export interface Crop {
  x: number;
  y: number;
  zoom: number;
}

export const DEFAULT_CROP: Crop = { x: 0.5, y: 0.5, zoom: 1 };
export const MAX_PHOTO_ZOOM = 5;
/** Until a picture's own shape is known. */
export const DEFAULT_RATIO = 4 / 3;

/** The frames people can choose, in the order they're offered. */
export const PHOTO_FRAMES = ['instant', 'instant-wide', 'instant-mini', 'print', 'deckled', 'plain'] as const satisfies readonly PhotoFrame[];

/** Instant film: the card, where the picture sits on it, and how wide a new one lands (page units). */
interface Card {
  w: number;
  h: number;
  side: number;
  top: number;
  picW: number;
  picH: number;
  width: number;
}

// Square film is drawn a touch taller than life (the first Honeyleaf print);
// wide and mini follow the real cards in millimetres.
const SQUARE: Card = { w: 262, h: 318, side: 16.24, top: 16.24, picW: 229.52, picH: 229.52, width: 236 };
const CARDS: Partial<Record<PhotoFrame, Card>> = {
  instant: SQUARE,
  'instant-wide': { w: 108, h: 86, side: 4.5, top: 6, picW: 99, picH: 62, width: 320 },
  'instant-mini': { w: 54, h: 86, side: 4, top: 6, picW: 46, picH: 62, width: 176 },
};

/** Prints with an even border all round: its width as a share of the picture's short side. */
const BORDERS: Partial<Record<PhotoFrame, number>> = { print: 0.05, deckled: 0.085, plain: 0 };
/** A new print's long side (page units). */
const PRINT_LONG_SIDE = 280;

/** Frames that aren't drawn yet show as square instant prints. */
const cardOf = (frame: PhotoFrame): Card | null => CARDS[frame] ?? (BORDERS[frame] === undefined ? SQUARE : null);

const clampRatio = (r: number) => (Number.isFinite(r) && r > 0 ? Math.min(10, Math.max(0.1, r)) : DEFAULT_RATIO);
const clampZoom = (z: number) => (Number.isFinite(z) ? Math.min(MAX_PHOTO_ZOOM, Math.max(1, z)) : 1);

/** Instant cards have a wide strip at the bottom for writing on. */
export const hasCaptionStrip = (frame: PhotoFrame) => cardOf(frame) !== null;

/** The whole frame's width ÷ height, holding a picture of shape `ratio`. */
export function frameAspect(frame: PhotoFrame, ratio: number = DEFAULT_RATIO): number {
  const card = cardOf(frame);
  if (card) return card.w / card.h;
  const k = BORDERS[frame] ?? 0;
  const r = clampRatio(ratio);
  return r >= 1 ? (r + 2 * k) / (1 + 2 * k) : (1 + 2 * k) / (1 / r + 2 * k);
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Where the window sits in a frame of w × h: fractions of its width (left, right) and height (top, bottom). */
export function frameInsets(frame: PhotoFrame, w: number, h: number): Insets {
  const card = cardOf(frame);
  if (card) return { left: card.side / card.w, right: (card.w - card.side - card.picW) / card.w, top: card.top / card.h, bottom: (card.h - card.top - card.picH) / card.h };
  const k = BORDERS[frame] ?? 0;
  const border = (k * Math.min(w, h)) / (1 + 2 * k);
  return { left: border / w, right: border / w, top: border / h, bottom: border / h };
}

/** A new photo's size in a frame (page units); `scale` carries over a resize from another frame. */
export function photoSize(frame: PhotoFrame, ratio: number = DEFAULT_RATIO, scale = 1): { w: number; h: number } {
  const aspect = frameAspect(frame, ratio);
  const card = cardOf(frame);
  const base = card ? card.width : aspect >= 1 ? PRINT_LONG_SIDE : PRINT_LONG_SIDE * aspect;
  const w = Math.min(1600, Math.max(48, base * scale));
  return { w: Math.round(w), h: Math.round(w / aspect) };
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Placement {
  /** The picture's size and offset, as fractions of the window's width (w, left) and height (h, top). */
  w: number;
  h: number;
  left: number;
  top: number;
}

/**
 * Where the picture lies behind a window of shape `windowAspect`: it always
 * covers the whole window, zoomed by `crop.zoom`, with `crop`'s point as near
 * the middle as the edges allow.
 */
export function placePicture(windowAspect: number, ratio: number, crop: Crop): Placement {
  const a = Math.max(0.01, windowAspect);
  const r = clampRatio(ratio);
  const zoom = clampZoom(crop.zoom);
  // In window units: the window is `a` wide and 1 tall.
  const iw = (r > a ? r : a) * zoom;
  const ih = (r > a ? 1 : a / r) * zoom;
  const left = Math.min(0, Math.max(a - iw, a / 2 - crop.x * iw));
  const top = Math.min(0, Math.max(1 - ih, 0.5 - crop.y * ih));
  return { w: iw / a, h: ih, left: left / a, top };
}

/** The crop that `placePicture` actually shows (its point pulled back inside the edges). */
export function clampCrop(windowAspect: number, ratio: number, crop: Crop): Crop {
  const p = placePicture(windowAspect, ratio, crop);
  return { x: (0.5 - p.left) / p.w, y: (0.5 - p.top) / p.h, zoom: clampZoom(crop.zoom) };
}

/** Slides the picture by (dx, dy), in units of the window's width and height. */
export function panCrop(windowAspect: number, ratio: number, crop: Crop, dx: number, dy: number): Crop {
  const p = placePicture(windowAspect, ratio, crop);
  return clampCrop(windowAspect, ratio, { ...crop, x: crop.x - dx / p.w, y: crop.y - dy / p.h });
}

/** Zooms, keeping the part of the picture at (u, v) of the window (0–1 across and down) where it is. */
export function zoomCropAt(windowAspect: number, ratio: number, crop: Crop, zoom: number, u = 0.5, v = 0.5): Crop {
  const before = placePicture(windowAspect, ratio, crop);
  const px = (u - before.left) / before.w;
  const py = (v - before.top) / before.h;
  const z = clampZoom(zoom);
  const after = placePicture(windowAspect, ratio, { x: 0.5, y: 0.5, zoom: z });
  return clampCrop(windowAspect, ratio, { x: (0.5 - u) / after.w + px, y: (0.5 - v) / after.h + py, zoom: z });
}

/** The window and the whole picture in a frame of w × h, in the frame's own units (from its top left). */
export function photoLayout(frame: PhotoFrame, w: number, h: number, ratio: number, crop: Crop): { window: Rect; picture: Rect } {
  const i = frameInsets(frame, w, h);
  const win = { x: i.left * w, y: i.top * h, w: w * (1 - i.left - i.right), h: h * (1 - i.top - i.bottom) };
  const p = placePicture(win.w / Math.max(1e-6, win.h), ratio, crop);
  return { window: win, picture: { x: win.x + p.left * win.w, y: win.y + p.top * win.h, w: p.w * win.w, h: p.h * win.h } };
}

/**
 * The outline of an old deckle-cut print of w × h (SVG path data): little
 * bumps all round, about `period` apart, meeting in points `depth` in from
 * the edge.
 */
export function deckleEdge(w: number, h: number, depth = 2.4, period = 8.5): string {
  const run = (x0: number, y0: number, x1: number, y1: number, nx: number, ny: number) => {
    const n = Math.max(3, Math.round(Math.hypot(x1 - x0, y1 - y0) / period));
    let d = '';
    for (let i = 0; i < n; i++) {
      // Each bump's control point sits two depths out, so its crest just meets the edge.
      const cx = x0 + ((x1 - x0) * (i + 0.5)) / n + nx * depth * 2;
      const cy = y0 + ((y1 - y0) * (i + 0.5)) / n + ny * depth * 2;
      d += `Q${cx.toFixed(2)} ${cy.toFixed(2)} ${(x0 + ((x1 - x0) * (i + 1)) / n).toFixed(2)} ${(y0 + ((y1 - y0) * (i + 1)) / n).toFixed(2)}`;
    }
    return d;
  };
  const a = depth;
  return `M${a} ${a}${run(a, a, w - a, a, 0, -1)}${run(w - a, a, w - a, h - a, 1, 0)}${run(w - a, h - a, a, h - a, 0, 1)}${run(a, h - a, a, a, -1, 0)}Z`;
}

/** A crop read from saved data, or null when it isn't one. */
export function cleanCrop(value: unknown): Crop | null {
  if (!value || typeof value !== 'object') return null;
  const c = value as Record<string, unknown>;
  const ok = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
  if (!ok(c.x) || !ok(c.y) || !ok(c.zoom)) return null;
  return { x: Math.min(1, Math.max(0, c.x)), y: Math.min(1, Math.max(0, c.y)), zoom: clampZoom(c.zoom) };
}

/** A picture's shape read from saved data, or null when it isn't one. */
export const cleanRatio = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) && value >= 0.05 && value <= 20 ? value : null);
