// The text-flow engine: writing that runs from page to page like a notebook.
//
// Each page holds its own share of an entry's text. After an edit on page i,
// reflow() pulls the next page's text up onto page i, asks the measurer where
// the first line that no longer fits begins, and pushes everything from there
// on to page i+1, adding a page when the last one overflows. It repeats down
// the entry until a page boundary comes out unchanged. Pages whose writing
// area can't hold a line are skipped; empty pages that the flow itself added
// are removed again.
//
// Pure: measuring is delegated to a FlowMeasurer (the browser's layout in the
// app, a simple character model in tests).

import type { Node as PMNode, Schema } from '@tiptap/pm/model';
import { emptyDoc, isEmptyDoc, joinDocs, splitDoc } from './doc';

export interface FlowArea {
  width: number;
  height: number;
}

export interface FlowMeasurer {
  /**
   * Where text must break when `doc` is laid out in `area`:
   * - null: everything fits;
   * - 0: not even one line fits (the area is too small to write in);
   * - otherwise the document position where the overflowing part begins:
   *   the start of a line inside a paragraph, or a block boundary. When even
   *   the first line is too tall for a normal-sized area, the measurer keeps
   *   that first line on the page (overflow is clipped) rather than returning 0.
   */
  findBreak(doc: PMNode, area: FlowArea): number | null;
}

export interface FlowPage {
  doc: PMNode;
  area: FlowArea;
  /** Added by the flow (removed again when it empties). */
  auto?: boolean;
  /** Has decorations or was added by hand: never removed by the flow. */
  keep?: boolean;
}

export interface Caret {
  page: number;
  pos: number;
}

export interface ReflowResult {
  pages: FlowPage[];
  caret?: Caret;
}

export interface FlowDeps {
  measurer: FlowMeasurer;
  schema: Schema;
  /** Writing area for pages the flow adds. */
  newArea: FlowArea;
}

/**
 * Reflows an entry's pages starting at page `start`. `edited` is the page
 * that was just changed (default: `start`); the flow always runs at least
 * past it, since its own boundary with the next page is not yet settled.
 */
export function reflow(pagesIn: FlowPage[], start: number, deps: FlowDeps, caretIn?: Caret, edited = start): ReflowResult {
  const { measurer, schema, newArea } = deps;
  const pages = pagesIn.map((p) => ({ ...p }));
  let caret = caretIn ? { ...caretIn } : undefined;
  let i = Math.max(0, Math.min(start, pages.length - 1));
  let guard = 0;
  const limit = 50 * (pages.length + 20);

  while (i < pages.length && guard++ < limit) {
    const cur = pages[i]!;
    // The next page that holds text; empty pages in between are transparent.
    let j = i + 1;
    while (j < pages.length && isEmptyDoc(pages[j]!.doc)) j++;
    const next = j < pages.length ? pages[j]! : undefined;

    let merged = cur.doc;
    if (next) {
      const joined = joinDocs(cur.doc, next.doc);
      merged = joined.doc;
      if (caret && caret.page === j) caret = { page: i, pos: caret.pos + joined.offset };
    }

    const brk = measurer.findBreak(merged, cur.area);
    if (brk === null) {
      cur.doc = merged;
      if (!next) break;
      next.doc = emptyDoc(schema);
      continue; // keep pulling text up onto page i
    }

    const { head, tail, at, openDepth } = splitDoc(merged, brk, schema);
    cur.doc = head;
    if (caret && caret.page === i && caret.pos > at) caret = { page: i + 1, pos: caret.pos - at + openDepth };

    const target = pages[i + 1];
    if (!target) {
      pages.push({ doc: tail, area: newArea, auto: true });
      i++;
      continue;
    }
    const before = target.doc;
    target.doc = tail;
    if (next && j !== i + 1) next.doc = emptyDoc(schema);
    // The boundary held: later pages are untouched (unless the edit is further on).
    if (next && j === i + 1 && i >= edited && tail.eq(before)) break;
    i++;
  }

  // Pages the flow added and no longer needs.
  while (pages.length > 1) {
    const last = pages[pages.length - 1]!;
    if (!last.auto || last.keep || !isEmptyDoc(last.doc)) break;
    pages.pop();
  }
  if (caret && caret.page >= pages.length) {
    const lastIndex = pages.length - 1;
    caret = { page: lastIndex, pos: Math.max(0, pages[lastIndex]!.doc.content.size - 1) };
  }
  if (caret) {
    const size = pages[caret.page]!.doc.content.size;
    caret.pos = Math.max(0, Math.min(caret.pos, size));
  }
  return caret ? { pages, caret } : { pages };
}
