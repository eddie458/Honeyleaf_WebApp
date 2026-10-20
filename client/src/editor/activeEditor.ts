// Which page editor has the caret, for the paper-strip toolbar and the pens.

import { create } from 'zustand';
import type { Editor } from '@tiptap/core';

interface ActiveEditorState {
  editor: Editor | null;
  entryId: string | null;
  pageId: string | null;
  setActive(editor: Editor, entryId: string, pageId: string): void;
  clearIf(editor: Editor | null): void;
}

export const useActiveEditor = create<ActiveEditorState>((set, get) => ({
  editor: null,
  entryId: null,
  pageId: null,
  setActive: (editor, entryId, pageId) => set({ editor, entryId, pageId }),
  clearIf: (editor) => {
    if (editor && get().editor === editor) set({ editor: null, entryId: null, pageId: null });
  },
}));
