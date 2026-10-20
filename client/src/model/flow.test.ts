import { describe, expect, it } from 'vitest';
import type { Node as PMNode } from '@tiptap/pm/model';
import { pageSchema } from '../editor/extensions';
import { docText, isEmptyDoc, joinDocs, splitDoc } from './doc';
import { reflow, type FlowMeasurer, type FlowPage } from './flow';
import { GRID } from './page';

const schema = pageSchema();
const p = (text: string, cont = false) => schema.node('paragraph', { cont }, text ? [schema.text(text)] : []);
const doc = (...blocks: PMNode[]) => schema.node('doc', null, blocks.length ? blocks : [p('')]);
const tasks = (items: string[], cont = false) =>
  schema.node(
    'taskList',
    { cont },
    items.map((t) => schema.node('taskItem', { checked: false }, [p(t)])),
  );
const divider = () => schema.node('divider', { style: 'leaves' });
const page = (d: PMNode, rows = 4, extra: Partial<FlowPage> = {}): FlowPage => ({ doc: d, area: { width: 400, height: rows * GRID }, ...extra });

/** Greedy word wrap: text offsets where each line starts. */
function lineStarts(text: string, cols: number): number[] {
  const starts = [0];
  let len = 0;
  let pos = 0;
  for (const word of text.split(/(?<= )/)) {
    const visible = word.trimEnd().length;
    if (len > 0 && len + visible > cols) {
      starts.push(pos);
      len = 0;
    }
    len += word.length;
    pos += word.length;
  }
  return starts;
}

/** A stand-in for the browser: fixed-width characters, one row per line. */
class CharMeasurer implements FlowMeasurer {
  constructor(private cols = 20) {}
  findBreak(d: PMNode, area: { width: number; height: number }): number | null {
    const rows = Math.floor(area.height / GRID);
    if (rows < 1) return isEmptyDoc(d) ? null : 0;
    let used = 0;
    let result: number | null = null;
    d.forEach((block, offset) => {
      if (result !== null) return;
      if (block.type.name === 'paragraph') {
        const starts = lineStarts(block.textContent, this.cols);
        for (let k = 0; k < starts.length; k++) {
          if (used + 1 > rows) {
            result = k === 0 ? offset : offset + 1 + starts[k]!;
            return;
          }
          used++;
        }
      } else if (block.type.name === 'taskList' || block.type.name === 'bulletList') {
        block.forEach((item, itemOffset) => {
          if (result !== null) return;
          const lines = lineStarts(item.textContent, this.cols - 3).length;
          if (used + lines > rows && used > 0) {
            result = itemOffset === 0 ? offset : offset + 1 + itemOffset;
            return;
          }
          used += lines;
        });
      } else {
        if (used + 1 > rows) {
          result = offset;
          return;
        }
        used++;
      }
    });
    return result;
  }
}

const deps = (cols = 20, rows = 4) => ({ measurer: new CharMeasurer(cols), schema, newArea: { width: 400, height: rows * GRID } });

/** The entry's text as one logical document (continuations merged). */
function logical(pages: FlowPage[]): string {
  let all = pages[0]!.doc;
  for (const pg of pages.slice(1)) all = joinDocs(all, pg.doc).doc;
  return docText(all);
}

const LONG = 'The maples have gone full creme brulee, amber on top and burnt sugar at the edges. We sat on the old dock until our toes went numb.';

describe('splitDoc / joinDocs', () => {
  it('splits a paragraph in two and joins it back exactly', () => {
    const d = doc(p('hello world, this is a page'));
    const { head, tail, openDepth } = splitDoc(d, 1 + 6, schema);
    expect(head.textContent).toBe('hello ');
    expect(tail.textContent).toBe('world, this is a page');
    expect(tail.firstChild!.attrs.cont).toBe(true);
    expect(openDepth).toBe(1);
    const joined = joinDocs(head, tail).doc;
    expect(joined.eq(d)).toBe(true);
  });

  it('moves a split at the start of a paragraph to the block boundary', () => {
    const d = doc(p('one'), p('two'));
    const { head, tail, openDepth } = splitDoc(d, 6, schema); // start of "two"
    expect(openDepth).toBe(0);
    expect(head.childCount).toBe(1);
    expect(tail.firstChild!.attrs.cont).toBe(false);
  });

  it('keeps separate paragraphs separate when joining', () => {
    const joined = joinDocs(doc(p('a')), doc(p('b'))).doc;
    expect(joined.childCount).toBe(2);
  });
});

