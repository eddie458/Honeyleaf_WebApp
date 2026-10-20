import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../data/api';
import { refreshSession } from '../data/queries';
import { t } from '../strings/en';
import { AuthDesk } from './AuthDesk';
import { ClosedJournal, Wordmark } from './ClosedJournal';
import s from './auth.module.css';

interface Check {
  php: { version: string; ok: boolean };
  extensions: { name: string; ok: boolean; required: boolean }[];
  privateDir: { outsideWebRoot: boolean; writable: boolean };
  uploads: { writable: boolean };
  https: boolean;
  config: { found: boolean; setupKeySet: boolean };
  db: { connected: boolean; tablesReady: boolean; error: string | null };
}

type Step = 'checks' | 'admin' | 'code' | 'done';

/** First run: check the server, make the first key (yours), switch itself off. */
export function SetupWizard() {
  const [step, setStep] = useState<Step>('checks');
  const [code, setCode] = useState('');
  return (
    <AuthDesk>
      <ClosedJournal state="plain" />
      <div className={s.besideJournal}>
        <div className={s.pencil}>
          <Wordmark small />
        </div>
        {step === 'checks' && <Checks onReady={() => setStep('admin')} />}
        {step === 'admin' && (
          <MakeAdmin
            onMade={(c) => {
              setCode(c);
              setStep('code');
            }}
          />
        )}
        {step === 'code' && (
          <div className={s.note}>
            <h2 className={s.noteTitle}>{t.setup.codeTitle}</h2>
            <p className={s.noteText}>{t.setup.codeHint}</p>
            <p className={s.code}>{code}</p>
            <button type="button" className={s.stamp} onClick={() => setStep('done')}>
              {t.setup.codeSaved}
            </button>
          </div>
        )}
        {step === 'done' && (
          <div className={s.note}>
            <span className={s.doneStamp}>done!</span>
            <h2 className={s.noteTitle}>{t.setup.doneTitle}</h2>
            <p className={s.noteText}>{t.setup.doneHint}</p>
            <button type="button" className={s.stamp} onClick={() => void refreshSession()}>
              {t.setup.open}
            </button>
          </div>
        )}
      </div>
    </AuthDesk>
  );
}

function Mark({ ok }: { ok: boolean }) {
  return (
    <svg className={s.checkMark} viewBox="0 0 24 24" aria-hidden="true">
      {ok ? (
        <path d="M5 13c2 1.6 3.4 3.4 4.6 5.4C12.6 12.2 16 7.6 21 3.6" fill="none" stroke="#5f8a4e" strokeWidth="2.6" strokeLinecap="round" />
      ) : (
        <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="#b23a2a" strokeWidth="2.6" strokeLinecap="round" />
      )}
    </svg>
  );
}

