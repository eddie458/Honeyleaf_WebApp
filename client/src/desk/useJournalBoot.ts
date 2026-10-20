// Opening the signed-in person's diary: journal, entries, drafts, sync.

import { useEffect, useState } from 'react';
import { api } from '../data/api';
import { restoreOutbox } from '../data/assets';
import { useBook, type Journal } from '../data/bookStore';
import { useDatabaseFor } from '../data/idb';
import { queryClient, type SessionUser, type Settings } from '../data/queries';
import { restoreDrafts, startSync } from '../data/sync';
import { reflowEntry } from '../editor/flowController';
import { createEntry } from '../journal/entries';
import { welcomeLetter } from '../journal/welcome';
import { bookSlots, localDate, slotOf, type EntrySummary } from '../model/book';
import { firstJournalId } from '../model/ids';
import { t } from '../strings/en';
import { toast } from '../ui/toastStore';
import { addDecoration } from '../decor/decorate';

const DEFAULT_JOURNAL = (title: string): Omit<Journal, 'id'> => ({
  title,
  cover: { material: 'leather', color: '#6e3b44', stitch: '#f1d4b0', elastic: '#4a2530', ribbon: '#e3b448' },
  defaults: { paper: 'lined-cream', font: 'caveat', size: 22, ink: 'brown-black', inkColor: '#3b2a22' },
  sortOrder: 0,
});

interface ServerJournal extends Journal {
  createdAt: string;
  updatedAt: string;
}

export type BootState = 'loading' | 'ready' | 'error';

export function useJournalBoot(user: SessionUser): BootState {
  const [state, setState] = useState<BootState>('loading');

  useEffect(() => {
    let alive = true;
    const stopSync = startSync();
    (async () => {
      useDatabaseFor(user.id);
      useBook.getState().setOwner(user.displayName);
      const { journals } = await api<{ journals: ServerJournal[] }>('GET', 'journals');
      let journal: Journal | undefined = journals.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt))[0];
      if (!journal) {
        const fresh = { id: firstJournalId(user.id), ...DEFAULT_JOURNAL('My diary') };
        const res = await api<{ journal: ServerJournal }>('PUT', `journals/${fresh.id}`, fresh);
        journal = res.journal ?? fresh;
      }
      if (!alive) return;
      journal = { ...DEFAULT_JOURNAL(journal.title), ...journal, cover: { ...DEFAULT_JOURNAL('').cover, ...journal.cover }, defaults: { ...DEFAULT_JOURNAL('').defaults, ...journal.defaults } };
      const { entries } = await api<{ entries: EntrySummary[] }>('GET', `journals/${journal.id}/entries`);
      if (!alive) return;
      useBook.getState().openJournal(journal, entries);
      const restored = await restoreDrafts();
      if (restored) toast(t.sync.restored(restored), 'info');
      void restoreOutbox();

      const settings = await api<{ settings: Settings }>('GET', 'settings').then((r) => r.settings ?? {});
      if (!alive) return;
      queryClient.setQueryData(['settings'], settings);
      document.documentElement.dataset.readable = settings.readableFont ? 'on' : 'off';
      if (!settings.welcomed) {
        writeWelcome(user.displayName);
        const next = { ...settings, welcomed: true };
        queryClient.setQueryData(['settings'], next);
        void api('PUT', 'settings', { settings: next }).catch(() => undefined);
      } else {
        // Open on the most recent written page, like picking up where you
        // left off (the fresh page is beside it or one turn away).
        const { index } = useBook.getState();
        const slots = bookSlots(index);
        useBook.getState().setSlot(Math.max(1, slots.length - 2));
      }
      if (alive) setState('ready');
    })().catch(() => alive && setState('error'));
    return () => {
      alive = false;
      stopSync();
    };
  }, [user.id, user.displayName]);

  return state;
}

/** The first page of a new diary: a letter, with a sticker and a strip of tape. */
function writeWelcome(name: string): void {
  const entry = createEntry(localDate());
  const store = useBook.getState();
  store.editEntry(entry.id, (e) => ({
    header: { ...e.header, title: 'Welcome to Honeyleaf' },
    pages: e.pages.map((p, i) => (i === 0 ? { ...p, doc: { ...p.doc, text: welcomeLetter(name) } } : p)),
  }));
  reflowEntry(entry.id, 0);
  const firstPage = useBook.getState().entries[entry.id]!.pages[0]!.id;
  addDecoration(entry.id, firstPage, { type: 'sticker', asset: 'cozy/honey-jar', x: 500, y: 770, w: 96, h: 96, rot: 8, layer: 'front' });
  addDecoration(entry.id, firstPage, { type: 'tape', asset: 'gingham-rose', ends: 'torn', seed: 3, x: 520, y: 44, w: 120, h: 32, rot: 28, layer: 'front' });
  store.select(null);
  store.setSlot(slotOf(bookSlots(useBook.getState().index), entry.id, 0));
}
