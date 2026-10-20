// Small helpers for writing illustrated SVG by code.
// House style: one light from the top-left, warm darks (never pure black),
// soft gradients for volume, darker same-hue outlines, small specular glints.

import { mulberry32 } from '../lib/noise.mjs';

export const rng = (seed) => mulberry32(seed);
export const f = (n) => Math.round(n * 100) / 100;

const hex = (c) => {
  const v = c.replace('#', '');
  const n = v.length === 3 ? v.split('').map((x) => x + x).join('') : v;
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
};
const toHex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

export function mix(a, b, t) {
  const A = hex(a);
  const B = hex(b);
  return toHex(A.map((v, i) => v + (B[i] - v) * t));
}
/** Darken toward a warm brown-black rather than black. */
export const dark = (c, t) => mix(c, '#2a1709', t);
/** Lighten toward a warm white. */
export const light = (c, t) => mix(c, '#fffaf0', t);

export function doc(w, h, defs, body, title = '') {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
    (title ? `<title>${title}</title>` : '') +
    `<defs>${defs}</defs>${body}</svg>\n`
  );
}

const stops = (list) =>
  list
    .map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a !== undefined && a < 1 ? ` stop-opacity="${a}"` : ''}/>`)
    .join('');

/** Linear gradient; default direction runs from the lit top-left to the bottom-right. */
export const lin = (id, list, [x1, y1, x2, y2] = [0.15, 0.1, 0.85, 0.95], units = '') =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${units ? ` gradientUnits="${units}"` : ''}>${stops(list)}</linearGradient>`;

/** Radial gradient with the hot spot pushed toward the light. */
export const rad = (id, list, { cx = 0.5, cy = 0.5, r = 0.5, fx = 0.38, fy = 0.32 } = {}) =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}" fx="${fx}" fy="${fy}">${stops(list)}</radialGradient>`;

export const blur = (id, sd) =>
  `<filter id="${id}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${sd}"/></filter>`;

/** A soft contact shadow (used inside props for parts that sit on other parts). */
export const softShadow = (id = 'ss', sd = 4) => blur(id, sd);

export const circle = (cx, cy, r, attrs = '') => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" ${attrs}/>`;
export const ellipse = (cx, cy, rx, ry, attrs = '') =>
  `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" ${attrs}/>`;
export const rect = (x, y, w, h, rx = 0, attrs = '') =>
  `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}"${rx ? ` rx="${f(rx)}"` : ''} ${attrs}/>`;
export const path = (d, attrs = '') => `<path d="${d}" ${attrs}/>`;
export const g = (attrs, inner) => `<g ${attrs}>${inner}</g>`;

/** Polar helper around a center. */
export const polar = (cx, cy, r, deg) => {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};

/** A closed, slightly wobbly blob through points on a circle (for organic shapes). */
export function blob(cx, cy, r, { points = 10, wobble = 0.12, seed = 1, rot = 0 } = {}) {
  const rand = rng(seed);
  const pts = Array.from({ length: points }, (_, i) => {
    const rr = r * (1 - wobble / 2 + rand() * wobble);
    return polar(cx, cy, rr, rot + (360 / points) * i);
  });
  return smoothClosed(pts);
}

/** Catmull-Rom → cubic Bézier closed path through points. */
export function smoothClosed(pts, tension = 1) {
  const n = pts.length;
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + ((p2[0] - p0[0]) / 6) * tension, p1[1] + ((p2[1] - p0[1]) / 6) * tension];
    const c2 = [p2[0] - ((p3[0] - p1[0]) / 6) * tension, p2[1] - ((p3[1] - p1[1]) / 6) * tension];
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + 'Z';
}

/** Open smooth path through points. */
export function smoothOpen(pts, tension = 1) {
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + ((p2[0] - p0[0]) / 6) * tension, p1[1] + ((p2[1] - p0[1]) / 6) * tension];
    const c2 = [p2[0] - ((p3[0] - p1[0]) / 6) * tension, p2[1] - ((p3[1] - p1[1]) / 6) * tension];
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

/** Torn / zigzag edge points between two corners (for paper and tape ends). */
export function tornEdge(x1, y1, x2, y2, { teeth = 8, depth = 4, seed = 3, zigzag = false } = {}) {
  const rand = rng(seed);
  const pts = [];
  for (let i = 0; i <= teeth; i++) {
    const t = i / teeth;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    const nx = -(y2 - y1);
    const ny = x2 - x1;
    const len = Math.hypot(nx, ny) || 1;
    const off = zigzag ? (i % 2 ? depth : -depth) * 0.5 : (rand() - 0.5) * depth;
    pts.push([x + (nx / len) * off, y + (ny / len) * off]);
  }
  return pts;
}

/** Scatter of tiny speckles (stoneware glaze, cocoa powder, soil). */
export function speckles(cx, cy, r, n, color, { seed = 5, size = [0.6, 1.6], opacity = 0.5, inner = 0 } = {}) {
  const rand = rng(seed);
  let out = '';
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2;
    const rr = inner + Math.sqrt(rand()) * (r - inner);
    const s = size[0] + rand() * (size[1] - size[0]);
    out += circle(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, s, `fill="${color}" opacity="${f(opacity * (0.5 + rand() * 0.5))}"`);
  }
  return out;
}
