import { api } from '../data/api';
import { useBook } from '../data/bookStore';
import { refreshSession } from '../data/queries';
import { flushAll } from '../data/sync';
import { t } from '../strings/en';
import { Panel } from '../ui/Panel';
import s from './tools.module.css';

export async function lockNow(): Promise<void> {
  await flushAll().catch(() => undefined);
  await api('POST', 'auth/lock').catch(() => undefined);
  await refreshSession();
}

export async function signOut(): Promise<void> {
  await flushAll().catch(() => undefined);
  await api('POST', 'auth/logout').catch(() => undefined);
  await refreshSession();
}

export function Padlock({ onClose, x, y }: { onClose(): void; x: number; y: number }) {
  const owner = useBook((st) => st.ownerName);
  return (
    <Panel title={t.padlock.title} x={x} y={y} width={400} from="bottom" variant="card" tilt={1.5} onClose={onClose}>
      <p className={s.hint}>{t.padlock.signedInAs(owner)}</p>
      <div className={s.stack}>
        <button type="button" className={s.stampButton} onClick={() => void lockNow()}>
          {t.padlock.lockNow}
        </button>
        <button type="button" className={s.linkButton} onClick={() => void signOut()}>
          {t.padlock.signOut}
        </button>
      </div>
    </Panel>
  );
}
