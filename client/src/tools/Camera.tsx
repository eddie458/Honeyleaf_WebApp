import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { addPhoto, assetSrc, listPhotos } from '../data/assets';
import { useBook } from '../data/bookStore';
import { queryClient, useSaveSettings, useSettings, type Settings } from '../data/queries';
import { addDecoration, markFresh, photoAt } from '../decor/decorate';
import { FrameIcon } from '../decor/FrameIcon';
import { currentTarget, pageMiddle, type PageTarget } from '../journal/target';
import { PHOTO_FRAMES } from '../model/photo';
import type { Point } from '../model/transform';
import type { PhotoFrame } from '../model/types';
import { t } from '../strings/en';
import { toast } from '../ui/toastStore';
import { Panel } from '../ui/Panel';
import s from './tools.module.css';

/** The print style new photos come out in (chosen on the camera, kept in settings). */
function printStyle(): PhotoFrame {
  const chosen = queryClient.getQueryData<Settings>(['settings'])?.photoFrame;
  return PHOTO_FRAMES.find((f) => f === chosen) ?? 'instant';
}

/** Adds photos to a page as prints; each one develops as it lands. */
export async function addPhotosToPage(files: Iterable<File>, at?: PageTarget & { point: Point }): Promise<void> {
  const target = at ?? { ...(await currentTarget()), point: pageMiddle() };
  if (useBook.getState().mode !== 'decorate') useBook.getState().setMode('decorate');
  let k = 0;
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    try {
      const photo = await addPhoto(file);
      const p = { x: target.point.x + k * 26, y: target.point.y + k * 30 };
      const id = addDecoration(target.entryId, target.pageId, photoAt(photo.asset, p, printStyle(), photo.width / photo.height));
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
  const settings = useSettings();
  const saveSettings = useSaveSettings();
  const chosen = settings.data?.photoFrame;
  const style = PHOTO_FRAMES.find((f) => f === chosen) ?? 'instant';
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
    const info = prints.data?.find((a) => a.id === id);
    const ratio = info?.width && info.height ? info.width / info.height : undefined;
    const deco = addDecoration(target.entryId, target.pageId, photoAt(`user:${id}`, pageMiddle(), style, ratio));
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
      <h3 className={s.subhead}>{t.tools.printStyle}</h3>
      <div className={s.printStyles} role="radiogroup" aria-label={t.tools.printStyle}>
        {PHOTO_FRAMES.map((f) => (
          <button key={f} type="button" role="radio" aria-checked={style === f} className={s.printStyle} onClick={() => saveSettings.mutate({ photoFrame: f })} title={t.decor.frames[f]}>
            <FrameIcon frame={f} />
            <span>{t.tools.frameShort[f]}</span>
          </button>
        ))}
      </div>
      <p className={s.smallHint}>{t.tools.printStyleHint}</p>
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
