// Importing a diary backup, entirely in the browser.
//
// The .zip is read here and replayed through the normal API piece by piece
// (photos, then entries), with fresh IDs, so it works on any install and
// never meets PHP's upload or time limits.

import { strFromU8, unzipSync } from 'fflate';
import { api, ApiError } from './api';
import { useBook } from './bookStore';
import { ulid } from '../model/ids';
import { migrateHeader, migratePage } from '../model/migrations';
import type { Decoration, PageDoc } from '../model/types';

interface ExportFile {
  format: number;
  journals: { id: string; title: string; cover: unknown; defaults: unknown }[];
  entries: { id: string; journalId: string; date: string; title: string; header: unknown; pages: { id: string; index: number; doc: unknown }[] }[];
  assets: { id: string; kind: string; mime: string; file: string; thumb?: string }[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retries politely when the server asks us to slow down. */
async function withPatience<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'rate_limited' && attempt < 20) {
        const wait = Number((e.body.error as { retryAfter?: number } | undefined)?.retryAfter ?? 30);
        await sleep(Math.min(120, Math.max(2, wait)) * 1000);
        continue;
      }
      throw e;
    }
  }
}

export async function importBackup(file: File, progress: (done: number, total: number) => void): Promise<number> {
  const zip = new Uint8Array(await file.arrayBuffer());
  const head = unzipSync(zip, { filter: (f) => f.name === 'honeyleaf-export.json' });
  const json = head['honeyleaf-export.json'];
  if (!json) throw new Error('Not a Honeyleaf backup');
  const data = JSON.parse(strFromU8(json)) as ExportFile;
  if (data.format !== 1 || !Array.isArray(data.entries)) throw new Error('Unknown backup format');

  const journal = useBook.getState().journal;
  if (!journal) throw new Error('No journal is open');
  const total = data.assets.length + data.entries.length;
  let done = 0;
  progress(done, total);

  // Photos first, so entries can point at their new IDs.
  const assetMap = new Map<string, string>();
  for (const a of data.assets) {
    if (a.kind !== 'photo') {
      done++;
      continue;
    }
    const parts = unzipSync(zip, { filter: (f) => f.name === a.file || f.name === a.thumb });
    const full = parts[a.file];
    if (full) {
      const id = ulid();
      const form = new FormData();
      form.set('id', id);
      form.set('kind', 'photo');
      form.set('file', new Blob([full], { type: a.mime }), a.file.split('/').pop() ?? 'photo');
      const thumb = a.thumb ? parts[a.thumb] : undefined;
      if (thumb) form.set('thumb', new Blob([thumb], { type: a.mime }), 'thumb');
      await withPatience(() => api('POST', 'assets', form));
      assetMap.set(a.id, id);
    }
    progress(++done, total);
  }

  const remap = (doc: PageDoc): PageDoc => ({
    ...doc,
    decorations: doc.decorations.map((d) => {
      if (d.type === 'photo' && d.asset.startsWith('user:')) {
        const next = assetMap.get(d.asset.slice(5));
        return { ...d, id: ulid(), asset: next ? `user:${next}` : d.asset } as Decoration;
      }
      return { ...d, id: ulid() } as Decoration;
    }),
  });

  let entries = 0;
  for (const e of data.entries) {
    const id = ulid();
    const header = migrateHeader(e.header, e.date);
    header.date = e.date;
    if (e.title) header.title = e.title;
    const pages = [...e.pages].sort((a, b) => a.index - b.index).map((p, index) => ({ id: ulid(), index, doc: remap(migratePage(p.doc)) }));
    await withPatience(() =>
      api('PUT', `entries/${id}`, {
        baseVersion: null,
        entry: { journalId: journal.id, date: e.date, title: e.title ?? '', header, schema: 1 },
        pages,
      }),
    );
    entries++;
    progress(++done, total);
  }
  return entries;
}
