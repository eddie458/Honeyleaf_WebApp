// Autosave and the offline safety net.
//
// Every change lands in IndexedDB first (within ~300 ms), then the entry is
// sent to the server about a second after the last change, on page turns and
// when you leave. Offline, saves wait and retry with backoff; when the
// network returns they are flushed. A version mismatch never overwrites: the
// server keeps both copies and we switch to its version and say so.

import { api, ApiError, isOffline } from './api';
import { useBook, type EntryState } from './bookStore';
import { idbAll, idbDelete, idbPut } from './idb';
import { toast } from '../ui/toastStore';
import { t } from '../strings/en';
import { migrateHeader, migratePage } from '../model/migrations';

const SAVE_DELAY = 1000;
const DRAFT_DELAY = 250;

const saveTimers = new Map<string, number>();
const draftTimers = new Map<string, number>();
const inFlight = new Map<string, Promise<void>>();
const again = new Set<string>();
let retryTimer = 0;
let backoff = 2000;

interface Draft {
  entry: EntryState;
  savedAt: number;
}

export interface EntryPayload {
  baseVersion: number | null;
  entry: { journalId: string; date: string; title: string; header: EntryState['header']; schema: number };
  pages: { id: string; index: number; doc: EntryState['pages'][number]['doc'] }[];
}

export function payloadOf(e: EntryState): EntryPayload {
  return {
    baseVersion: e.version,
    entry: { journalId: e.journalId, date: e.header.date, title: e.header.title ?? '', header: e.header, schema: 1 },
    pages: e.pages.map((p, index) => ({ id: p.id, index, doc: p.doc })),
  };
}

function writeDraft(e: EntryState): void {
  window.clearTimeout(draftTimers.get(e.id));
  draftTimers.set(
    e.id,
    window.setTimeout(() => {
      const latest = useBook.getState().entries[e.id];
      if (!latest) return;
      void idbPut('drafts', latest.id, { entry: latest, savedAt: Date.now() } satisfies Draft).catch(() => undefined);
    }, DRAFT_DELAY),
  );
}

export function scheduleSave(entryId: string, delay = SAVE_DELAY): void {
  window.clearTimeout(saveTimers.get(entryId));
  saveTimers.set(entryId, window.setTimeout(() => void saveNow(entryId), delay));
}

function scheduleRetry(): void {
  window.clearTimeout(retryTimer);
  retryTimer = window.setTimeout(() => void flushAll(), backoff);
  backoff = Math.min(backoff * 2, 60_000);
}

export async function saveNow(entryId: string, keepalive = false): Promise<void> {
  const running = inFlight.get(entryId);
  if (running) {
    again.add(entryId);
    return running;
  }
  const e = useBook.getState().entries[entryId];
  if (!e || e.rev <= e.savedRev) return;
  window.clearTimeout(saveTimers.get(entryId));
  const rev = e.rev;
  const body = payloadOf(e);
  const small = keepalive && JSON.stringify(body).length < 60_000;
  const job = api<{ version: number; updatedAt: string }>('PUT', `entries/${entryId}`, body, { keepalive: small })
    .then((res) => {
      useBook.getState().markSaved(entryId, rev, res.version, res.updatedAt);
      backoff = 2000;
      const now = useBook.getState().entries[entryId];
      if (now && now.rev === now.savedRev) void idbDelete('drafts', entryId).catch(() => undefined);
    })
    .catch((err: unknown) => {
      if (err instanceof ApiError && err.code === 'conflict') return resolveConflict(entryId, err.body);
      if (isOffline(err)) {
        useBook.getState().setSaveStatus('offline');
        scheduleRetry();
        return;
      }
      if (err instanceof ApiError && (err.code === 'unauthenticated' || err.code === 'locked' || err.code === 'must_change_password')) {
        // The draft is safe in IndexedDB; it is sent again after unlocking.
        useBook.getState().setSaveStatus('offline');
        return;
      }
      useBook.getState().setSaveStatus('error');
      scheduleRetry();
    })
    .finally(() => {
      inFlight.delete(entryId);
      if (again.delete(entryId)) scheduleSave(entryId, 0);
    });
  inFlight.set(entryId, job);
  return job;
}

export async function flushAll(keepalive = false): Promise<void> {
  const dirty = Object.values(useBook.getState().entries).filter((e) => e.rev > e.savedRev);
  await Promise.all(dirty.map((e) => saveNow(e.id, keepalive)));
}

interface ServerEntry {
  entry: { id: string; journalId: string; date: string; title: string; header: unknown; version: number; conflictOf: string | null; createdAt: string; updatedAt: string };
  pages: { id: string; index: number; doc: unknown }[];
}

export function entryFromServer(data: ServerEntry): EntryState {
  const header = migrateHeader(data.entry.header, data.entry.date);
  header.date = data.entry.date;
  if (data.entry.title) header.title = data.entry.title;
  return {
    id: data.entry.id,
    journalId: data.entry.journalId,
    header,
    pages: [...data.pages].sort((a, b) => a.index - b.index).map((p) => ({ id: p.id, doc: migratePage(p.doc) })),
    version: data.entry.version,
    createdAt: data.entry.createdAt,
    updatedAt: data.entry.updatedAt,
    rev: 0,
    savedRev: 0,
    conflictOf: data.entry.conflictOf,
  };
}

async function resolveConflict(entryId: string, body: Record<string, unknown>): Promise<void> {
  const current = body.current as ServerEntry | undefined;
  const store = useBook.getState();
  if (current) store.putEntry(entryFromServer(current));
  const copyId = typeof body.conflictCopyId === 'string' ? body.conflictCopyId : null;
  if (copyId) {
    try {
      store.putEntry(entryFromServer(await api<ServerEntry>('GET', `entries/${copyId}`)));
    } catch {
      /* the copy shows up with the next index refresh */
    }
  }
  void idbDelete('drafts', entryId).catch(() => undefined);
  store.setSaveStatus('saved');
  toast(t.sync.conflict, 'warn');
}

/** Puts unsent drafts from this device back into the book, newest wins. */
export async function restoreDrafts(): Promise<number> {
  const drafts = await idbAll<Draft>('drafts').catch(() => [] as Draft[]);
  const store = useBook.getState();
  let restored = 0;
  for (const d of drafts) {
    const e = d.entry;
    if (!e || e.rev <= e.savedRev || (store.journal && e.journalId !== store.journal.id)) continue;
    const current = store.entries[e.id];
    if (current && current.rev >= e.rev) continue;
    store.putEntry(e);
    restored++;
  }
  return restored;
}

let started = false;

export function startSync(): () => void {
  if (started) return () => undefined;
  started = true;
  const unsub = useBook.subscribe((state, prev) => {
    if (state.entries === prev.entries) return;
    for (const e of Object.values(state.entries)) {
      const before = prev.entries[e.id];
      if (before && before.rev === e.rev) continue;
      if (e.rev > e.savedRev) {
        writeDraft(e);
        scheduleSave(e.id);
      }
    }
  });
  const online = () => {
    backoff = 2000;
    void flushAll();
  };
  const hidden = () => {
    if (document.visibilityState === 'hidden') void flushAll(true);
  };
  const leave = () => void flushAll(true);
  window.addEventListener('online', online);
  document.addEventListener('visibilitychange', hidden);
  window.addEventListener('pagehide', leave);
  return () => {
    started = false;
    unsub();
    window.removeEventListener('online', online);
    document.removeEventListener('visibilitychange', hidden);
    window.removeEventListener('pagehide', leave);
  };
}
