// Typing writes with the pen in your hand: new text takes the current ink,
// hand (font) and size, like a real notebook, while bold, italic, underline
// and strike carry on from the text you're typing into.

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state';
import type { Mark, Schema } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';
import { useBook } from '../data/bookStore';

const PEN_MARKS = new Set(['font', 'ink', 'size', 'highlight', 'effect']);

export function penMarks(schema: Schema): Mark[] {
  const { pen, journal } = useBook.getState();
  const d = journal?.defaults;
  const marks: Mark[] = [];
  if (!d || pen.font !== d.font) marks.push(schema.marks.font!.create({ id: pen.font }));
  if (!d || pen.size !== d.size) marks.push(schema.marks.size!.create({ px: pen.size }));
  if (!d || pen.ink.color.toLowerCase() !== d.inkColor.toLowerCase()) marks.push(schema.marks.ink!.create(pen.ink));
  return marks;
}

/** Text typed elsewhere (see keystrokes.ts), written at the caret with the pen; newlines start paragraphs. */
export function typedTransaction(state: EditorState, text: string): Transaction {
  const carried = (state.storedMarks ?? state.selection.$from.marks()).filter((m) => !PEN_MARKS.has(m.type.name));
  const marks = [...carried, ...penMarks(state.schema)];
  const tr = state.tr.deleteSelection();
  text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .forEach((line, i) => {
      if (i > 0) {
        const parent = tr.selection.$from.parent;
        tr.split(tr.selection.from, 1, [{ type: parent.type, attrs: { ...parent.attrs, cont: false } }]);
      }
      if (line) tr.insert(tr.selection.from, state.schema.text(line, marks));
    });
  return tr;
}

export function writeTyped(view: EditorView, text: string): void {
  view.dispatch(typedTransaction(view.state, text).scrollIntoView());
}

export const PenInput = Extension.create({
  name: 'penInput',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('penInput'),
        props: {
          handleTextInput(view, from, to, text) {
            const { state } = view;
            const $from = state.doc.resolve(from);
            const carried = (state.storedMarks ?? $from.marks()).filter((m) => !PEN_MARKS.has(m.type.name));
            const marks = [...carried, ...penMarks(state.schema)];
            const tr = state.tr.replaceWith(from, to, state.schema.text(text, marks));
            view.dispatch(tr.scrollIntoView());
            return true;
          },
        },
      }),
    ];
  },
});
