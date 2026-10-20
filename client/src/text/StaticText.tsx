import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { DOMSerializer, Node as PMNode } from '@tiptap/pm/model';
import { pageSchema, strutSize } from '../editor/extensions';
import { fontFamily } from '../library/fonts';
import { metricsStyle, paragraphMetrics } from '../model/lineGrid';
import type { TextDoc } from '../model/types';

export interface TextDefaults {
  font: string;
  size: number;
  color: string;
}

/** CSS variables that set a page's default hand, size and ink. */
export function textVars(d: TextDefaults): CSSProperties {
  return {
    '--text-font': `${fontFamily(d.font)}, cursive`,
    '--text-size': `${d.size}px`,
    '--text-ink': d.color,
  } as CSSProperties;
}

/** Page text as a node of the shared page schema, or null if it can't be read. */
export function parseText(doc: TextDoc): PMNode | null {
  try {
    return PMNode.fromJSON(pageSchema(), doc);
  } catch (e) {
    console.warn('Honeyleaf: page text could not be read.', e);
    return null;
  }
}

/** For showing and measuring: unreadable text shows as an empty page (the stored text is untouched). */
export function toNode(doc: TextDoc): PMNode {
  const schema = pageSchema();
  return parseText(doc) ?? schema.node('doc', null, [schema.node('paragraph')]);
}

/** Gives each paragraph its line-grid metrics, in document order. */
export function applyLineGrid(root: ParentNode, doc: PMNode, defaultSize: number): void {
  const paras = root.querySelectorAll('p');
  let k = 0;
  doc.descendants((node) => {
    if (node.type.name !== 'paragraph') return true;
    const el = paras[k++] as HTMLElement | undefined;
    if (el) el.setAttribute('style', [el.getAttribute('style'), metricsStyle(paragraphMetrics(strutSize(node, defaultSize)))].filter(Boolean).join(';'));
    return false;
  });
}

/**
 * Page text that isn't being edited, rendered by ProseMirror's own
 * serializer: the very same DOM the editor builds, so nothing shifts when a
 * page becomes editable.
 */
export function StaticText({ doc, defaults, className }: { doc: TextDoc; defaults: TextDefaults; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const host = ref.current;
    if (!host) return;
    const node = toNode(doc);
    const frag = DOMSerializer.fromSchema(pageSchema()).serializeFragment(node.content, { document });
    applyLineGrid(frag, node, defaults.size);
    host.replaceChildren(frag);
  }, [doc, defaults.size]);
  return <div ref={ref} className={`hl-flow hl-grid ${className ?? ''}`} style={textVars(defaults)} inert aria-readonly="true" />;
}
