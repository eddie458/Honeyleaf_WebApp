import { useEffect, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { Placeholder } from '@tiptap/extensions';
import type { Editor } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { useBook } from '../data/bookStore';
import { EMPTY_TEXT } from '../model/migrations';
import type { TextDoc } from '../model/types';
import { t } from '../strings/en';
import { textVars, toNode, type TextDefaults } from '../text/StaticText';
import { useActiveEditor } from './activeEditor';
import { pageExtensions } from './extensions';
import { editorFor, focusPage, pageEdited, reflowEntry, registerEditor, unregisterEditor } from './flowController';
import { PenInput } from './penInput';

interface Props {
  entryId: string;
  pageId: string;
  defaults: TextDefaults;
  placeholder?: string;
}

/** One page's live editor, kept in step with the book store. */
export function PageEditor({ entryId, pageId, defaults, placeholder }: Props) {
  const text = useBook((s) => s.entries[entryId]?.pages.find((p) => p.id === pageId)?.doc.text);
  const lastJson = useRef<TextDoc | undefined>(text);
  const ids = useRef({ entryId, pageId });
  ids.current = { entryId, pageId };

  const editor = useEditor(
    {
      extensions: [...pageExtensions(defaults.size), PenInput, Placeholder.configure({ placeholder: placeholder ?? '' })],
      content: text ?? EMPTY_TEXT,
      editorProps: {
        attributes: {
          // No spellcheck attribute: it follows the drawer's setting on the page root.
          class: 'hl-flow hl-grid',
          role: 'textbox',
          'aria-multiline': 'true',
          'aria-label': t.journal.pageText,
        },
        handleKeyDown: (view, event) => crossPageKey(view, event, ids.current.entryId, ids.current.pageId),
      },
      onFocus: ({ editor: ed }) => useActiveEditor.getState().setActive(ed, entryId, pageId),
      onUpdate: ({ editor: ed, transaction }) => {
        if (transaction.getMeta('hl-sync') || ed.view.composing) return;
        const json = ed.getJSON() as TextDoc;
        lastJson.current = json;
        pageEdited(ids.current.entryId, ids.current.pageId, ed, json);
      },
    },
    [pageId, defaults.size],
  );

  // The flow finds page editors by page ID. Tied to this exact editor, so a
  // replaced editor (React's double start, a new page size) never removes
  // its successor.
  useEffect(() => {
    if (!editor) return;
    registerEditor(pageId, editor);
    return () => unregisterEditor(pageId, editor);
  }, [editor, pageId]);

  // Changes from elsewhere (the flow, undo, a sync) replace the text, keeping
  // the caret. The new text is built with this editor's own schema: every
  // TipTap editor has its own schema instance, and ProseMirror quietly drops
  // nodes that belong to another one (that once emptied a whole page).
  useEffect(() => {
    if (!editor || editor.isDestroyed || !text || text === lastJson.current) return;
    let node: PMNode;
    try {
      node = editor.schema.nodeFromJSON(text);
    } catch (e) {
      // Never swap readable words for nothing: keep what the editor shows.
      console.warn('Honeyleaf: page text could not be put in the editor.', e);
      return;
    }
    lastJson.current = text;
    if (node.eq(editor.state.doc)) return;
    const { from, to } = editor.state.selection;
    const tr = editor.state.tr.replaceWith(0, editor.state.doc.content.size, node.content);
    const max = tr.doc.content.size;
    tr.setSelection(TextSelection.between(tr.doc.resolve(Math.min(from, max)), tr.doc.resolve(Math.min(to, max))));
    editor.view.dispatch(tr.setMeta('hl-sync', true).setMeta('addToHistory', false));
  }, [editor, text]);

  // Composition (phone keyboards, accents) settles before the text flows.
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const end = () =>
      requestAnimationFrame(() => {
        if (editor.isDestroyed) return;
        const json = editor.getJSON() as TextDoc;
        lastJson.current = json;
        pageEdited(ids.current.entryId, ids.current.pageId, editor, json);
      });
    dom.addEventListener('compositionend', end);
    return () => dom.removeEventListener('compositionend', end);
  }, [editor]);

  useEffect(() => () => useActiveEditor.getState().clearIf(editor), [editor]);

  return <EditorContent editor={editor} className="hl-editor" style={textVars(defaults)} />;
}

