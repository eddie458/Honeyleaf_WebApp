// The open book: the journal, its entries index, the entries being read or
// edited, where you are, and what is in your hand. Every change to an entry
// goes through editEntry(), which records undo history, bumps the entry's
// local revision (so autosave knows it is dirty) and keeps the index in step.

import { create } from 'zustand';
import type { EntrySummary } from '../model/book';
import { History } from '../model/history';
import type { Decoration, EntryHeader, PageDoc } from '../model/types';

export type Mode = 'write' | 'decorate' | 'draw';

export interface JournalDefaults {
  paper: string;
  font: string;
  size: number;
  ink: string;
  inkColor: string;
}

export interface JournalCover {
  material: string;
  color: string;
  stitch: string;
  elastic: string;
  ribbon: string;
  label?: string;
}

export interface Journal {
  id: string;
  title: string;
  cover: JournalCover;
  defaults: JournalDefaults;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PageState {
  id: string;
  doc: PageDoc;
}

export interface EntryState {
  id: string;
  journalId: string;
  header: EntryHeader;
  pages: PageState[];
  /** The server version this copy is based on (null: never saved). */
  version: number | null;
  createdAt: string;
  updatedAt: string;
  /** Local revision; autosave sends the entry while rev > savedRev. */
  rev: number;
  savedRev: number;
  conflictOf?: string | null;
}

export type Tool =
  | { kind: 'sticker'; asset: string; size: number }
  | { kind: 'tape'; asset: string; width: number }
  | null;

export interface Pen {
  font: string;
  size: number;
  ink: { id: string; color: string };
  highlighter: string;
}

export type SaveStatus = 'saved' | 'drying' | 'offline' | 'error';

interface Snapshot {
  header: EntryHeader;
  pages: PageState[];
}

const histories = new Map<string, History<Snapshot>>();
export function historyOf(entryId: string): History<Snapshot> {
  let h = histories.get(entryId);
  if (!h) {
    h = new History<Snapshot>();
    histories.set(entryId, h);
  }
  return h;
}

export const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

export function summaryOf(e: EntryState): EntrySummary {
  return {
    id: e.id,
    date: e.header.date,
    title: e.header.title ?? '',
    pageIds: e.pages.map((p) => p.id),
    createdAt: e.createdAt,
    version: e.version ?? 0,
    hasPhotos: e.pages.some((p) => p.doc.decorations.some((d) => d.type === 'photo')),
    conflictOf: e.conflictOf ?? null,
  };
}

function withSummary(index: EntrySummary[], e: EntryState): EntrySummary[] {
  const s = summaryOf(e);
  const i = index.findIndex((x) => x.id === e.id);
  if (i < 0) return [...index, s];
  const copy = index.slice();
  copy[i] = s;
  return copy;
}

export interface Selection {
  entryId: string;
  pageId: string;
  decoId: string;
}

export interface BookState {
  /** The diary's owner, for the nameplate inside the cover. */
  ownerName: string;
  journal: Journal | null;
  index: EntrySummary[];
  entries: Record<string, EntryState>;
  /** Current page slot (see model/book.ts); on wide screens its spread is shown. */
  slot: number;
  mode: Mode;
  selected: Selection | null;
  tool: Tool;
  pen: Pen;
  /** The entry that undo/redo apply to: the one changed last. */
  focusEntry: string | null;
  saveStatus: SaveStatus;

