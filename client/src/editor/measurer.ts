// Measures where page text must break, using the browser's own layout in a
// hidden, unscaled ProseMirror view that renders exactly like the editor.

import { EditorState } from '@tiptap/pm/state';
import { EditorView } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import { GRID } from '../model/page';
import type { FlowArea, FlowMeasurer } from '../model/flow';
import { isEmptyDoc } from '../model/doc';
import { lineGridDecorations, pageSchema } from './extensions';
import { textVars, type TextDefaults } from '../text/StaticText';

const LIST_TYPES = new Set(['taskList', 'bulletList']);

export class DomMeasurer implements FlowMeasurer {
  private host: HTMLDivElement;
  private view: EditorView;
  private defaults: TextDefaults;

  constructor(defaults: TextDefaults) {
    this.defaults = defaults;
    this.host = document.createElement('div');
    this.host.setAttribute('aria-hidden', 'true');
    Object.assign(this.host.style, {
      position: 'fixed',
      left: '-30000px',
      top: '0',
      visibility: 'hidden',
      pointerEvents: 'none',
      contain: 'layout style',
    });
    document.body.appendChild(this.host);
    const schema = pageSchema();
    this.view = new EditorView(this.host, {
      state: EditorState.create({ schema, doc: schema.node('doc', null, [schema.node('paragraph')]) }),
      editable: () => false,
      attributes: { class: 'hl-flow hl-grid' },
      decorations: (state) => lineGridDecorations(state.doc, this.defaults.size),
    });
    this.applyDefaults();
  }

  setDefaults(defaults: TextDefaults): void {
    this.defaults = defaults;
    this.applyDefaults();
  }

  private applyDefaults(): void {
    const vars = textVars(this.defaults) as Record<string, string>;
    for (const [k, v] of Object.entries(vars)) this.view.dom.style.setProperty(k, v);
  }

  destroy(): void {
    this.view.destroy();
    this.host.remove();
  }

  findBreak(doc: PMNode, area: FlowArea): number | null {
    if (isEmptyDoc(doc)) return null;
    if (area.height < GRID - 0.5 || area.width < 24) return 0;
    this.host.style.width = `${area.width}px`;
    this.view.updateState(EditorState.create({ schema: doc.type.schema, doc }));
    const root = this.view.dom as HTMLElement;
    const limit = area.height + 0.5;
    if (root.scrollHeight <= limit) return null;

    let pos = 0;
    for (let i = 0; i < doc.childCount; i++) {
      const node = doc.child(i);
      const dom = this.view.nodeDOM(pos) as HTMLElement | null;
      if (dom && dom.offsetTop + dom.offsetHeight > limit) {
        return this.breakInside(node, pos, dom, limit, i === 0);
      }
      pos += node.nodeSize;
    }
    return null;
  }

  /** The break inside the first block that crosses the bottom of the area. */
  private breakInside(node: PMNode, pos: number, dom: HTMLElement, limit: number, firstBlock: boolean): number | null {
    if (node.isTextblock) return this.breakInParagraph(node, pos, dom, limit, firstBlock);
    if (LIST_TYPES.has(node.type.name)) {
      let itemPos = pos + 1;
      for (let k = 0; k < node.childCount; k++) {
        const item = node.child(k);
        const li = this.view.nodeDOM(itemPos) as HTMLElement | null;
        const bottom = li ? this.offsetWithin(li) + li.offsetHeight : 0;
        if (bottom > limit) {
          if (k === 0) return firstBlock ? itemPos + item.nodeSize : pos;
          return itemPos;
        }
        itemPos += item.nodeSize;
      }
      return firstBlock ? null : pos;
    }
    return firstBlock ? pos + node.nodeSize : pos;
  }

  /** Lines are exactly lineHeight tall, so a character's line comes from its top. */
  private breakInParagraph(node: PMNode, pos: number, dom: HTMLElement, limit: number, firstBlock: boolean): number {
    const lineHeight = parseFloat(dom.style.lineHeight) || GRID;
    const paraTop = dom.offsetTop;
    const boxTop = dom.getBoundingClientRect().top;
    const start = pos + 1;
    const end = pos + 1 + node.content.size;
    const lineOf = (p: number) => {
      const c = this.view.coordsAtPos(p, 1);
      return Math.floor((c.top - boxTop + 0.5) / lineHeight);
    };
    const fits = (line: number) => paraTop + (line + 1) * lineHeight <= limit;
    // First position whose line no longer fits (binary search; lines only grow).
    let lo = start;
    let hi = end;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (fits(lineOf(mid))) lo = mid + 1;
      else hi = mid;
    }
    if (lo >= end) return pos + node.nodeSize; // only the closing edge overflows
    // Walk back to the first character of that line.
    const line = lineOf(lo);
    let first = lo;
    while (first > start && lineOf(first - 1) === line) first--;
    if (first <= start) {
      if (!firstBlock) return pos;
      // Not even the first line fits a normal page: keep that line here.
      let next = start;
      while (next < end && lineOf(next) === line) next++;
      return next >= end ? pos + node.nodeSize : next;
    }
    return first;
  }

  private offsetWithin(el: HTMLElement): number {
    let top = 0;
    let cur: HTMLElement | null = el;
    const root = this.view.dom as HTMLElement;
    while (cur && cur !== root) {
      top += cur.offsetTop;
      cur = cur.offsetParent as HTMLElement | null;
      if (cur && !root.contains(cur)) break;
    }
    return top;
  }
}
