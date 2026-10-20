import { useRef, useState } from 'react';
import { api, ApiError, NetworkError } from '../data/api';
import { refreshSession, type SessionUser } from '../data/queries';
import { t } from '../strings/en';
import { useReducedMotion } from '../ui/motion';
import { AuthDesk } from './AuthDesk';
import { ClosedJournal } from './ClosedJournal';
import s from './auth.module.css';

type View = 'login' | 'recover' | 'recovered';

/**
 * The diary, closed: the name goes on the paper tag, the password on the
 * slip under the padlock. The right key clicks the lock open, the strap pops
 * and the cover swings open onto your own diary.
 */
export function LoginScreen({ locked }: { locked?: SessionUser }) {
  const [view, setView] = useState<View>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [code, setCode] = useState('');
  const [newCode, setNewCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [jiggle, setJiggle] = useState(0);
  const [opening, setOpening] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const reduced = useReducedMotion();

  const fail = (e: unknown) => {
    setJiggle((j) => j + 1);
    if (e instanceof ApiError && e.code === 'rate_limited') {
      const secs = Number((e.body.error as { retryAfter?: number } | undefined)?.retryAfter ?? 60);
      setMessage(t.auth.rateLimited(Math.max(1, Math.ceil(secs / 60))));
    } else if (e instanceof NetworkError) setMessage(t.auth.serverDown);
    else setMessage(t.auth.wrong);
    setPassword('');
    passwordRef.current?.focus();
  };

  const open = async () => {
    setOpening(true);
    await new Promise((r) => setTimeout(r, reduced ? 120 : 1500));
    await refreshSession();
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      if (locked) await api('POST', 'auth/unlock', { password });
      else await api('POST', 'auth/login', { username: username.trim(), password, remember });
      await open();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const recover = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await api<{ recoveryCode: string }>('POST', 'auth/recover', { username: username.trim(), recoveryCode: code.trim(), next: password });
      setNewCode(res.recoveryCode);
      setView('recovered');
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const tag =
    view === 'recover' ? null : (
      <label className={s.tag}>
        <span className={s.tagHole} aria-hidden="true" />
        <span className={s.tagLabel}>{t.auth.usernameTag}</span>
        {locked ? (
          <span className={s.tagName}>{locked.displayName}</span>
        ) : (
          <input
            className={s.tagInput}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            onKeyDown={(e) => e.key === 'Enter' && passwordRef.current?.focus()}
          />
        )}
      </label>
    );

  const slip =
    view === 'recover' ? null : (
      <form
        className={s.slip}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label className={s.slipLabel}>
          {t.auth.passwordLock}
          <input ref={passwordRef} className={s.slipInput} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        <button type="submit" className={s.keyButton} disabled={busy || !password} aria-label={t.auth.unlock}>
          <svg viewBox="0 0 40 20" aria-hidden="true">
            <path d="M4 10a6 6 0 1012 0 6 6 0 00-12 0zm3 0a3 3 0 106 0 3 3 0 00-6 0z" fillRule="evenodd" />
            <path d="M16 8.5h20v3h-3v4h-3v-4h-3v3h-3v-3h-8z" />
          </svg>
          <span>{busy ? t.auth.unlocking : t.auth.unlock}</span>
        </button>
      </form>
    );

  return (
    <AuthDesk>
      <ClosedJournal state={opening ? 'opening' : 'shut'} jiggle={jiggle} tag={tag} slip={slip} />
      <div className={s.besideJournal}>
        {locked && (
          <div className={s.pencil}>
            <p className={s.pencilTitle}>{t.auth.lockedTitle}</p>
            <p>{t.auth.lockedHint(locked.displayName)}</p>
          </div>
        )}
        {message && (
          <p className={s.oopsNote} role="alert">
            {message}
          </p>
        )}
        {!locked && view === 'login' && (
          <label className={s.rememberNote}>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span className={s.box} aria-hidden="true" />
            {t.auth.remember}
          </label>
        )}
        {view === 'login' && <p className={s.pencilSmall}>{t.auth.forgot}</p>}
        {!locked && view === 'login' && (
          <button type="button" className={s.pencilLink} onClick={() => setView('recover')}>
            {t.auth.adminRecovery}
          </button>
        )}
        {locked && (
          <button
            type="button"
            className={s.pencilLink}
            onClick={() => void api('POST', 'auth/logout').finally(() => void refreshSession())}
          >
            {t.auth.signOutInstead}
          </button>
        )}
        {view === 'recover' && (
          <form
            className={s.note}
            onSubmit={(e) => {
              e.preventDefault();
              void recover();
            }}
          >
            <label className={s.lineLabel}>
              {t.auth.usernameTag}
              <input className={s.line} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
            </label>
            <label className={s.lineLabel}>
              {t.auth.recoveryCode}
              <input className={s.line} value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" spellCheck={false} required />
            </label>
            <label className={s.lineLabel}>
              {t.auth.newPassword}
              <input className={s.line} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={10} required />
            </label>
            <div className={s.noteActions}>
              <button type="submit" className={s.stamp} disabled={busy}>
                {t.auth.recover}
              </button>
              <button type="button" className={s.pencilLink} onClick={() => setView('login')}>
                {t.auth.back}
              </button>
            </div>
          </form>
        )}
        {view === 'recovered' && (
          <div className={s.note}>
            <p className={s.noteText}>{t.auth.recovered}</p>
            <p className={s.code}>{newCode}</p>
            <p className={s.noteText}>{t.auth.recoveredHint}</p>
            <button
              type="button"
              className={s.stamp}
              onClick={() => {
                setView('login');
                setPassword('');
              }}
            >
              {t.setup.codeSaved}
            </button>
          </div>
        )}
      </div>
    </AuthDesk>
  );
}