  setOwner(name: string): void;
  openJournal(journal: Journal, index: EntrySummary[]): void;
  setJournal(journal: Journal): void;
  setIndex(index: EntrySummary[]): void;
  putEntry(entry: EntryState): void;
  dropEntry(entryId: string): void;
  editEntry(entryId: string, change: (e: EntryState) => Partial<Pick<EntryState, 'header' | 'pages'>>, group?: string | null): void;
  editPage(entryId: string, pageId: string, change: (page: PageDoc) => PageDoc, group?: string | null): void;
  editDecoration(entryId: string, pageId: string, decoId: string, change: (d: Decoration) => Decoration | null, group?: string | null): void;
  markSaved(entryId: string, rev: number, version: number, updatedAt: string): void;
  undo(): boolean;
  redo(): boolean;
  setSlot(slot: number): void;
  setMode(mode: Mode): void;
  select(sel: Selection | null): void;
  setTool(tool: Tool): void;
  setPen(pen: Partial<Pen>): void;
  setSaveStatus(status: SaveStatus): void;
}

export const useBook = create<BookState>((set, get) => ({
  ownerName: '',
  journal: null,
  index: [],
  entries: {},
  slot: 1,
  mode: 'write',
  selected: null,
  tool: null,
  pen: { font: 'caveat', size: 22, ink: { id: 'brown-black', color: '#3b2a22' }, highlighter: '#ffe94a' },
  focusEntry: null,
  saveStatus: 'saved',

  setOwner: (ownerName) => set({ ownerName }),
  openJournal: (journal, index) =>
    set({
      journal,
      index,
      entries: {},
      selected: null,
      pen: { font: journal.defaults.font, size: journal.defaults.size, ink: { id: journal.defaults.ink, color: journal.defaults.inkColor }, highlighter: '#ffe94a' },
    }),
  setJournal: (journal) => set({ journal }),
  setIndex: (index) => set({ index }),

  putEntry: (entry) => set((s) => ({ entries: { ...s.entries, [entry.id]: entry }, index: withSummary(s.index, entry) })),

  dropEntry: (entryId) =>
    set((s) => {
      const entries = { ...s.entries };
      delete entries[entryId];
      histories.delete(entryId);
      return { entries, index: s.index.filter((e) => e.id !== entryId), selected: s.selected?.entryId === entryId ? null : s.selected };
    }),

  editEntry: (entryId, change, group = null) =>
    set((s) => {
      const e = s.entries[entryId];
      if (!e) return {};
      const patch = change(e);
      const changed = (patch.pages !== undefined && patch.pages !== e.pages) || (patch.header !== undefined && patch.header !== e.header);
      if (!changed) return {};
      historyOf(entryId).record({ header: e.header, pages: e.pages }, group);
      const next: EntryState = { ...e, ...patch, rev: e.rev + 1, updatedAt: nowIso() };
      return { entries: { ...s.entries, [entryId]: next }, index: withSummary(s.index, next), focusEntry: entryId, saveStatus: 'drying' };
    }),

  editPage: (entryId, pageId, change, group = null) =>
    get().editEntry(
      entryId,
      (e) => ({
        pages: e.pages.map((p) => (p.id === pageId ? { ...p, doc: change(p.doc) } : p)),
      }),
      group,
    ),

  editDecoration: (entryId, pageId, decoId, change, group = null) =>
    get().editPage(
      entryId,
      pageId,
      (doc) => ({
        ...doc,
        decorations: doc.decorations.flatMap((d) => {
          if (d.id !== decoId) return [d];
          const out = change(d);
          return out ? [out] : [];
        }),
      }),
      group,
    ),

  markSaved: (entryId, rev, version, updatedAt) =>
    set((s) => {
      const e = s.entries[entryId];
      if (!e) return {};
      const next = { ...e, version, savedRev: Math.max(e.savedRev, rev), updatedAt };
      const allSaved = Object.values({ ...s.entries, [entryId]: next }).every((x) => x.rev === x.savedRev);
      return { entries: { ...s.entries, [entryId]: next }, index: withSummary(s.index, next), saveStatus: allSaved ? 'saved' : s.saveStatus };
    }),

  undo: () => {
    const { focusEntry, entries } = get();
    const e = focusEntry ? entries[focusEntry] : undefined;
    if (!e) return false;
    const prev = historyOf(e.id).undo({ header: e.header, pages: e.pages });
    if (!prev) return false;
    const next = { ...e, header: prev.header, pages: prev.pages, rev: e.rev + 1, updatedAt: nowIso() };
    set((s) => ({ entries: { ...s.entries, [e.id]: next }, index: withSummary(s.index, next), saveStatus: 'drying', selected: null }));
    return true;
  },

  redo: () => {
    const { focusEntry, entries } = get();
    const e = focusEntry ? entries[focusEntry] : undefined;
    if (!e) return false;
    const fwd = historyOf(e.id).redo({ header: e.header, pages: e.pages });
    if (!fwd) return false;
    const next = { ...e, header: fwd.header, pages: fwd.pages, rev: e.rev + 1, updatedAt: nowIso() };
    set((s) => ({ entries: { ...s.entries, [e.id]: next }, index: withSummary(s.index, next), saveStatus: 'drying', selected: null }));
    return true;
  },

  setSlot: (slot) => set({ slot: Math.max(0, slot), selected: null }),
  setMode: (mode) => set({ mode, selected: null, tool: mode === 'decorate' ? get().tool : null }),
  select: (selected) => set({ selected }),
  setTool: (tool) => set({ tool, mode: tool ? 'decorate' : get().mode, selected: null }),
  setPen: (pen) => set((s) => ({ pen: { ...s.pen, ...pen } })),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
}));
