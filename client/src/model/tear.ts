// Tearing a page out of an entry, as from a real notebook: whatever is on it
// goes too. Pure; the book store and the wastebasket are journal/tearOut.ts.

import { DEFAULT_AREA } from './page';
import type { BlockNode, EntryHeader, PageDoc } from './types';

interface Page {
  id: string;
  doc: PageDoc;
}

/** Something on the page worth keeping: words, or anything stuck or drawn on it. */
export function hasContent(doc: PageDoc): boolean {
  return doc.decorations.length > 0 || hasWords(doc.text);
}

function hasWords(node: { text?: unknown; content?: unknown }): boolean {
  if (typeof node.text === 'string' && node.text.trim() !== '') return true;
  return Array.isArray(node.content) && node.content.some((child: { text?: unknown; content?: unknown }) => hasWords(child));
}

/**
 * An entry's pages once `pageId` is torn out, or null when it isn't one of
 * them. An entry always keeps a page to write on: tearing out the last one
 * leaves `fresh()`. When the first page goes, the next takes its place, with
 * room for the date and title. The words after a tear start a paragraph of
 * their own, since the words they carried on from went with the page.
 */
export function withoutPage<P extends Page>(pages: P[], pageId: string, fresh: () => P): P[] | null {
  const at = pages.findIndex((p) => p.id === pageId);
  if (at < 0) return null;
  const rest = pages.filter((p) => p.id !== pageId);
  if (rest.length === 0) return [fresh()];
  const next = rest[at];
  if (next) rest[at] = at === 0 ? asFirstPage(startAfresh(next)) : startAfresh(next);
  return rest;
}

/** An entry starting over on a fresh page loses the title written atop the old one; its date stays. */
export function withoutTitle(header: EntryHeader): EntryHeader {
  if (header.title === undefined && header.titleLettering === undefined) return header;
  const rest = { ...header };
  delete rest.title;
  delete rest.titleLettering;
  return rest;
}

function startAfresh<P extends Page>(page: P): P {
  const [first, ...more] = page.doc.text.content;
  const attrs = first && 'attrs' in first ? (first.attrs as { cont?: boolean } | undefined) : undefined;
  if (!first || !attrs?.cont) return page;
  const lead = { ...first, attrs: { ...attrs, cont: false } } as BlockNode;
  return { ...page, doc: { ...page.doc, text: { ...page.doc.text, content: [lead, ...more] } } };
}

/** An entry's first page is its own (the flow never takes it away) and leaves room for the header. */
function asFirstPage<P extends Page>(page: P): P {
  const doc: PageDoc = { ...page.doc, area: { ...page.doc.area, top: Math.max(page.doc.area.top, DEFAULT_AREA.top) } };
  delete doc.flow;
  return { ...page, doc };
}
