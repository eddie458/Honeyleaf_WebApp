// Opening, creating and finding entries.

import { api } from '../data/api';
import { nowIso, useBook, type EntryState } from '../data/bookStore';
import { entryFromServer } from '../data/sync';
import { bookSlots, entryForDate, localDate, slotOf } from '../model/book';
import { ulid } from '../model/ids';
import { emptyPage } from '../model/migrations';
import { DEFAULT_AREA } from '../model/page';
import { focusPage } from '../editor/flowController';

const loading = new Map<string, Promise<void>>();

/** Loads an entry from the server unless this device already holds it. */
export function ensureEntry(id: string): Promise<void> {
  if (useBook.getState().entries[id]) return Promise.resolve();
  let job = loading.get(id);
  if (!job) {
    job = api<Parameters<typeof entryFromServer>[0]>('GET', `entries/${id}`)
      .then((data) => {
        const local = useBook.getState().entries[id];
        if (local && local.rev > local.savedRev) return; // an unsent draft wins
        useBook.getState().putEntry(entryFromServer(data));
      })
      .finally(() => loading.delete(id));
    loading.set(id, job);
  }
  return job;
}

/** A new, empty entry for a date; it saves itself like any other change. */
export function createEntry(date: string): EntryState {
  const store = useBook.getState();
  const journal = store.journal;
  if (!journal) throw new Error('No journal is open.');
  const now = nowIso();
  const entry: EntryState = {
    id: ulid(),
    journalId: journal.id,
    header: { date, dateStyle: 'handwritten', tags: [] },
    pages: [{ id: ulid(), doc: emptyPage(journal.defaults.paper, DEFAULT_AREA) }],
    version: null,
    createdAt: now,
    updatedAt: now,
    rev: 1,
    savedRev: 0,
  };
  store.putEntry(entry);
  return entry;
}

/** Turns to an entry's page (by default its first). */
export function openEntry(entryId: string, pageIndex = 0): void {
  const { index, setSlot } = useBook.getState();
  setSlot(slotOf(bookSlots(index), entryId, pageIndex));
}

/**
 * The fresh page at the back of the book: a new entry for today, created on
 * first touch, with the caret in it. (Today's earlier entry, if any, stays as
 * it was; a day can hold more than one entry, like morning and evening.)
 */
export function startFreshEntry(): void {
  const entry = createEntry(localDate());
  useBook.getState().setMode('write');
  openEntry(entry.id, 0);
  focusPage(entry.pages[0]!.id, 1);
}

/** The ribbon: today's page if you've written today, else the fresh page. */
export function goToToday(): void {
  const { index, setSlot } = useBook.getState();
  const today = entryForDate(index, localDate());
  const slots = bookSlots(index);
  setSlot(today ? slotOf(slots, today.id, 0) : slots.length - 1);
}

/** The calendar: a date's entry, or a new one for that date. */
export function openDate(date: string, create: boolean): void {
  const { index } = useBook.getState();
  const found = entryForDate(index, date);
  if (found) {
    openEntry(found.id);
    return;
  }
  if (!create) return;
  const entry = createEntry(date);
  useBook.getState().setMode('write');
  openEntry(entry.id);
  focusPage(entry.pages[0]!.id, 1);
}
