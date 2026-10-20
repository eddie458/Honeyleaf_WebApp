// Photos: prepared in the browser, kept safe in IndexedDB, uploaded when
// the server can be reached.
//
// Each photo is decoded with its EXIF orientation applied, scaled to at most
// 2 560 px on its long edge and re-encoded (WebP, or JPEG where the browser
// can't write WebP). Re-encoding drops every bit of metadata, including GPS.

import { api, apiUrl, ApiError, isOffline } from './api';
import { idbAll, idbDelete, idbPut } from './idb';
import { libraryUrl } from '../library/library';
import { ulid } from '../model/ids';
import { toast } from '../ui/toastStore';
import { t } from '../strings/en';

const MAX_EDGE = 2560;
const THUMB_EDGE = 480;

interface OutboxItem {
  id: string;
  kind: 'photo';
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
  name: string;
  createdAt: number;
}

const localUrls = new Map<string, { full: string; thumb: string }>();
/** Photos added in this session: they "develop" as they land. */
export const freshPhotos = new Set<string>();

export function assetSrc(asset: string, size: 'full' | 'thumb' = 'full'): string {
  if (asset.startsWith('user:')) {
    const id = asset.slice(5);
    const local = localUrls.get(id);
    if (local) return size === 'thumb' ? local.thumb : local.full;
    return apiUrl(`assets/${id}?size=${size}`);
  }
  return libraryUrl(asset);
}

const ratios = new Map<string, Promise<number | null>>();

/** A picture's own width ÷ height, read from its small file (and remembered). */
export function pictureRatio(asset: string): Promise<number | null> {
  let known = ratios.get(asset);
  if (!known) {
    known = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.naturalWidth > 0 && img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : null);
      img.onerror = () => resolve(null);
      img.src = assetSrc(asset, 'thumb');
    });
    ratios.set(asset, known);
    // A picture that couldn't be read may load later (it was still uploading).
    void known.then((r) => r === null && ratios.delete(asset));
  }
  return known;
}

async function encode(bitmap: ImageBitmap, maxEdge: number): Promise<{ blob: Blob; width: number; height: number }> {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D canvas');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  const toBlob = (type: string, quality: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  let blob = await toBlob('image/webp', 0.86);
  if (!blob || blob.type !== 'image/webp') blob = await toBlob('image/jpeg', 0.88);
  if (!blob) throw new Error('Could not encode the photo');
  return { blob, width, height };
}

export async function preparePhoto(file: Blob): Promise<{ full: Blob; thumb: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const full = await encode(bitmap, MAX_EDGE);
    const thumb = await encode(bitmap, THUMB_EDGE);
    return { full: full.blob, thumb: thumb.blob, width: full.width, height: full.height };
  } finally {
    bitmap.close();
  }
}

/** Prepares a photo, keeps it on this device, and queues the upload. */
export async function addPhoto(file: File | Blob): Promise<{ asset: string; width: number; height: number }> {
  const prepared = await preparePhoto(file);
  const id = ulid();
  localUrls.set(id, { full: URL.createObjectURL(prepared.full), thumb: URL.createObjectURL(prepared.thumb) });
  freshPhotos.add(id);
  const item: OutboxItem = { id, kind: 'photo', ...prepared, name: file instanceof File ? file.name.slice(0, 200) : 'photo', createdAt: Date.now() };
  await idbPut('outbox', id, item).catch(() => undefined);
  void pumpUploads();
  return { asset: `user:${id}`, width: prepared.width, height: prepared.height };
}

let pumping: Promise<void> | null = null;
let retry = 0;

export function pumpUploads(): Promise<void> {
  pumping ??= (async () => {
    try {
      const items = await idbAll<OutboxItem>('outbox').catch(() => [] as OutboxItem[]);
      for (const item of items.sort((a, b) => a.createdAt - b.createdAt)) {
        const form = new FormData();
        form.set('id', item.id);
        form.set('kind', item.kind);
        form.set('file', item.full, item.full.type === 'image/webp' ? 'photo.webp' : 'photo.jpg');
        form.set('thumb', item.thumb, item.thumb.type === 'image/webp' ? 'thumb.webp' : 'thumb.jpg');
        try {
          await api('POST', 'assets', form);
          await idbDelete('outbox', item.id);
        } catch (e) {
          if (isOffline(e) || (e instanceof ApiError && (e.code === 'unauthenticated' || e.code === 'locked' || e.code === 'rate_limited'))) {
            window.clearTimeout(retry);
            retry = window.setTimeout(() => void pumpUploads(), 15_000);
            return;
          }
          // The server refused this file for good (type, size, storage).
          await idbDelete('outbox', item.id);
          const code = e instanceof ApiError ? e.code : '';
          toast(code === 'storage_full' ? t.errors.storageFull : code === 'too_large' ? t.errors.tooLarge : t.tools.photoFailed, 'warn');
        }
      }
    } finally {
      pumping = null;
    }
  })();
  return pumping;
}

/** On start: show queued photos from this device and send them. */
export async function restoreOutbox(): Promise<void> {
  const items = await idbAll<OutboxItem>('outbox').catch(() => [] as OutboxItem[]);
  for (const item of items) {
    if (!localUrls.has(item.id)) localUrls.set(item.id, { full: URL.createObjectURL(item.full), thumb: URL.createObjectURL(item.thumb) });
  }
  if (items.length) void pumpUploads();
  window.addEventListener('online', () => void pumpUploads());
}

export interface AssetInfo {
  id: string;
  kind: string;
  mime: string;
  width: number | null;
  height: number | null;
  bytes: number;
  createdAt: string;
}

export const listPhotos = () => api<{ assets: AssetInfo[] }>('GET', 'assets?kind=photo').then((r) => r.assets);
