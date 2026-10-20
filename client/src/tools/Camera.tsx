import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { addPhoto, assetSrc, listPhotos } from '../data/assets';
import { useBook } from '../data/bookStore';
import { addDecoration, markFresh, photoAt } from '../decor/decorate';
import { currentTarget, pageMiddle, type PageTarget } from '../journal/target';
import type { Point } from '../model/transform';
import { t } from '../strings/en';
import { toast } from '../ui/toastStore';
import { Panel } from '../ui/Panel';
import s from './tools.module.css';

/** Adds photos to a page as instant prints; each one develops as it lands. */
export async function addPhotosToPage(files: Iterable<File>, at?: PageTarget & { point: Point }): Promise<void> {
  const target = at ?? { ...(await currentTarget()), point: pageMiddle() };
  if (useBook.getState().mode !== 'decorate') useBook.getState().setMode('decorate');
  let k = 0;
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    try {
      const photo = await addPhoto(file);
      const p = { x: target.point.x + k * 26, y: target.point.y + k * 30 };
      const id = addDecoration(target.entryId, target.pageId, photoAt(photo.asset, p));
      markFresh(id);
      k++;
    } catch {
      toast(t.tools.photoFailed, 'warn');
    }
  }
}

export function Camera({ onClose, x, y }: { onClose(): void; x: number; y: number }) {
  const choose = useRef<HTMLInputElement>(null);
  const take = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const prints = useQuery({ queryKey: ['photos'], queryFn: listPhotos });
  const onFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    await addPhotosToPage(Array.from(list));
    setBusy(false);
    void prints.refetch();
  };
  const reuse = async (id: string) => {
    const target = await currentTarget();
    if (useBook.getState().mode !== 'decorate') useBook.getState().setMode('decorate');
    const deco = addDecoration(target.entryId, target.pageId, photoAt(`user:${id}`, pageMiddle()));
    markFresh(deco);
  };
  return (
    <Panel title={t.tools.camera} x={x} y={y} width={460} height={620} from="right" variant="kraft" tilt={1.2} onClose={onClose}>
      <div className={s.cameraButtons}>
        <button type="button" className={s.stampButton} onClick={() => choose.current?.click()} disabled={busy}>
          {busy ? t.tools.uploading : t.tools.choosePhotos}
        </button>
        <button type="button" className={s.stampButton} onClick={() => take.current?.click()} disabled={busy}>
          {t.tools.takePhoto}
        </button>
        <input ref={choose} type="file" accept="image/*" multiple hidden onChange={(e) => void onFiles(e.target.files)} />
        <input ref={take} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void onFiles(e.target.files)} />
      </div>
      <p className={s.hint}>{t.tools.dropHere}</p>
      <h3 className={s.subhead}>{t.tools.shoebox}</h3>
      {prints.data && prints.data.length > 0 ? (
        <div className={s.prints}>
          {prints.data.map((a) => (
            <button key={a.id} type="button" className={s.print} onClick={() => void reuse(a.id)} aria-label={t.decor.photo}>
              <img src={assetSrc(`user:${a.id}`, 'thumb')} alt="" loading="lazy" draggable={false} />
            </button>
          ))}
        </div>
      ) : (
        <p className={s.empty}>{t.tools.noPrints}</p>
      )}
    </Panel>
  );
}
