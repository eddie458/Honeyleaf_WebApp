// The page-text schema: TipTap's free (MIT) extensions plus Honeyleaf's own
// marks and nodes. The same extensions drive the live editor, the hidden
// measuring view used by the text-flow engine, and the static page renderer,
// so a page looks identical whether or not it is being edited.

import { Extension, Mark, Node, getSchema, mergeAttributes, type AnyExtension } from '@tiptap/core';
import { Document } from '@tiptap/extension-document';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Text } from '@tiptap/extension-text';
import { Bold } from '@tiptap/extension-bold';
import { Italic } from '@tiptap/extension-italic';
import { Underline } from '@tiptap/extension-underline';
import { Strike } from '@tiptap/extension-strike';
import { HardBreak } from '@tiptap/extension-hard-break';
import { BulletList, ListItem, TaskItem, TaskList } from '@tiptap/extension-list';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { fontFamily } from '../library/fonts';
import { metricsStyle, paragraphMetrics } from '../model/lineGrid';
import { highlighterStroke, loopAround, scribbleOut, wavyUnderline } from '../text/inkEffects';

/* ---------------------------------------------------------------- marks */

const markSpan = (attrs: Record<string, string>) => ['span', { class: 'hl-m', ...attrs }, 0] as const;

export const FontMark = Mark.create({
  name: 'font',
  addAttributes() {
    return { id: { default: 'caveat', parseHTML: (el) => el.getAttribute('data-font'), renderHTML: () => ({}) } };
  },
  parseHTML() {
    return [{ tag: 'span[data-font]' }];
  },
  renderHTML({ mark }) {
    const id = String(mark.attrs.id);
    return markSpan({ 'data-font': id, style: `font-family:${fontFamily(id)},cursive` });
  },
});

export const SizeMark = Mark.create({
  name: 'size',
  addAttributes() {
    return { px: { default: 22, parseHTML: (el) => Number(el.getAttribute('data-size')) || 22, renderHTML: () => ({}) } };
  },
  parseHTML() {
    return [{ tag: 'span[data-size]' }];
  },
  renderHTML({ mark }) {
    const px = Number(mark.attrs.px);
    return markSpan({ 'data-size': String(px), style: `font-size:${px}px` });
  },
});

export const InkMark = Mark.create({
  name: 'ink',
  addAttributes() {
    return {
      id: { default: 'brown-black', parseHTML: (el) => el.getAttribute('data-ink'), renderHTML: () => ({}) },
      color: { default: '#3b2a22', parseHTML: (el) => el.style.color || '#3b2a22', renderHTML: () => ({}) },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-ink]' }];
  },
  renderHTML({ mark }) {
    return markSpan({ 'data-ink': String(mark.attrs.id), style: `color:${safeColor(mark.attrs.color)}` });
  },
});

export const HighlightMark = Mark.create({
  name: 'highlight',
  addAttributes() {
    return { color: { default: '#ffe94a', parseHTML: (el) => el.getAttribute('data-hl'), renderHTML: () => ({}) } };
  },
  parseHTML() {
    return [{ tag: 'span[data-hl]' }];
  },
  renderHTML({ mark }) {
    const color = safeColor(mark.attrs.color);
    return ['span', { class: 'hl-hl', 'data-hl': color, style: `background-image:${highlighterStroke(color)}` }, 0];
  },
});

const EFFECT_IMAGES: Record<string, (c: string) => string> = {
  wavy: wavyUnderline,
  scribble: scribbleOut,
  loop: loopAround,
};

export const EffectMark = Mark.create({
  name: 'effect',
  addAttributes() {
    return {
      kind: { default: 'wavy', parseHTML: (el) => el.getAttribute('data-fx'), renderHTML: () => ({}) },
      color: { default: '#3b2a22', parseHTML: (el) => el.getAttribute('data-fx-color'), renderHTML: () => ({}) },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-fx]' }];
  },
  renderHTML({ mark }) {
    const kind = String(mark.attrs.kind);
    const color = safeColor(mark.attrs.color);
    const image = EFFECT_IMAGES[kind];
    return [
      'span',
      { class: `hl-fx hl-fx-${kind}`, 'data-fx': kind, 'data-fx-color': color, ...(image ? { style: `background-image:${image(color)}` } : {}) },
      0,
    ];
  },
});

