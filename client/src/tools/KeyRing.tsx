import { useState } from 'react';
import { api, ApiError } from '../data/api';
import { formatBytes, relativeTime, useUsers, type AdminUser } from '../data/queries';
import { t } from '../strings/en';
import { toast } from '../ui/toastStore';
import { Panel } from '../ui/Panel';
import s from './tools.module.css';

const WORDS = ['honey', 'maple', 'cocoa', 'acorn', 'meadow', 'teacup', 'lantern', 'pebble', 'willow', 'biscuit', 'thistle', 'clover', 'velvet', 'saffron', 'harbor', 'juniper'];

/** A friendly temporary password: three words and a number. */
export function makeTempPassword(): string {
  const pick = () => WORDS[crypto.getRandomValues(new Uint32Array(1))[0]! % WORDS.length];
  const n = crypto.getRandomValues(new Uint32Array(1))[0]! % 90 + 10;
  return `${pick()}-${pick()}-${pick()}-${n}`;
}

const LIMITS: { label: string; bytes: number | null }[] = [
  { label: t.keyring.noLimit, bytes: null },
  { label: '500 MB', bytes: 500 * 1024 * 1024 },
  { label: '1 GB', bytes: 1024 * 1024 * 1024 },
  { label: '5 GB', bytes: 5 * 1024 * 1024 * 1024 },
];

/** The admin's board of keys: one tagged key per person. */
export function KeyRing({ onClose, x, y, myId }: { onClose(): void; x: number; y: number; myId: number }) {
  const users = useUsers();
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  return (
    <Panel title={t.keyring.title} x={x} y={y} width={1100} height={860} from="top" variant="kraft" onClose={onClose} className={s.keyBoard}>
      <p className={s.hint}>{t.keyring.intro}</p>
      <div className={s.hooks}>
        {users.data?.map((u, i) => (
          <KeyTag key={u.id} user={u} me={u.id === myId} tilt={i % 2 ? 3 : -3} open={open === u.id} onToggle={() => setOpen(open === u.id ? null : u.id)} onChanged={() => void users.refetch()} />
        ))}
        <button type="button" className={s.newKey} onClick={() => setAdding(true)} aria-expanded={adding}>
          <svg viewBox="0 0 64 120" aria-hidden="true">
            <circle cx="32" cy="22" r="16" fill="none" stroke="#b08a4a" strokeWidth="5" strokeDasharray="6 5" />
            <path d="M32 38v62M32 80h12M32 92h9" fill="none" stroke="#b08a4a" strokeWidth="5" strokeDasharray="6 5" strokeLinecap="round" />
          </svg>
          {t.keyring.add}
        </button>
      </div>
      {adding && <AddPerson onDone={() => { setAdding(false); void users.refetch(); }} />}
    </Panel>
  );
}

