// Where something you add (a sticker, a photo) lands: the page you're
// working on, or the page under your finger when you drop it.

import { useBook } from '../data/bookStore';
import { useActiveEditor } from '../editor/activeEditor';
import { bookSlots, localDate, entryForDate } from '../model/book';
import { PAGE_H, PAGE_W } from '../model/page';
import type { Point } from '../model/transform';
import { createEntry, ensureEntry, openEntry } from './entries';

export interface PageTarget {
  entryId: string;
  pageId: string;
}

/** The page to add things to when you tap rather than drag. */
export async function currentTarget(): Promise<PageTarget> {
  const store = useBook.getState();
  const active = useActiveEditor.getState();
  if (active.entryId && active.pageId && store.entries[active.entryId]) return { entryId: active.entryId, pageId: active.pageId };
  const slots = bookSlots(store.index);
  const cur = Math.min(store.slot, slots.length - 1);
  const spread = Math.floor(cur / 2) * 2;
  for (const k of [spread + 1, spread, cur]) {
    const sl = slots[k];
    if (sl?.kind === 'page') {
      await ensureEntry(sl.entryId);
      return { entryId: sl.entryId, pageId: sl.pageId };
    }
  }
  return todayTarget();
}

/** Today's entry (made if needed), on its last page. */
export async function todayTarget(): Promise<PageTarget> {
  const store = useBook.getState();
  const found = entryForDate(store.index, localDate());
  if (found) {
    await ensureEntry(found.id);
    const e = useBook.getState().entries[found.id]!;
    return { entryId: e.id, pageId: e.pages[e.pages.length - 1]!.id };
  }
  const e = createEntry(localDate());
  openEntry(e.id);
  return { entryId: e.id, pageId: e.pages[0]!.id };
}

/** The page under a screen point, with the point in page units. */
export async function pageAt(clientX: number, clientY: number): Promise<(PageTarget & { point: Point }) | null> {
  for (const el of document.elementsFromPoint(clientX, clientY)) {
    const page = (el as HTMLElement).closest<HTMLElement>('[data-page-id], [data-blank-page]');
    if (!page) continue;
    const r = page.getBoundingClientRect();
    const k = PAGE_W / r.width;
    const point = { x: Math.min(PAGE_W, Math.max(0, (clientX - r.left) * k)), y: Math.min(PAGE_H, Math.max(0, (clientY - r.top) * k)) };
    if (page.dataset.pageId && page.dataset.entryId) return { entryId: page.dataset.entryId, pageId: page.dataset.pageId, point };
    const today = await todayTarget();
    return { ...today, point };
  }
  return null;
}

/** Middle of a page, nudged a little so things don't stack exactly. */
export function pageMiddle(): Point {
  return { x: PAGE_W / 2 + (Math.random() * 80 - 40), y: PAGE_H / 2 + (Math.random() * 120 - 60) };
}
