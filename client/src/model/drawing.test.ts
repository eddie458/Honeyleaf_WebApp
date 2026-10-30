import { describe, expect, it } from 'vitest';
import { erase, eraseDrawing, sweep, type Drawing } from './drawing';
import type { Decoration, Stroke, StrokePoint } from './types';

const close = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps);

/** A straight line across the drawing's own frame, a point every 10 units. */
const line = (from: number, to: number, y = 50): StrokePoint[] => {
  const points: StrokePoint[] = [];
  for (let x = from; x <= to; x += 10) points.push({ x, y, p: 0.5 });
  return points;
};
const pen = (points: StrokePoint[]): Stroke => ({ tool: 'pen', color: '#3b2a22', size: 3.2, points });
/** 200 × 100, its top-left corner at page (50, 50): page = own frame + 50. */
const drawing = (strokes: Stroke[], more: Partial<Drawing> = {}): Drawing => ({ id: 'd1', type: 'drawing', x: 150, y: 100, w: 200, h: 100, rot: 0, z: 1, layer: 'front', strokes, ...more });
// The eraser reaches 16 units, plus half the pencil line (3.2 × 1.6 / 2).
const REACH = 16 + 2.56;

describe('the eraser', () => {
  it('cuts a line in two where it rubs, like a real eraser', () => {
    const d = eraseDrawing(drawing([pen(line(0, 200))]), [{ x: 150, y: 100 }], 16);
    expect(d?.strokes).toHaveLength(2);
    const [left, right] = d!.strokes;
    // Every point outside the eraser stays, and the new ends sit at its edge.
    expect(left!.points.map((p) => p.x)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, Math.round((100 - REACH) * 10) / 10]);
    expect(right!.points[0]!.x).toBe(Math.round((100 + REACH) * 10) / 10);
    expect(right!.points.at(-1)).toEqual({ x: 200, y: 50, p: 0.5 });
    expect(left!.color).toBe('#3b2a22');
  });

  it('leaves everything it misses exactly as it was', () => {
    const kept = pen(line(0, 40));
    const d = drawing([kept, pen(line(100, 200))]);
    const page: Decoration[] = [d];
    expect(erase(page, [{ x: 500, y: 500 }])).toBe(page);
    expect(eraseDrawing(d, [{ x: 150, y: 20 }], 16)).toBe(d);
    // Rubbing out one line keeps the other one as the very same stroke.
    const after = eraseDrawing(d, [{ x: 200, y: 100 }], 16);
    expect(after?.strokes[0]).toBe(kept);
  });

  it('takes a doodle away once nothing is left, but never locked ones or other things', () => {
    const sticker: Decoration = { id: 's1', type: 'sticker', asset: 'cozy/heart', x: 150, y: 100, w: 80, h: 80, rot: 0, z: 2, layer: 'front' };
    const locked = drawing([pen(line(90, 110))], { id: 'd2', locked: true });
    const page = erase([drawing([pen(line(90, 110))]), sticker, locked], [{ x: 150, y: 100 }]);
    expect(page.map((d) => d.id)).toEqual(['s1', 'd2']);
    expect(page[1]).toBe(locked);
  });

  it('brushes away crumbs too small to see', () => {
    // A rub just inside the start leaves a sliver of 1.4 units: it goes too.
    const d = eraseDrawing(drawing([pen(line(0, 200))]), [{ x: 70, y: 100 }], 16);
    expect(d?.strokes).toHaveLength(1);
    close(d!.strokes[0]!.points[0]!.x, Math.round((20 + REACH) * 10) / 10);
  });

  it('follows a doodle that was turned or flipped', () => {
    // Turned a quarter: the line runs down the page at x = 150.
    const turned = drawing([pen(line(0, 200))], { rot: 90 });
    expect(eraseDrawing(turned, [{ x: 190, y: 100 }], 16)).toBe(turned);
    const cut = eraseDrawing(turned, [{ x: 150, y: 40 }], 16);
    expect(cut?.strokes).toHaveLength(2);
    close(cut!.strokes[0]!.points.at(-1)!.x, Math.round((40 - REACH) * 10) / 10);
    // Flipped: the start of the line lies on the right-hand side of the page.
    const flipped = drawing([pen(line(0, 60))], { flipX: true });
    expect(eraseDrawing(flipped, [{ x: 70, y: 100 }], 16)).toBe(flipped);
    expect(eraseDrawing(flipped, [{ x: 230, y: 100 }], 16)).not.toBe(flipped);
  });

  it('fills in a fast rub so it leaves no gaps', () => {
    const steps = sweep({ x: 0, y: 0 }, { x: 10, y: 0 }, 4);
    expect(steps).toHaveLength(3);
    expect(steps.at(-1)).toEqual({ x: 10, y: 0 });
    close(steps[0]!.x, 10 / 3);
    expect(sweep({ x: 5, y: 5 }, { x: 5, y: 5 }, 4)).toEqual([{ x: 5, y: 5 }]);
    // A quick swipe through a line still cuts it.
    const d = eraseDrawing(drawing([pen(line(0, 200))]), sweep({ x: 150, y: 50 }, { x: 150, y: 150 }, 8), 16);
    expect(d?.strokes).toHaveLength(2);
  });
});
