import { useEffect } from 'react';
import { useBook } from '../data/bookStore';
import { removeDecoration, updateBox } from '../decor/decorate';

function typing(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT'));
}

/**
 * Keyboard: Ctrl/⌘+Z and Shift+Ctrl/⌘+Z undo and redo everything; when you're
 * not typing, Delete removes the selected decoration, arrows nudge it, and
 * Esc puts things down.
 */
export function useDeskKeys(closePanel: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const store = useBook.getState();
      if (mod && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if (mod && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        store.redo();
        return;
      }
      if (e.key === 'Escape') {
        if (store.tool) store.setTool(null);
        else if (store.selected) store.select(null);
        else closePanel();
        return;
      }
      if (typing(e.target) || mod || e.altKey) return;
      const sel = store.selected;
      if (!sel) return;
      const deco = store.entries[sel.entryId]?.pages.find((p) => p.id === sel.pageId)?.doc.decorations.find((d) => d.id === sel.decoId);
      if (!deco) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeDecoration(sel.entryId, sel.pageId, sel.decoId);
        return;
      }
      const step = e.shiftKey ? 10 : 2;
      const nudge = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (nudge && !deco.locked) {
        e.preventDefault();
        updateBox(sel.entryId, sel.pageId, sel.decoId, { x: deco.x + nudge[0]!, y: deco.y + nudge[1]!, w: deco.w, h: deco.h, rot: deco.rot });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closePanel]);
}
