// Creating and changing decorations through the book store.

import { pictureRatio } from '../data/assets';
import { useBook } from '../data/bookStore';
import { ulid } from '../model/ids';
import { PAGE_H, PAGE_W } from '../model/page';
import { DEFAULT_RATIO, photoSize, type Crop } from '../model/photo';
import { keepOnPage, type Box, type Point } from '../model/transform';
import type { Decoration, PhotoFrame } from '../model/types';

type NewDecoration = Decoration extends infer D ? (D extends Decoration ? Omit<D, 'id' | 'z'> : never) : never;

/** A decoration being changed right now, drawn live before it is saved. */
export interface DecoDraft {
  id: string;
  box: Box;
  /** A photo being arranged in its frame. */
  crop?: Crop;
  ratio?: number;
}

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

/** A new print; `ratio` is the picture's own width ÷ height, when known. */
export function photoAt(asset: string, p: Point, frame: PhotoFrame = 'instant', ratio?: number): NewDecoration {
  const size = photoSize(frame, ratio ?? DEFAULT_RATIO);
  return { type: 'photo', asset, frame, filter: 'none', ...(ratio ? { ratio } : {}), x: p.x, y: p.y, w: size.w, h: size.h, rot: tilt(), layer: 'front' };
}

/** Puts a photo in another frame, keeping how much it has been enlarged or shrunk. */
export async function reframePhoto(entryId: string, pageId: string, decoId: string, frame: PhotoFrame): Promise<void> {
  const page = useBook.getState().entries[entryId]?.pages.find((p) => p.id === pageId);
  const deco = page?.doc.decorations.find((x) => x.id === decoId);
  if (deco?.type !== 'photo') return;
  const ratio = deco.ratio ?? (await pictureRatio(deco.asset)) ?? DEFAULT_RATIO;
  useBook.getState().editDecoration(entryId, pageId, decoId, (d) => {
    if (d.type !== 'photo' || d.frame === frame) return d;
    const scale = d.w / photoSize(d.frame, ratio).w;
    const size = photoSize(frame, ratio, scale);
    const b = keepOnPage({ x: d.x, y: d.y, w: size.w, h: size.h, rot: d.rot }, PAGE_W, PAGE_H);
    return { ...d, frame, ratio, x: b.x, y: b.y, w: b.w, h: b.h };
  });
}

/** Saves which part of a photo shows in its frame (null: centered, not zoomed). */
export function arrangePhoto(entryId: string, pageId: string, decoId: string, crop: Crop | null, ratio: number): void {
  useBook.getState().editDecoration(
    entryId,
    pageId,
    decoId,
    (d) => {
      if (d.type !== 'photo') return d;
      const { crop: _old, ...rest } = d;
      void _old;
      const round = (n: number, k: number) => Math.round(n * k) / k;
      return crop ? { ...rest, ratio: d.ratio ?? ratio, crop: { x: round(crop.x, 1e4), y: round(crop.y, 1e4), zoom: round(crop.zoom, 1e3) } } : { ...rest, ratio: d.ratio ?? ratio };
    },
    `arrange:${decoId}`,
  );
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