function KeyTag({ user, me, tilt, open, onToggle, onChanged }: { user: AdminUser; me: boolean; tilt: number; open: boolean; onToggle(): void; onChanged(): void }) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const run = async (fn: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    try {
      await fn();
      if (done) toast(done, 'done');
      onChanged();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : t.errors.generic, 'warn');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={s.keyHook} style={{ rotate: `${tilt}deg` }}>
      <button type="button" className={s.key} onClick={onToggle} aria-expanded={open} data-off={user.active ? undefined : ''}>
        <svg viewBox="0 0 64 120" aria-hidden="true">
          <defs>
            <linearGradient id={`brass-${user.id}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fae2a2" />
              <stop offset="0.5" stopColor="#d0a456" />
              <stop offset="1" stopColor="#86602a" />
            </linearGradient>
          </defs>
          <path d="M32 6a16 16 0 110 32 16 16 0 010-32zm0 8a8 8 0 100 16 8 8 0 000-16z" fill={`url(#brass-${user.id})`} stroke="#6f4d1c" strokeWidth="1.5" fillRule="evenodd" />
          <rect x="28" y="36" width="8" height="66" rx="3" fill={`url(#brass-${user.id})`} stroke="#6f4d1c" strokeWidth="1.5" />
          <path d="M36 80h10v6H36zM36 92h7v6h-7z" fill={`url(#brass-${user.id})`} stroke="#6f4d1c" strokeWidth="1.2" />
        </svg>
        <span className={s.keyLabel}>
          <strong>{user.displayName}</strong>
          <small>
            @{user.username}
            {user.role === 'admin' ? ` · ${t.keyring.admin}` : ''}
            {me ? ` · ${t.keyring.you}` : ''}
            {!user.active ? ` · ${t.keyring.off}` : ''}
          </small>
          <small>{user.lastLoginAt ? t.keyring.lastSignIn(relativeTime(user.lastLoginAt)) : t.keyring.never}</small>
          <small>{t.keyring.storageUsed(formatBytes(user.storageUsedBytes))}</small>
        </span>
      </button>
      {open && (
        <div className={s.keyActions}>
          <button type="button" className={s.chip} disabled={busy} onClick={() => {
            const pw = makeTempPassword();
            void run(() => api('POST', `admin/users/${user.id}/password`, { password: pw }), `${t.keyring.resetDone} ${pw}`);
          }}>
            {t.keyring.resetPassword}
          </button>
          <button type="button" className={s.chip} disabled={busy} onClick={() => void run(() => api('POST', `admin/users/${user.id}/signout`), t.keyring.signedOut)}>
            {t.keyring.signOutEverywhere}
          </button>
          {!me && (
            <button type="button" className={s.chip} disabled={busy} onClick={() => void run(() => api('PATCH', `admin/users/${user.id}`, { active: !user.active }))}>
              {user.active ? t.keyring.turnOff : t.keyring.turnOn}
            </button>
          )}
          {!me && (
            <button type="button" className={s.chip} disabled={busy} onClick={() => void run(() => api('PATCH', `admin/users/${user.id}`, { role: user.role === 'admin' ? 'member' : 'admin' }))}>
              {user.role === 'admin' ? t.keyring.makeMember : t.keyring.makeAdmin}
            </button>
          )}
          <label className={s.inline}>
            {t.keyring.storageLimit}
            <select
              value={String(user.storageLimitBytes ?? '')}
              onChange={(e) => void run(() => api('PATCH', `admin/users/${user.id}`, { storageLimitBytes: e.target.value ? Number(e.target.value) : null }))}
            >
              {LIMITS.map((l) => (
                <option key={l.label} value={l.bytes === null ? '' : String(l.bytes)}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          {!me &&
            (deleting ? (
              <div className={s.warnNote}>
                <p>{t.keyring.deleteWarning(user.displayName)}</p>
                <label>
                  {t.keyring.typeToConfirm(user.username)}
                  <input className={s.lineInput} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
                </label>
                <button
                  type="button"
                  className={s.dangerStamp}
                  disabled={busy || confirm !== user.username}
                  onClick={() => void run(() => api('DELETE', `admin/users/${user.id}`, { confirm }), t.keyring.deleted)}
                >
                  {t.keyring.deleteAccount}
                </button>
              </div>
            ) : (
              <button type="button" className={s.linkButton} onClick={() => setDeleting(true)}>
                {t.keyring.deleteAccount}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

function AddPerson({ onDone }: { onDone(): void }) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState(makeTempPassword);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api('POST', 'admin/users', { username: username.trim(), displayName: displayName.trim() || username.trim(), password });
      toast(`${t.keyring.created(displayName || username)} ${t.keyring.tempPassword}: ${password}`, 'done', undefined, 15000);
      onDone();
    } catch (e) {
      const fields = e instanceof ApiError ? (e.body.error as { fields?: Record<string, string> } | undefined)?.fields : undefined;
      setError(fields?.username === 'taken' ? t.setup.taken : fields?.username ? t.setup.invalidUsername : fields?.password ? t.password.weak : t.errors.generic);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      className={s.addCard}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <label>
        {t.keyring.username}
        <input className={s.lineInput} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} required />
      </label>
      <label>
        {t.keyring.displayName}
        <input className={s.lineInput} value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="off" />
      </label>
      <label>
        {t.keyring.tempPassword}
        <span className={s.row}>
          <input className={s.lineInput} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" spellCheck={false} />
          <button type="button" className={s.chip} onClick={() => setPassword(makeTempPassword())}>
            {t.keyring.generate}
          </button>
        </span>
        <small>{t.keyring.tempHint}</small>
      </label>
      {error && <p className={s.error}>{error}</p>}
      <button type="submit" className={s.stampButton} disabled={busy || username.trim().length < 3 || password.length < 10}>
        {t.keyring.create}
      </button>
    </form>
  );
}
