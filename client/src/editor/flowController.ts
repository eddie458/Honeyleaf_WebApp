// Connects the page editors to the pure flow engine (model/flow.ts).
//
// After every edit on a page, the entry's pages are reflowed from the page
// before it; the results go to the book store (one undo step together with
// the keystroke), and the caret follows its words onto the next page, turning
// the page if that page isn't open.

import type { Editor } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import { useBook, type EntryState, type PageState } from '../data/bookStore';
import { reflow, type FlowArea, type FlowPage } from '../model/flow';
import { ulid } from '../model/ids';
import { emptyPage } from '../model/migrations';
import { CONT_AREA, PAGE_H, PAGE_W, type WritingArea } from '../model/page';
import type { PageDoc, TextDoc } from '../model/types';
import { bookSlots, slotOf } from '../model/book';
import { parseText, toNode, type TextDefaults } from '../text/StaticText';
import { pageSchema } from './extensions';
import { holdKeystrokes, takeKeystrokes, typingOnPage } from './keystrokes';
import { DomMeasurer } from './measurer';
import { typedTransaction, writeTyped } from './penInput';

/* ------------------------------------------------------------ registry */

const editors = new Map<string, Editor>();
let pendingFocus: { pageId: string; pos: number } | null = null;

export function registerEditor(pageId: string, editor: Editor): void {
  if (editor.isDestroyed) return;
  editors.set(pageId, editor);
  if (pendingFocus?.pageId !== pageId) return;
  queueMicrotask(() => {
    // TipTap may swap a just-made editor for a fresh one (React's double start
    // in development); only the editor still registered takes the caret.
    const pending = pendingFocus;
    if (!pending || pending.pageId !== pageId || editor.isDestroyed || editors.get(pageId) !== editor) return;
    pendingFocus = null;
    // Words typed while the page was on its way go down on it now.
    const typed = takeKeystrokes();
    focusAt(editor, pending.pos);
    if (typed) writeTyped(editor.view, typed);
  });
}

export function unregisterEditor(pageId: string, editor: Editor): void {
  if (editors.get(pageId) === editor) editors.delete(pageId);
}

export const editorFor = (pageId: string) => editors.get(pageId);

function focusAt(editor: Editor, pos: number): void {
  const size = editor.state.doc.content.size;
  const p = Math.max(1, Math.min(pos, size - 1));
  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.near(editor.state.doc.resolve(p))).setMeta('hl-sync', true));
  editor.view.focus();
}

/** Puts the caret on a page, turning to it first when it isn't open. */
export function focusPage(pageId: string, pos: number): void {
  const editor = editors.get(pageId);
  if (editor && !editor.isDestroyed) {
    focusAt(editor, pos);
    return;
  }
  pendingFocus = { pageId, pos };
  if (typingOnPage()) holdKeystrokes((text) => writeIntoPage(pageId, pos, text));
  const { index, entries } = useBook.getState();
  const entry = Object.values(entries).find((e) => e.pages.some((p) => p.id === pageId));
  if (!entry) return;
  const slots = bookSlots(index);
  const pageIndex = entry.pages.findIndex((p) => p.id === pageId);
  useBook.getState().setSlot(slotOf(slots, entry.id, pageIndex));
}

/** Writes caught keystrokes into a page's saved text when no editor could take them. */
function writeIntoPage(pageId: string, pos: number, text: string): void {
  const store = useBook.getState();
  const entry = Object.values(store.entries).find((e) => e.pages.some((p) => p.id === pageId));
  const index = entry ? entry.pages.findIndex((p) => p.id === pageId) : -1;
  const page = entry?.pages[index];
  const doc = page ? parseText(page.doc.text) : null;
  if (!entry || !doc) return;
  const at = Math.max(0, Math.min(pos, doc.content.size));
  const state = EditorState.create({ doc, selection: TextSelection.near(doc.resolve(at)) });
  const json = typedTransaction(state, text).doc.toJSON() as TextDoc;
  store.editPage(entry.id, pageId, (d) => ({ ...d, text: json }), 'type');
  reflowEntry(entry.id, index, 'type');
}

/* ------------------------------------------------------------ measuring */

let measurer: DomMeasurer | null = null;
let measurerKey = '';

function measurerFor(defaults: TextDefaults): DomMeasurer {
  const key = `${defaults.font}|${defaults.size}|${defaults.color}`;
  if (!measurer) measurer = new DomMeasurer(defaults);
  else if (key !== measurerKey) measurer.setDefaults(defaults);
  measurerKey = key;
  return measurer;
}

