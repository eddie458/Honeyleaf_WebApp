import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../data/api';
import { useBook } from '../data/bookStore';
import { useTrash, type TrashItem } from '../data/queries';
import { t } from '../strings/en';
import { toast } from '../ui/toastStore';
import { Panel } from '../ui/Panel';
import s from './tools.module.css';

const WHEN = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' });

/** Crumpled paper balls: smooth one out to restore it, or throw it away for good. */
export function Wastebasket({ onClose, x, y, onRestored }: { onClose(): void; x: number; y: number; onRestored(): void }) {
  const trash = useTrash();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<string | null>(null);
  const restore = async (item: TrashItem) => {
    await api('POST', 'trash/restore', { type: item.type, id: item.id });
    if (item.entryId) useBook.getState().dropEntry(item.entryId);
    if (item.type === 'entry') useBook.getState().dropEntry(item.id);
    toast(t.trash.restored, 'done');
    await qc.invalidateQueries({ queryKey: ['trash'] });
    onRestored();
  };
  const purge = async (item: TrashItem) => {
    await api('POST', 'trash/purge', { type: item.type, id: item.id });
    setConfirm(null);
    await qc.invalidateQueries({ queryKey: ['trash'] });
  };
  return (
    <Panel title={t.trash.title} x={x} y={y} width={500} height={640} from="right" variant="card" tilt={1} onClose={onClose}>
      {trash.data && trash.data.length === 0 && <p className={s.empty}>{t.trash.empty}</p>}
      <ul className={s.trashList}>
        {trash.data?.map((item) => (
          <li key={`${item.type}-${item.id}`} className={s.ball}>
            <span className={s.ballText}>
              <small>{t.trash.kinds[item.type]}</small>
              <strong>{item.label || item.date || '…'}</strong>
              <small>{t.trash.keptUntil(WHEN.format(new Date(item.purgeAt)))}</small>
            </span>
            <span className={s.row}>
              <button type="button" className={s.chip} onClick={() => void restore(item)}>
                {t.trash.restore}
              </button>
              {confirm === item.id ? (
                <button type="button" className={s.dangerStamp} onClick={() => void purge(item)}>
                  {t.trash.purgeConfirm}
                </button>
              ) : (
                <button type="button" className={s.linkButton} onClick={() => setConfirm(item.id)}>
                  {t.trash.purge}
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
