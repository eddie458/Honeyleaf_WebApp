// Splitting and joining page text. Pure ProseMirror data operations; no DOM.
//
// Each page stores its own share of an entry's text. When a paragraph (or a
// list) is split across two pages, the part on the later page carries
// attrs.cont = true. Joining two pages merges that continuation back into
// the block it came from, so nothing is ever duplicated or lost.

import type { Node as PMNode, Schema } from '@tiptap/pm/model';

/** Blocks that can be split across pages and carry a `cont` flag. */
const CONTINUABLE = new Set(['paragraph', 'bulletList', 'taskList']);

export function emptyDoc(schema: Schema): PMNode {
  return schema.node('doc', null, [schema.node('paragraph')]);
}

/** A page with no text: no blocks, or a single empty paragraph. */
export function isEmptyDoc(doc: PMNode): boolean {
  if (doc.childCount === 0) return true;
  if (doc.childCount !== 1) return false;
  const only = doc.firstChild!;
  return only.type.name === 'paragraph' && only.content.size === 0;
}

function withFirstCont(doc: PMNode, cont: boolean): PMNode {
  const first = doc.firstChild;
  if (!first || !CONTINUABLE.has(first.type.name) || Boolean(first.attrs.cont) === cont) return doc;
  const marked = first.type.create({ ...first.attrs, cont }, first.content, first.marks);
  return doc.copy(doc.content.replaceChild(0, marked));
}

export interface SplitResult {
  head: PMNode;
  tail: PMNode;
  /** The normalized split position in the original document. */
  at: number;
  /** Open block levels at the split: tail position = pos - at + openDepth. */
  openDepth: number;
}

/**
 * Splits a document so the tail starts at `pos`. A split at the very start or
 * end of a block moves to the block boundary instead, so no empty halves are
 * left behind. A split inside a block marks the tail's first block as a
 * continuation.
 */
export function splitDoc(doc: PMNode, pos: number, schema: Schema): SplitResult {
  let $p = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));
  while ($p.depth > 0 && $p.parentOffset === 0) $p = doc.resolve($p.before());
  while ($p.depth > 0 && $p.parentOffset === $p.parent.content.size) $p = doc.resolve($p.after());
  const at = $p.pos;
  const openDepth = $p.depth;
  let head = doc.cut(0, at);
  let tail = doc.cut(at);
  if (openDepth > 0) tail = withFirstCont(tail, true);
  if (head.childCount === 0) head = emptyDoc(schema);
  if (tail.childCount === 0) tail = emptyDoc(schema);
  return { head, tail, at, openDepth };
}

export interface JoinResult {
  doc: PMNode;
  /** Add to a position in `b` to get its position in the joined document. */
  offset: number;
}

/**
 * Joins page `a` and the page after it. If `b` begins with a continuation of
 * `a`'s last block, the two halves become one block again.
 */
export function joinDocs(a: PMNode, b: PMNode): JoinResult {
  if (isEmptyDoc(b)) return { doc: a, offset: a.content.size };
  if (isEmptyDoc(a)) return { doc: b, offset: 0 };
  const last = a.lastChild!;
  const first = b.firstChild!;
  if (first.attrs.cont && first.type === last.type && CONTINUABLE.has(first.type.name)) {
    const merged = last.copy(last.content.append(first.content));
    const rest = b.content.cut(first.nodeSize);
    const doc = a.copy(a.content.replaceChild(a.childCount - 1, merged).append(rest));
    return { doc, offset: a.content.size - 2 };
  }
  const b2 = first.attrs.cont ? withFirstCont(b, false) : b;
  return { doc: a.copy(a.content.append(b2.content)), offset: a.content.size };
}

/** All the text of a document, block by block, for checks and search. */
export function docText(doc: PMNode): string {
  const parts: string[] = [];
  doc.descendants((node) => {
    if (node.isTextblock) {
      parts.push(node.textContent);
      return false;
    }
    return true;
  });
  return parts.join('\n');
}