function Checks({ onReady }: { onReady(): void }) {
  const check = useQuery({ queryKey: ['setup-check'], queryFn: () => api<Check>('GET', 'setup/check'), retry: 0 });
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const c = check.data;
  if (check.isLoading) return <p className={s.pencil}>{t.setup.checking}</p>;
  if (!c) {
    return (
      <div className={s.note}>
        <p className={s.noteText}>{t.auth.serverDown}</p>
        <button type="button" className={s.stamp} onClick={() => void check.refetch()}>
          {t.setup.recheck}
        </button>
      </div>
    );
  }
  const required = c.extensions.filter((x) => x.required);
  const blockers = !c.php.ok || required.some((x) => !x.ok) || !c.config.found || !c.config.setupKeySet || !c.db.connected || !c.uploads.writable;
  const createTables = async () => {
    setBusy(true);
    setError(null);
    try {
      await api('POST', 'setup/install-schema', { setupKey: key });
      await check.refetch();
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'bad_setup_key' ? t.setup.badKey : t.errors.generic);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={s.note}>
      <h2 className={s.noteTitle}>{t.setup.title}</h2>
      <p className={s.noteText}>{t.setup.intro}</p>
      <ul className={s.checks}>
        <li className={s.check}>
          <Mark ok={c.php.ok} />
          <span>
            {t.setup.php(c.php.version)}
            {!c.php.ok && <span className={s.fix}>{t.setup.phpOld}</span>}
          </span>
        </li>
        {c.extensions.map((x) => (
          <li key={x.name} className={s.check}>
            <Mark ok={x.ok || !x.required} />
            <span>
              {t.setup.ext(x.name)}
              {!x.ok && x.required && <span className={s.fix}>{t.setup.extMissing}</span>}
            </span>
          </li>
        ))}
        <li className={s.check}>
          <Mark ok={c.privateDir.outsideWebRoot} />
          <span>{c.privateDir.outsideWebRoot ? t.setup.privateOk : <span className={s.fix}>{t.setup.privateInside}</span>}</span>
        </li>
        <li className={s.check}>
          <Mark ok={c.uploads.writable} />
          <span>
            {t.setup.uploads}
            {!c.uploads.writable && <span className={s.fix}>{t.setup.uploadsFix}</span>}
          </span>
        </li>
        <li className={s.check}>
          <Mark ok={c.https} />
          <span>
            {t.setup.https}
            {!c.https && <span className={s.fix}>{t.setup.httpsFix}</span>}
          </span>
        </li>
        <li className={s.check}>
          <Mark ok={c.config.found} />
          <span>
            {t.setup.config}
            {!c.config.found && <span className={s.fix}>{t.setup.configFix}</span>}
          </span>
        </li>
        <li className={s.check}>
          <Mark ok={c.config.setupKeySet} />
          <span>
            {t.setup.setupKey}
            {!c.config.setupKeySet && <span className={s.fix}>{t.setup.setupKeyFix}</span>}
          </span>
        </li>
        <li className={s.check}>
          <Mark ok={c.db.connected} />
          <span>
            {t.setup.db}
            {!c.db.connected && <span className={s.fix}>{t.setup.dbFix}</span>}
          </span>
        </li>
        {c.db.connected && (
          <li className={s.check}>
            <Mark ok={c.db.tablesReady} />
            <span>
              {t.setup.tables}
              {!c.db.tablesReady && <span className={s.fix}>{t.setup.tablesFix}</span>}
            </span>
          </li>
        )}
      </ul>
      {c.db.connected && !c.db.tablesReady && c.config.setupKeySet && (
        <>
          <label className={s.lineLabel}>
            {t.setup.keyTitle}
            <input className={s.line} type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" />
          </label>
          {error && <p className={s.oops}>{error}</p>}
          <button type="button" className={s.stamp} disabled={busy || !key} onClick={() => void createTables()}>
            {t.setup.createTables}
          </button>
        </>
      )}
      <div className={s.noteActions}>
        <button type="button" className={s.stamp} disabled={blockers || !c.db.tablesReady} onClick={onReady}>
          {t.setup.adminTitle}
        </button>
        <button type="button" className={s.pencilLinkDark} onClick={() => void check.refetch()}>
          {t.setup.recheck}
        </button>
      </div>
    </div>
  );
}

function MakeAdmin({ onMade }: { onMade(code: string): void }) {
  const [setupKey, setSetupKey] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (password.length < 10) return setError(t.password.weak);
    if (password !== again) return setError(t.password.mismatch);
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ recoveryCode: string }>('POST', 'setup/admin', { setupKey, username: username.trim(), displayName: displayName.trim() || username.trim(), password });
      onMade(res.recoveryCode);
    } catch (e) {
      const fields = e instanceof ApiError ? (e.body.error as { fields?: Record<string, string> } | undefined)?.fields : undefined;
      if (e instanceof ApiError && e.code === 'bad_setup_key') setError(t.setup.badKey);
      else if (fields?.username) setError(t.setup.invalidUsername);
      else if (fields?.password) setError(t.password.weak);
      else setError(t.errors.generic);
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
      <h2 className={s.noteTitle}>{t.setup.adminTitle}</h2>
      <p className={s.noteText}>{t.setup.adminHint}</p>
      <label className={s.lineLabel}>
        {t.setup.keyTitle}
        <input className={s.line} type="password" value={setupKey} onChange={(e) => setSetupKey(e.target.value)} autoComplete="off" required />
      </label>
      <label className={s.lineLabel}>
        {t.setup.username}
        <input className={s.line} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={32} />
      </label>
      <label className={s.lineLabel}>
        {t.setup.displayName}
        <input className={s.line} value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" />
      </label>
      <label className={s.lineLabel}>
        {t.setup.password}
        <input className={s.line} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={10} />
      </label>
      <label className={s.lineLabel}>
        {t.setup.passwordAgain}
        <input className={s.line} type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" required />
      </label>
      {error && <p className={s.oops}>{error}</p>}
      <button type="submit" className={s.stamp} disabled={busy}>
        {t.setup.makeKey}
      </button>
    </form>
  );
}
