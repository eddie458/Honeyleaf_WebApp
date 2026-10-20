import { useState } from 'react';
import { api, ApiError } from '../data/api';
import { refreshSession } from '../data/queries';
import { t } from '../strings/en';
import { toast } from '../ui/toastStore';
import s from './auth.module.css';

/** Choosing a password: the first sign-in note, or from the drawer. */
export function ChangePasswordCard({ own, onDone }: { own?: boolean; onDone?: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (next.length < 10) return setError(t.password.weak);
    if (next !== again) return setError(t.password.mismatch);
    setBusy(true);
    setError(null);
    try {
      await api('POST', 'auth/password', { current, next });
      toast(t.password.done, 'done');
      await refreshSession();
      onDone?.();
    } catch (e) {
      setError(e instanceof ApiError && (e.code === 'invalid_credentials' || e.code === 'validation') ? t.password.wrongCurrent : t.errors.generic);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      className={s.note}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {!own && <h2 className={s.noteTitle}>{t.password.title}</h2>}
      {!own && <p className={s.noteText}>{t.password.intro}</p>}
      <label className={s.lineLabel}>
        {own ? t.password.currentOwn : t.password.current}
        <input className={s.line} type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
      </label>
      <label className={s.lineLabel}>
        {t.password.next}
        <input className={s.line} type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required minLength={10} />
      </label>
      <label className={s.lineLabel}>
        {t.password.again}
        <input className={s.line} type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" required />
      </label>
      {error && <p className={s.oops}>{error}</p>}
      <button type="submit" className={s.stamp} disabled={busy}>
        {t.password.save}
      </button>
    </form>
  );
}