/* ------------------------------------------------- crossing page edges */

function pageNeighbors(entryId: string, pageId: string) {
  const entry = useBook.getState().entries[entryId];
  if (!entry) return null;
  const i = entry.pages.findIndex((p) => p.id === pageId);
  return { entry, i, prev: entry.pages[i - 1], next: entry.pages[i + 1] };
}

function atDocStart(view: EditorView): boolean {
  const { empty, $from } = view.state.selection;
  return empty && $from.pos <= 1 && $from.parentOffset === 0;
}

function atDocEnd(view: EditorView): boolean {
  const { empty, $to } = view.state.selection;
  return empty && $to.pos >= view.state.doc.content.size - 1 && $to.parentOffset === $to.parent.content.size;
}

/** Backspace, Delete and the arrow keys carry on across page boundaries. */
function crossPageKey(view: EditorView, event: KeyboardEvent, entryId: string, pageId: string): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  const nb = pageNeighbors(entryId, pageId);
  if (!nb) return false;
  const store = useBook.getState();

  if (event.key === 'Backspace' && nb.prev && atDocStart(view)) {
    const prevId = nb.prev.id;
    const first = view.state.doc.firstChild;
    const prevNode = toNode(nb.prev.doc.text);
    const last = prevNode.lastChild;
    if (first?.attrs.cont && last?.type.name === 'paragraph' && last.content.size > 0) {
      // Mid-paragraph: remove the last character of the page before.
      const end = prevNode.content.size - 1;
      store.editPage(entryId, prevId, (doc) => ({ ...doc, text: prevNode.replace(end - 1, end, prevNode.slice(end, end)).toJSON() as TextDoc }), 'type');
    } else {
      // Join this page's first paragraph onto the last one of the page before.
      store.editPage(entryId, pageId, (doc) => ({ ...doc, text: joinFirst(doc.text) }), 'type');
    }
    reflowEntry(entryId, nb.i - 1, 'type');
    focusLogical(entryId, nb.i - 1);
    return true;
  }

  if (event.key === 'Delete' && nb.next && atDocEnd(view)) {
    const nextId = nb.next.id;
    store.editPage(entryId, nextId, (doc) => {
      const node = toNode(doc.text);
      const first = node.firstChild;
      if (first?.attrs.cont && first.type.name === 'paragraph' && first.content.size > 0) {
        return { ...doc, text: node.replace(1, 2, node.slice(2, 2)).toJSON() as TextDoc };
      }
      return { ...doc, text: joinFirst(doc.text) };
    }, 'type');
    const pos = view.state.selection.head;
    reflowEntry(entryId, nb.i, 'type');
    queueMicrotask(() => {
      const ed = editorFor(pageId);
      if (ed) ed.commands.setTextSelection(Math.min(pos, ed.state.doc.content.size - 1));
    });
    return true;
  }

  if ((event.key === 'ArrowRight' || event.key === 'ArrowDown') && nb.next && atDocEnd(view)) {
    focusPage(nb.next.id, 1);
    return true;
  }
  if ((event.key === 'ArrowLeft' || event.key === 'ArrowUp') && nb.prev && atDocStart(view)) {
    const prevText = toNode(nb.prev.doc.text);
    focusPage(nb.prev.id, prevText.content.size - 1);
    return true;
  }
  return false;
}

function joinFirst(text: TextDoc): TextDoc {
  const content = text.content.slice();
  const first = content[0];
  if (first && first.type === 'paragraph') content[0] = { ...first, attrs: { ...(first.attrs ?? {}), cont: true } };
  return { ...text, content };
}

/** After a cross-page edit, put the caret at the end of the page before. */
function focusLogical(entryId: string, pageIndex: number): void {
  queueMicrotask(() => {
    const entry = useBook.getState().entries[entryId];
    const page = entry?.pages[pageIndex];
    if (!page) return;
    const ed = editorFor(page.id);
    const size = toNode(page.doc.text).content.size;
    if (ed) {
      ed.commands.focus();
      ed.commands.setTextSelection(Math.max(1, size - 1));
    } else focusPage(page.id, size - 1);
  });
}

export type { Editor };
