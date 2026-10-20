// Line-grid arithmetic: every line of page text sits on a ruled line.
//
// Fonts are normalized at build time (scripts/build-fonts.mjs) to one ascent
// and descent, so a line box's baseline is a pure function of its height and
// font size. Big text takes whole rows and is nudged so its baseline lands on
// the ruled line of its last row.

import { GRID } from './page';

/** Normalized metrics, as fractions of the font size (see assets-src/fonts.json). */
export const ASCENT = 0.8;
export const DESCENT = 0.24;
/** Where the baseline sits inside one ruled row. The rule is drawn just under it. */
export const BASELINE = 20;
/** Text up to this size fits in one row. */
const ONE_ROW_MAX = 26;

export const TEXT_SIZES = [16, 18, 20, 22, 24, 30, 38, 48] as const;

/** Rows a line of text of this size needs. */
export function rowsFor(size: number): number {
  return size <= ONE_ROW_MAX ? 1 : Math.ceil((size * 1.12) / GRID);
}

export interface LineMetrics {
  /** The paragraph's own font size: the strut that sets its baseline. */
  fontSize: number;
  lineHeight: number;
  /** Vertical nudge (page units) that puts the baseline on the ruled line. */
  shift: number;
}

export function paragraphMetrics(maxSize: number): LineMetrics {
  const rows = rowsFor(maxSize);
  const lineHeight = rows * GRID;
  const natural = lineHeight / 2 + ((ASCENT - DESCENT) * maxSize) / 2;
  const shift = (rows - 1) * GRID + BASELINE - natural;
  return { fontSize: maxSize, lineHeight, shift: Math.round(shift * 100) / 100 };
}

/** Inline CSS for a paragraph with these metrics. */
export function metricsStyle(m: LineMetrics): string {
  let css = `font-size:${m.fontSize}px;line-height:${m.lineHeight}px`;
  if (Math.abs(m.shift) > 0.05) css += `;transform:translateY(${m.shift}px)`;
  return css;
}
