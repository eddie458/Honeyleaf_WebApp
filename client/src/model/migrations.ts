// Every saved document carries a schema version. Old versions are upgraded
// step by step on load; anything malformed is repaired to a safe shape
// rather than thrown away, and a document from a newer app is refused (so an
// old tab can never overwrite it with less).

import { DEFAULT_AREA, PAGE_H, PAGE_W, type WritingArea } from './page';
import { PAGE_SCHEMA, type Decoration, type EntryHeader, type PageDoc, type TextDoc } from './types';

export class NewerDocumentError extends Error {
  constructor(version: number) {
    super(`This page was saved by a newer version of Honeyleaf (format ${version}).`);
    this.name = 'NewerDocumentError';
  }
}

type Json = Record<string, unknown>;

/** Upgrades from version n to n+1. Add a function here for every format change. */
const PAGE_UPGRADES: Record<number, (doc: Json) => Json> = {};

const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number, min = -1e6, max = 1e6) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
const str = (v: unknown, fallback: string, maxLen = 200) => (typeof v === 'string' ? v.slice(0, maxLen) : fallback);

export const EMPTY_TEXT: TextDoc = { type: 'doc', content: [{ type: 'paragraph' }] };

export function emptyPage(paperId: string, area: WritingArea = DEFAULT_AREA): PageDoc {
  return { v: PAGE_SCHEMA, paper: { id: paperId }, area: { ...area }, text: EMPTY_TEXT, decorations: [] };
}

function cleanArea(a: unknown): WritingArea {
  if (!isObj(a)) return { ...DEFAULT_AREA };
  const top = num(a.top, DEFAULT_AREA.top, 0, PAGE_H);
  const bottom = num(a.bottom, DEFAULT_AREA.bottom, 0, PAGE_H - top);
  const left = num(a.left, DEFAULT_AREA.left, 0, PAGE_W);
  const right = num(a.right, DEFAULT_AREA.right, 0, PAGE_W - left);
  return { top, right, bottom, left };
}

const DECORATION_TYPES = new Set(['sticker', 'tape', 'photo', 'stamp', 'paper', 'text', 'drawing']);

function cleanDecoration(d: unknown): Decoration | null {
  if (!isObj(d) || typeof d.type !== 'string' || !DECORATION_TYPES.has(d.type) || typeof d.id !== 'string') return null;
  return {
    ...(d as unknown as Decoration),
    x: num(d.x, PAGE_W / 2, -PAGE_W, PAGE_W * 2),
    y: num(d.y, PAGE_H / 2, -PAGE_H, PAGE_H * 2),
    w: num(d.w, 80, 4, 4000),
    h: num(d.h, 80, 4, 4000),
    rot: num(d.rot, 0, -360, 360),
    z: num(d.z, 1, -1e6, 1e6),
    layer: d.layer === 'back' ? 'back' : 'front',
  } as Decoration;
}

export function migratePage(raw: unknown): PageDoc {
  let doc: Json = isObj(raw) ? { ...raw } : {};
  let v = num(doc.v, 1);
  if (v > PAGE_SCHEMA) throw new NewerDocumentError(v);
  while (v < PAGE_SCHEMA) {
    const up = PAGE_UPGRADES[v];
    if (!up) break;
    doc = up(doc);
    v += 1;
  }
  const text = isObj(doc.text) && doc.text.type === 'doc' && Array.isArray(doc.text.content) && doc.text.content.length > 0 ? (doc.text as unknown as TextDoc) : EMPTY_TEXT;
  const decorations = Array.isArray(doc.decorations) ? doc.decorations.map(cleanDecoration).filter((d): d is Decoration => d !== null) : [];
  const page: PageDoc = {
    v: PAGE_SCHEMA,
    paper: { id: str(isObj(doc.paper) ? doc.paper.id : undefined, 'lined-cream', 64) },
    area: cleanArea(doc.area),
    text,
    decorations,
  };
  if (doc.favorite === true) page.favorite = true;
  if (doc.flow === 'auto') page.flow = 'auto';
  return page;
}

export function migrateHeader(raw: unknown, fallbackDate: string): EntryHeader {
  const h = isObj(raw) ? raw : {};
  const header: EntryHeader = {
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(h.date)) ? String(h.date) : fallbackDate,
    dateStyle: h.dateStyle === 'stamp' || h.dateStyle === 'typewriter' ? h.dateStyle : 'handwritten',
    tags: Array.isArray(h.tags) ? h.tags.filter((t): t is string => typeof t === 'string').slice(0, 20) : [],
  };
  if (typeof h.title === 'string') header.title = h.title.slice(0, 200);
  if (typeof h.titleLettering === 'string') header.titleLettering = h.titleLettering.slice(0, 64);
  if (typeof h.mood === 'string') header.mood = h.mood.slice(0, 32);
  if (typeof h.weather === 'string') header.weather = h.weather.slice(0, 32);
  return header;
}