/** Only plain hex colors ever reach a style attribute. */
export function safeColor(value: unknown): string {
  const s = String(value ?? '');
  return /^#[0-9a-fA-F]{3,8}$/.test(s) ? s : '#3b2a22';
}

/* ---------------------------------------------------------------- nodes */

const contAttr = {
  cont: {
    default: false,
    // "Continues from the page before" belongs to one block only: a new
    // paragraph made with Enter starts fresh.
    keepOnSplit: false,
    parseHTML: (el: HTMLElement) => el.hasAttribute('data-cont'),
    renderHTML: (a: Record<string, unknown>) => (a.cont ? { 'data-cont': '' } : {}),
  },
};

export const PageParagraph = Paragraph.extend({
  addAttributes() {
    return {
      ...contAttr,
      align: {
        default: null,
        parseHTML: (el: HTMLElement) => el.style.textAlign || null,
        renderHTML: (a: Record<string, unknown>) => (a.align ? { style: `text-align:${String(a.align)}` } : {}),
      },
    };
  },
  renderHTML({ HTMLAttributes }) {
    return ['p', mergeAttributes({ class: 'hl-p' }, HTMLAttributes), 0];
  },
});

export const PageBulletList = BulletList.extend({
  addAttributes() {
    return {
      ...contAttr,
      bullet: {
        default: 'dot',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-bullet') ?? 'dot',
        renderHTML: (a: Record<string, unknown>) => ({ 'data-bullet': String(a.bullet) }),
      },
    };
  },
});

export const PageListItem = ListItem.extend({ content: 'paragraph+' });

export const PageTaskList = TaskList.extend({
  addAttributes() {
    return { ...contAttr };
  },
});

export const PageTaskItem = TaskItem.configure({ nested: false });

/** A doodled divider that takes exactly one ruled row. */
export const Divider = Node.create({
  name: 'divider',
  group: 'block',
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      style: {
        default: 'leaves',
        parseHTML: (el) => el.getAttribute('data-divider') ?? 'leaves',
        renderHTML: (a) => ({ 'data-divider': String(a.style) }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-divider]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ class: 'hl-divider', contenteditable: 'false' }, HTMLAttributes)];
  },
});

/* ------------------------------------------------------------ line grid */

/** The largest font size used in a paragraph (its strut). */
export function strutSize(node: PMNode, defaultSize: number): number {
  let max = 0;
  node.forEach((child) => {
    if (!child.isText) return;
    const m = child.marks.find((mk) => mk.type.name === 'size');
    max = Math.max(max, m ? Number(m.attrs.px) : defaultSize);
  });
  return max || defaultSize;
}

export function lineGridDecorations(doc: PMNode, defaultSize: number): DecorationSet {
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== 'paragraph') return true;
    const style = metricsStyle(paragraphMetrics(strutSize(node, defaultSize)));
    decos.push(Decoration.node(pos, pos + node.nodeSize, { style }));
    return false;
  });
  return DecorationSet.create(doc, decos);
}

/** Gives every paragraph the line height and nudge that keep it on the ruled grid. */
export const LineGrid = Extension.create<{ defaultSize: number }>({
  name: 'lineGrid',
  addOptions() {
    return { defaultSize: 22 };
  },
  addProseMirrorPlugins() {
    const size = this.options.defaultSize;
    const key = new PluginKey<DecorationSet>('lineGrid');
    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: (_, state) => lineGridDecorations(state.doc, size),
          apply: (tr, old, _o, next) => (tr.docChanged ? lineGridDecorations(next.doc, size) : old),
        },
        props: {
          decorations: (state) => key.getState(state),
        },
      }),
    ];
  },
});

/* --------------------------------------------------------------- schema */

/** Everything a page's text is made of. History is off: undo is per entry. */
export function pageExtensions(defaultSize = 22): AnyExtension[] {
  return [
    Document,
    PageParagraph,
    Text,
    Bold,
    Italic,
    Underline,
    Strike,
    HardBreak,
    PageBulletList,
    PageListItem,
    PageTaskList,
    PageTaskItem,
    Divider,
    FontMark,
    SizeMark,
    InkMark,
    HighlightMark,
    EffectMark,
    LineGrid.configure({ defaultSize }),
  ];
}

let schemaCache: ReturnType<typeof getSchema> | null = null;

/** The ProseMirror schema for page text (same for every page and journal). */
export function pageSchema() {
  schemaCache ??= getSchema(pageExtensions());
  return schemaCache;
}
