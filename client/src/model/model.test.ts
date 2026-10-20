import { describe, expect, it } from 'vitest';
import { bookSlots, entryForDate, monthTabs, slotOf, spreadCount, spreadOf, type EntrySummary } from './book';
import { History } from './history';
import { isUlid, ulid } from './ids';
import { emptyPage, migrateHeader, migratePage, NewerDocumentError } from './migrations';
import { contains, corners, keepOnPage, resizeFromCorner, snapAngle, tapeBetween, twoFinger, type Box } from './transform';
import { paragraphMetrics, rowsFor } from './lineGrid';

const close = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe('ids', () => {
  it('makes sortable 26-character ULIDs', () => {
    const a = ulid(1_000_000);
    const b = ulid(2_000_000);
    expect(isUlid(a)).toBe(true);
    expect(a < b).toBe(true);
    expect(isUlid('not-an-id')).toBe(false);
  });
});

describe('book layout', () => {
  const e = (id: string, date: string, pages: number, createdAt = '2026-01-01T00:00:00Z'): EntrySummary => ({
    id,
    date,
    title: '',
    createdAt,
    pageIds: Array.from({ length: pages }, (_, k) => `${id}-p${k}`),
  });
  const entries = [e('b', '2026-10-18', 2), e('a', '2026-09-30', 1), e('c', '2026-10-18', 1, '2026-10-18T20:00:00Z')];

  it('lays pages out after the cover lining, in date order, with a blank page at the end', () => {
    const slots = bookSlots(entries);
    expect(slots[0]).toEqual({ kind: 'lining' });
    expect(slots.map((s) => (s.kind === 'page' ? s.pageId : s.kind))).toEqual(['lining', 'a-p0', 'b-p0', 'b-p1', 'c-p0', 'blank']);
    expect(spreadCount(slots)).toBe(3);
    expect(spreadOf(slotOf(slots, 'b', 1))).toBe(1);
  });

  it('puts one month tab at the first page of each month', () => {
    expect(monthTabs(bookSlots(entries))).toEqual([
      { month: '2026-09', slot: 1 },
      { month: '2026-10', slot: 2 },
    ]);
  });

  it('finds the latest entry for a date', () => {
    expect(entryForDate(entries, '2026-10-18')!.id).toBe('c');
    expect(entryForDate(entries, '2026-10-19')).toBeUndefined();
  });
});

describe('line grid', () => {
  it('fits normal text in one row and big text in whole rows on the ruled line', () => {
    expect(rowsFor(22)).toBe(1);
    expect(rowsFor(44)).toBe(2);
    const normal = paragraphMetrics(22);
    expect(normal.lineHeight).toBe(28);
    // A two-row line's baseline lands where a one-row baseline would, one row lower.
    const big = paragraphMetrics(44);
    const baseline = (m: typeof big) => m.lineHeight / 2 + (0.56 * m.fontSize) / 2 + m.shift;
    close(baseline(big), 28 + baseline(normal) + (0.56 * (22 - 22)) / 2, 0.75);
  });
});

describe('transform', () => {
  const box: Box = { x: 100, y: 100, w: 80, h: 40, rot: 30 };

  it('hit-tests rotated boxes', () => {
    expect(contains(box, { x: 100, y: 100 })).toBe(true);
    const c = corners(box);
    expect(contains(box, c.ne, 0.001)).toBe(true);
    expect(contains(box, { x: 100 + 60, y: 100 })).toBe(false);
  });

  it('resizes from a corner while the opposite corner stays put', () => {
    const before = corners(box);
    const out = resizeFromCorner(box, 'se', { x: before.se.x + 20, y: before.se.y + 20 }, false);
    const after = corners(out);
    close(after.nw.x, before.nw.x, 1e-6);
    close(after.nw.y, before.nw.y, 1e-6);
    expect(out.w).toBeGreaterThan(box.w);
  });

  it('keeps the aspect ratio for stickers and photos', () => {
    const out = resizeFromCorner({ ...box, rot: 0 }, 'se', { x: 200, y: 140 }, true);
    close(out.w / out.h, box.w / box.h, 1e-9);
  });

  it('snaps rotation to straight when close', () => {
    expect(snapAngle(3)).toBe(0);
    expect(snapAngle(88)).toBe(90);
    expect(snapAngle(-178)).toBe(180);
    expect(snapAngle(17)).toBe(17);
  });

  it('pinches, twists and drags with two fingers', () => {
    const start = { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, box: { x: 50, y: 0, w: 40, h: 40, rot: 0 } };
    const out = twoFinger(start, { a: { x: 0, y: 0 }, b: { x: 0, y: 200 } });
    close(out.w, 80, 1e-9);
    expect(out.rot).toBe(90);
    close(out.x, 0, 1e-9);
    close(out.y, 100, 1e-9);
  });

  it('lays tape between two points', () => {
    const t = tapeBetween({ x: 0, y: 0 }, { x: 100, y: 100 }, 34);
    close(t.rot, 45, 1e-9);
    close(t.w, Math.SQRT2 * 100, 1e-9);
    expect(t.h).toBe(34);
  });

  it('keeps part of a decoration on the page', () => {
    const out = keepOnPage({ x: -500, y: 2000, w: 100, h: 100, rot: 0 }, 594, 840);
    expect(out.x).toBeGreaterThan(-50);
    expect(out.y).toBeLessThan(840 + 50);
  });
});

describe('history', () => {
  it('undoes and redoes, merging bursts of typing into one step', () => {
    const h = new History<string>();
    h.record('', 'type', 1000);
    h.record('a', 'type', 1200);
    h.record('ab', 'type', 1400);
    expect(h.undo('abc')).toBe('');
    expect(h.redo('')).toBe('abc');
    h.record('abc', 'move', 5000);
    h.record('abc+moved', 'type', 5100);
    expect(h.undo('final')).toBe('abc+moved');
    expect(h.undo('abc+moved')).toBe('abc');
  });

  it('starts a new step after sealing', () => {
    const h = new History<number>();
    h.record(1, 'drag', 0);
    h.seal();
    h.record(2, 'drag', 10);
    expect(h.undo(3)).toBe(2);
    expect(h.undo(2)).toBe(1);
  });
});

describe('migrations', () => {
  it('repairs a malformed page instead of losing it', () => {
    const page = migratePage({ v: 1, paper: { id: 'dotted-cream' }, area: { top: -40, left: 9999 }, decorations: [{ id: 'x', type: 'sticker', x: 'oops' }, { type: 'alien' }] });
    expect(page.paper.id).toBe('dotted-cream');
    expect(page.area.top).toBe(0);
    expect(page.area.left).toBeLessThanOrEqual(594);
    expect(page.decorations).toHaveLength(1);
    expect(page.decorations[0]!.x).toBe(297);
    expect(page.text.type).toBe('doc');
  });

  it('refuses a page saved by a newer app', () => {
    expect(() => migratePage({ v: 99 })).toThrow(NewerDocumentError);
  });

  it('round-trips a fresh page', () => {
    const page = emptyPage('lined-cream');
    expect(migratePage(JSON.parse(JSON.stringify(page)))).toEqual(page);
  });

  it('cleans entry headers', () => {
    const h = migrateHeader({ dateStyle: 'nonsense', tags: ['a', 3, 'b'] }, '2026-10-19');
    expect(h).toEqual({ date: '2026-10-19', dateStyle: 'handwritten', tags: ['a', 'b'] });
  });
});
