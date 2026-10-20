// Creating and changing decorations through the book store.

import { useBook } from '../data/bookStore';
import { ulid } from '../model/ids';
import { PAGE_H, PAGE_W } from '../model/page';
import { keepOnPage, type Box, type Point } from '../model/transform';
import type { Decoration } from '../model/types';

type NewDecoration = Decoration extends infer D ? (D extends Decoration ? Omit<D, 'id' | 'z'> : never) : never;

/** Decorations placed just now: they press down with a little bounce. */
export const freshDecorations = new Set<string>();
export const markFresh = (id: string) => void freshDecorations.add(id);

const tilt = () => Math.round((Math.random() * 12 - 6) * 10) / 10;

export function nextZ(decorations: Decoration[]): number {
  return decorations.reduce((m, d) => Math.max(m, d.z), 0) + 1;
}

export function addDecoration(entryId: string, pageId: string, deco: NewDecoration): string {
  const id = ulid();
  useBook.getState().editPage(entryId, pageId, (doc) => {
    const placed = { ...deco, id, z: nextZ(doc.decorations) } as Decoration;
    const box = keepOnPage(placed, PAGE_W, PAGE_H);
    return { ...doc, decorations: [...doc.decorations, { ...placed, x: box.x, y: box.y } as Decoration] };
  });
  useBook.getState().select({ entryId, pageId, decoId: id });
  return id;
}

export function stickerAt(asset: string, size: number, p: Point): NewDecoration {
  return { type: 'sticker', asset, x: p.x, y: p.y, w: size, h: size, rot: tilt(), layer: 'front' };
}

export function tapeBox(asset: string, box: Box): NewDecoration {
  return { type: 'tape', asset, ends: Math.random() < 0.5 ? 'torn' : 'zigzag', seed: Math.floor(Math.random() * 1000), ...box, layer: 'front' };
}

export function photoAt(asset: string, p: Point, width = 236): NewDecoration {
  return { type: 'photo', asset, frame: 'instant', filter: 'none', x: p.x, y: p.y, w: width, h: Math.round(width * (318 / 262)), rot: tilt(), layer: 'front' };
}

export function updateBox(entryId: string, pageId: string, decoId: string, box: Box): void {
  const b = keepOnPage(box, PAGE_W, PAGE_H);
  useBook.getState().editDecoration(entryId, pageId, decoId, (d) => ({ ...d, x: b.x, y: b.y, w: b.w, h: b.h, rot: b.rot }), `deco:${decoId}`);
}

export function patchDecoration(entryId: string, pageId: string, decoId: string, patch: Partial<Decoration>): void {
  useBook.getState().editDecoration(entryId, pageId, decoId, (d) => ({ ...d, ...patch }) as Decoration);
}

export function removeDecoration(entryId: string, pageId: string, decoId: string): void {
  useBook.getState().editDecoration(entryId, pageId, decoId, () => null);
  useBook.getState().select(null);
}

export function duplicateDecoration(entryId: string, pageId: string, decoId: string): void {
  const page = useBook.getState().entries[entryId]?.pages.find((p) => p.id === pageId);
  const d = page?.doc.decorations.find((x) => x.id === decoId);
  if (!d) return;
  const { id: _id, z: _z, ...rest } = d;
  void _id;
  void _z;
  addDecoration(entryId, pageId, { ...rest, x: d.x + 24, y: d.y + 24, locked: false } as NewDecoration);
}

/** Moves a decoration one step up or down the stack (within its layer). */
export function restack(entryId: string, pageId: string, decoId: string, dir: 1 | -1): void {
  useBook.getState().editPage(entryId, pageId, (doc) => {
    const me = doc.decorations.find((d) => d.id === decoId);
    if (!me) return doc;
    const same = doc.decorations.filter((d) => d.layer === me.layer).sort((a, b) => a.z - b.z);
    const i = same.findIndex((d) => d.id === decoId);
    const other = same[i + dir];
    if (!other) return doc;
    return {
      ...doc,
      decorations: doc.decorations.map((d) => (d.id === me.id ? { ...d, z: other.z } : d.id === other.id ? { ...d, z: me.z } : d)),
    };
  });
}
