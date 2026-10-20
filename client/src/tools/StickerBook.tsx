import { useState, type PointerEvent as RPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { libraryUrl } from '../library/library';
import { useLibrary, type StickerEntry } from '../library/useLibrary';
import { addDecoration, markFresh, stickerAt } from '../decor/decorate';
import { currentTarget, pageAt, pageMiddle } from '../journal/target';
import { useBook } from '../data/bookStore';
import { t } from '../strings/en';
import { Panel } from '../ui/Panel';
import s from './StickerBook.module.css';

interface Drag {
  sticker: StickerEntry;
  pack: string;
  x: number;
  y: number;
  moved: boolean;
}

/** The sticker book opens beside the journal: sheets of stickers, one pack per tab. */
export function StickerBook({ onClose, x, y }: { onClose(): void; x: number; y: number }) {
  const packs = useLibrary((st) => st.stickerPacks);
  const [packId, setPackId] = useState(packs[0]?.id ?? '');
  const [drag, setDrag] = useState<Drag | null>(null);
  const pack = packs.find((p) => p.id === packId) ?? packs[0];

  const place = async (sticker: StickerEntry, packName: string, clientX?: number, clientY?: number) => {
    const asset = `${packName}/${sticker.id}`;
    const dropped = clientX !== undefined && clientY !== undefined ? await pageAt(clientX, clientY) : null;
    const target = dropped ?? { ...(await currentTarget()), point: pageMiddle() };
    if (useBook.getState().mode !== 'decorate') useBook.getState().setMode('decorate');
    const id = addDecoration(target.entryId, target.pageId, stickerAt(asset, sticker.size, target.point));
    markFresh(id);
  };

  const down = (sticker: StickerEntry, packName: string) => (e: RPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    let current: Drag = { sticker, pack: packName, x: startX, y: startY, moved: false };
    setDrag(current);
    const move = (ev: PointerEvent) => {
      const moved = current.moved || Math.hypot(ev.clientX - startX, ev.clientY - startY) > 8;
      current = { ...current, x: ev.clientX, y: ev.clientY, moved };
      setDrag(current);
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      setDrag(null);
      if (ev.type === 'pointercancel') return;
      void (current.moved ? place(sticker, packName, ev.clientX, ev.clientY) : place(sticker, packName));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  return (
    <>
      <Panel title={t.tools.stickerBook} x={x} y={y} width={660} height={560} from="right" variant="kraft" tilt={-1.5} onClose={onClose}>
        <div className={s.tabs} role="tablist">
          {packs.map((p) => (
            <button key={p.id} type="button" role="tab" aria-selected={p.id === pack?.id} className={s.tab} onClick={() => setPackId(p.id)}>
              {p.name}
            </button>
          ))}
        </div>
        <p className={s.hint}>{t.tools.stickerHint}</p>
        {pack && (
          <div className={s.sheet} role="tabpanel" aria-label={pack.name}>
            {pack.stickers.map((st) => (
              <button
                key={st.id}
                type="button"
                className={s.sticker}
                aria-label={st.name}
                title={st.name}
                onPointerDown={down(st, pack.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    void place(st, pack.id);
                  }
                }}
              >
                <img src={libraryUrl(`stickers/${pack.id}/${st.id}.svg`)} alt="" draggable={false} />
              </button>
            ))}
          </div>
        )}
      </Panel>
      {drag?.moved &&
        createPortal(
          <img className={s.ghost} src={libraryUrl(`stickers/${drag.pack}/${drag.sticker.id}.svg`)} alt="" style={{ left: drag.x, top: drag.y }} />,
          document.body,
        )}
    </>
  );
}