export const areaSize = (a: WritingArea): FlowArea => ({ width: PAGE_W - a.left - a.right, height: PAGE_H - a.top - a.bottom });

/* --------------------------------------------------------------- flow */

const nodeCache = new WeakMap<TextDoc, PMNode>();
function nodeOf(text: TextDoc): PMNode {
  let n = nodeCache.get(text);
  if (!n) {
    n = toNode(text);
    nodeCache.set(text, n);
  }
  return n;
}

const jsonOf = (n: PMNode) => n.toJSON() as TextDoc;

function journalDefaults(): TextDefaults {
  const j = useBook.getState().journal;
  return { font: j?.defaults.font ?? 'caveat', size: j?.defaults.size ?? 22, color: j?.defaults.inkColor ?? '#3b2a22' };
}

/**
 * Reflows an entry from page `from`, optionally with one page's live editor
 * document (and its caret). Returns the new pages, or null when nothing moved.
 */
function computeFlow(entry: EntryState, from: number, live?: { index: number; doc: PMNode; json: TextDoc; caret: number }) {
  const defaults = journalDefaults();
  const pages: FlowPage[] = entry.pages.map((p, i) => ({
    doc: live && i === live.index ? live.doc : nodeOf(p.doc.text),
    area: areaSize(p.doc.area),
    auto: p.doc.flow === 'auto',
    keep: p.doc.flow !== 'auto' || p.doc.decorations.length > 0,
  }));
  const result = reflow(
    pages,
    Math.max(0, from),
    { measurer: measurerFor(defaults), schema: pageSchema(), newArea: areaSize(CONT_AREA) },
    live ? { page: live.index, pos: live.caret } : undefined,
    live ? live.index : from,
  );
  const paper = entry.pages[entry.pages.length - 1]?.doc.paper.id ?? useBook.getState().journal?.defaults.paper ?? 'lined-cream';
  const next: PageState[] = result.pages.map((fp, i) => {
    const old = entry.pages[i];
    const before = old ? (live && i === live.index ? live.doc : nodeOf(old.doc.text)) : null;
    if (old && before && fp.doc.eq(before)) {
      // Unchanged: keep the very same objects (and the live editor's JSON).
      return live && i === live.index ? { ...old, doc: { ...old.doc, text: live.json } } : old;
    }
    const text = jsonOf(fp.doc);
    nodeCache.set(text, fp.doc);
    if (old) return { ...old, doc: { ...old.doc, text } };
    const doc: PageDoc = { ...emptyPage(paper, CONT_AREA), text, flow: 'auto' };
    return { id: ulid(), doc };
  });
  return { pages: next, caret: result.caret };
}

/** Called by a page editor after a change the person made. */
export function pageEdited(entryId: string, pageId: string, editor: Editor, json: TextDoc = editor.getJSON() as TextDoc): void {
  const store = useBook.getState();
  const entry = store.entries[entryId];
  if (!entry) return;
  const index = entry.pages.findIndex((p) => p.id === pageId);
  if (index < 0) return;
  // The flow works in the one shared page schema. The editor's document
  // belongs to the editor's own schema instance, and nodes from two schemas
  // must never meet in one document, so the page is rebuilt from its JSON
  // (positions are the same in both).
  const doc = parseText(json);
  if (!doc) {
    store.editPage(entryId, pageId, (d) => ({ ...d, text: json }), 'type');
    return;
  }
  nodeCache.set(json, doc);
  const { pages, caret } = computeFlow(entry, index - 1, { index, doc, json, caret: editor.state.selection.head });
  store.editEntry(entryId, () => ({ pages }), 'type');
  if (caret && caret.page !== index) {
    const target = pages[caret.page];
    if (target) focusPage(target.id, caret.pos);
  }
}

/** Reflows after something other than typing (writing area, paper, undo). */
export function reflowEntry(entryId: string, fromIndex = 0, group: string | null = null): void {
  const store = useBook.getState();
  const entry = store.entries[entryId];
  if (!entry) return;
  const { pages } = computeFlow(entry, fromIndex);
  if (pages.length !== entry.pages.length || pages.some((p, i) => p !== entry.pages[i])) {
    store.editEntry(entryId, () => ({ pages }), group);
  }
}
