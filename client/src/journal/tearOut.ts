// Tearing a page out of the book. The next save tells the server which pages
// were torn out, so it keeps them in the wastebasket; a sticky note offers to
// put the page straight back.

import { useBook, type EntryState, type PageState } from '../data/bookStore';
import { reflowEntry } from '../editor/flowController';
import { ulid } from '../model/ids';
import { emptyPage } from '../model/migrations';
import { DEFAULT_AREA } from '../model/page';
import { hasContent, withoutPage, withoutTitle } from '../model/tear';
import { t } from '../strings/en';
import { toast } from '../ui/toastStore';

type Snapshot = Pick<EntryState, 'header' | 'pages'>;

/** Tears a page out of its entry, as one undo step. */
export function tearOutPage(entryId: string, pageId: string): void {
  const store = useBook.getState();
  const entry = store.entries[entryId];
  const at = entry ? entry.pages.findIndex((p) => p.id === pageId) : -1;
  if (!entry || at < 0) return;
  const page = entry.pages[at]!;
  const paper = store.journal?.defaults.paper ?? page.doc.paper.id;
  const pages = withoutPage(entry.pages, pageId, () => ({ id: ulid(), doc: emptyPage(paper, DEFAULT_AREA) }));
  if (!pages) return;
  const before: Snapshot = { header: entry.header, pages: entry.pages };
  const group = `tear:${pageId}`;
  // Tearing out the only page starts the entry over; otherwise its title moves to the next page.
  const restart = entry.pages.length === 1;
  store.editEntry(entryId, (e) => ({ pages, header: restart ? withoutTitle(e.header) : e.header, torn: [...(e.torn ?? []), pageId] }), group);
  if (store.selected?.pageId === pageId) store.select(null);
  // The words on either side of the gap close up.
  reflowEntry(entryId, Math.max(0, at - 1), group);
  const after = useBook.getState().entries[entryId]?.pages;
  toast(hasContent(page.doc) ? t.journal.tornOut : t.journal.tornBlank, 'done', {
    label: t.journal.putBack,
    run: () => putBack(entryId, page, at, before, after),
  });
}

/** Back exactly as it was if nothing changed since, else slipped back into its place. */
function putBack(entryId: string, page: PageState, at: number, before: Snapshot, after: PageState[] | undefined): void {
  const store = useBook.getState();
  const entry = store.entries[entryId];
  if (!entry || entry.pages.some((p) => p.id === page.id)) return;
  const torn = entry.torn?.filter((id) => id !== page.id);
  if (entry.pages === after) {
    store.editEntry(entryId, () => ({ ...before, torn }));
    return;
  }
  const pages = [...entry.pages];
  pages.splice(Math.min(at, pages.length), 0, page);
  const header = before.pages.length === 1 && !entry.header.title ? { ...entry.header, title: before.header.title, titleLettering: before.header.titleLettering } : entry.header;
  store.editEntry(entryId, () => ({ pages, header, torn }));
  reflowEntry(entryId, Math.max(0, at - 1));
}