describe('reflow', () => {
  it('leaves a page that fits alone', () => {
    const pages = [page(doc(p('short note')))];
    const out = reflow(pages, 0, deps());
    expect(out.pages).toHaveLength(1);
    expect(out.pages[0]!.doc.eq(pages[0]!.doc)).toBe(true);
  });

  it('moves overflowing lines to the next page, splitting at a line start', () => {
    const out = reflow([page(doc(p(LONG)), 3)], 0, deps(20, 4));
    expect(out.pages.length).toBeGreaterThan(1);
    const second = out.pages[1]!;
    expect(second.auto).toBe(true);
    expect(second.doc.firstChild!.attrs.cont).toBe(true);
    // Page one ends at a line boundary: its last character is the space before a word.
    expect(out.pages[0]!.doc.textContent.endsWith(' ')).toBe(true);
    expect(logical(out.pages)).toBe(LONG);
  });

  it('adds as many pages as the text needs', () => {
    const text = Array.from({ length: 12 }, (_, k) => `Line number ${k} here.`).join(' ');
    const out = reflow([page(doc(p(text)), 2)], 0, deps(20, 2));
    expect(out.pages.length).toBeGreaterThanOrEqual(5);
    for (const pg of out.pages.slice(1)) expect(pg.doc.firstChild!.attrs.cont).toBe(true);
    expect(logical(out.pages)).toBe(text);
  });

  it('pulls text back up when text above is deleted', () => {
    const first = reflow([page(doc(p(LONG)), 3)], 0, deps(20, 4));
    const kept = first.pages[0]!.doc.textContent.slice(0, 10);
    const pages = [{ ...first.pages[0]!, doc: doc(p(kept)) }, ...first.pages.slice(1)];
    const out = reflow(pages, 0, deps(20, 4));
    expect(out.pages[0]!.doc.textContent.length).toBeGreaterThan(kept.length);
    const rest = first.pages.slice(1).map((pg) => pg.doc.textContent).join('');
    expect(logical(out.pages)).toBe(kept + rest);
  });

  it('rejoins the split paragraph and removes the added page when it all fits again', () => {
    const first = reflow([page(doc(p(LONG)), 3)], 0, deps(20, 4));
    expect(first.pages).toHaveLength(2);
    const pages = [
      { ...first.pages[0]!, doc: doc(p('Short now. ')) },
      { ...first.pages[1]!, doc: doc(p('The end.', true)) },
    ];
    const out = reflow(pages, 0, deps(20, 4));
    expect(out.pages).toHaveLength(1);
    expect(out.pages[0]!.doc.childCount).toBe(1);
    expect(out.pages[0]!.doc.firstChild!.attrs.cont).toBe(false);
    expect(out.pages[0]!.doc.textContent).toBe('Short now. The end.');
  });

  it('carries the caret onto the next page when typing overflows', () => {
    const text = 'one two three four five six seven eight nine ten eleven twelve';
    const d = doc(p(text));
    const caretPos = 1 + text.length; // end of the paragraph
    const out = reflow([page(d, 2)], 0, deps(20, 2), { page: 0, pos: caretPos });
    expect(out.caret!.page).toBeGreaterThan(0);
    const target = out.pages[out.caret!.page]!.doc;
    expect(target.textBetween(0, out.caret!.pos)).toMatch(/twelve$/);
  });

  it('keeps the caret where it is when the edit is above the break', () => {
    const out = reflow([page(doc(p(LONG)), 3)], 0, deps(20, 4), { page: 0, pos: 4 });
    expect(out.caret).toEqual({ page: 0, pos: 4 });
  });

  it('skips pages whose writing area is too small and keeps them', () => {
    const pages = [page(doc(p(LONG)), 2), page(doc(p('')), 0, { keep: true }), page(doc(p('')), 6)];
    const out = reflow(pages, 0, deps(20, 4));
    expect(isEmptyDoc(out.pages[1]!.doc)).toBe(true);
    expect(out.pages[2]!.doc.textContent.length).toBeGreaterThan(0);
    expect(logical(out.pages)).toBe(LONG);
  });

  it('splits checklists between items and joins them back into one list', () => {
    const list = tasks(['milk', 'eggs', 'bread', 'honey', 'apples', 'cocoa']);
    const out = reflow([page(doc(p('Shopping:'), list), 3)], 0, deps(20, 3));
    expect(out.pages.length).toBe(3);
    expect(out.pages[1]!.doc.firstChild!.type.name).toBe('taskList');
    expect(out.pages[1]!.doc.firstChild!.attrs.cont).toBe(true);
    let all = out.pages[0]!.doc;
    for (const pg of out.pages.slice(1)) all = joinDocs(all, pg.doc).doc;
    expect(all.childCount).toBe(2);
    expect(all.lastChild!.childCount).toBe(6);
  });

  it('moves a divider whole', () => {
    const out = reflow([page(doc(p('a'), p('b'), divider(), p('c')), 2)], 0, deps(20, 2));
    expect(out.pages[1]!.doc.firstChild!.type.name).toBe('divider');
  });

  it('settles an edited page even when the flow starts on the page before it', () => {
    const first = reflow([page(doc(p(LONG)), 3)], 0, deps(20, 3));
    const n = first.pages.length;
    // Type more on page two; start the flow on page one, as the editor does.
    const grown = doc(p(first.pages[1]!.doc.textContent + ' and then some more words to overflow it', true));
    const pages = first.pages.map((pg, k) => (k === 1 ? { ...pg, doc: grown } : pg));
    const out = reflow(pages, 0, deps(20, 3), undefined, 1);
    expect(out.pages.length).toBeGreaterThan(n - 1);
    expect(logical(out.pages)).toBe(logical(pages));
    for (const pg of out.pages) expect(new CharMeasurer(20).findBreak(pg.doc, pg.area)).toBeNull();
  });

  it('is stable: a second reflow changes nothing', () => {
    const once = reflow([page(doc(p(LONG), p(LONG)), 3)], 0, deps(20, 3));
    const twice = reflow(once.pages, 0, deps(20, 3));
    expect(twice.pages).toHaveLength(once.pages.length);
    twice.pages.forEach((pg, k) => expect(pg.doc.eq(once.pages[k]!.doc)).toBe(true));
  });

  it('never loses or duplicates a character (fuzz)', () => {
    let seed = 7;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const words = ['honey', 'leaf', 'lake', 'dock', 'cocoa', 'scarf', 'maple', 'a', 'tea', 'sunday', 'notebook', 'quiet'];
    for (let round = 0; round < 120; round++) {
      const paras = Array.from({ length: 1 + Math.floor(rand() * 5) }, () =>
        Array.from({ length: 1 + Math.floor(rand() * 30) }, () => words[Math.floor(rand() * words.length)]).join(' '),
      );
      const rows = 1 + Math.floor(rand() * 5);
      let pages = reflow([page(doc(...paras.map((t) => p(t))), rows)], 0, deps(18, rows)).pages;
      const expected = paras.join('\n');
      expect(logical(pages)).toBe(expected);
      // Delete a random stretch of text inside one paragraph of one page and reflow from there.
      const k = Math.floor(rand() * pages.length);
      const target = pages[k]!.doc;
      const block = target.child(Math.floor(rand() * target.childCount));
      if (block.textContent.length > 4) {
        let blockPos = 0;
        target.forEach((child, offset) => {
          if (child === block) blockPos = offset;
        });
        const from = blockPos + 1 + Math.floor(rand() * (block.textContent.length - 2));
        const to = Math.min(from + 1 + Math.floor(rand() * 12), blockPos + 1 + block.textContent.length);
        const removed = target.textBetween(from, to);
        const edited = target.replace(from, to, target.slice(to, to));
        pages = pages.map((pg, idx) => (idx === k ? { ...pg, doc: edited } : pg));
        const before = logical(pages);
        pages = reflow(pages, Math.max(0, k - 1), deps(18, rows)).pages;
        expect(logical(pages)).toBe(before);
        expect(before.length).toBe(expected.length - removed.length);
      }
    }
  });
});
