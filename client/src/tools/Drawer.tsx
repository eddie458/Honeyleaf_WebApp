import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, apiUrl } from '../data/api';
import { useBook } from '../data/bookStore';
import { relativeTime, useDevices, useSaveSettings, useSettings, type Settings } from '../data/queries';
import { importBackup } from '../data/importer';
import { flushAll } from '../data/sync';
import { t } from '../strings/en';
import { toast } from '../ui/toastStore';
import { useMotionSetting } from '../ui/motion';
import { Panel } from '../ui/Panel';
import { ChangePasswordCard } from '../auth/ChangePassword';
import s from './tools.module.css';

type Section = 'settings' | 'backups' | 'privacy' | 'devices';
const LOCK_CHOICES = [5, 15, 30, 60, 120];

/** The desk drawer: settings, backups, privacy and devices, on index-card dividers. */
export function Drawer({ onClose, x, y }: { onClose(): void; x: number; y: number }) {
  const [section, setSection] = useState<Section>('settings');
  const tabs: { id: Section; label: string }[] = [
    { id: 'settings', label: t.drawer.settings },
    { id: 'backups', label: t.drawer.backups },
    { id: 'privacy', label: t.drawer.privacy },
    { id: 'devices', label: t.drawer.devices },
  ];
  return (
    <Panel title={t.tools.drawer} x={x} y={y} width={520} height={760} from="right" variant="kraft" tilt={-0.8} onClose={onClose}>
      <div className={s.dividers} role="tablist">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" role="tab" aria-selected={section === tab.id} className={s.divider} onClick={() => setSection(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>
      <div className={s.drawerCard} role="tabpanel">
        {section === 'settings' && <SettingsSection />}
        {section === 'backups' && <BackupsSection />}
        {section === 'privacy' && (
          <div className={s.privacy}>
            {t.drawer.privacyNote.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        )}
        {section === 'devices' && <DevicesSection />}
      </div>
    </Panel>
  );
}

function SettingsSection() {
  const settings = useSettings();
  const save = useSaveSettings();
  const setMotion = useMotionSetting((st) => st.set);
  const [password, setPassword] = useState(false);
  const data: Settings = settings.data ?? {};
  const update = (patch: Settings) => save.mutate(patch);
  return (
    <div className={s.settings}>
      <fieldset className={s.field}>
        <legend>{t.drawer.lockAfter}</legend>
        <div className={s.chips}>
          {LOCK_CHOICES.map((m) => (
            <button key={m} type="button" className={s.chip} aria-pressed={(data.lockMinutes ?? 15) === m} onClick={() => update({ lockMinutes: m })}>
              {t.drawer.minutes(m)}
            </button>
          ))}
        </div>
      </fieldset>
      <label className={s.check}>
        <input
          type="checkbox"
          checked={Boolean(data.readableFont)}
          onChange={(e) => {
            update({ readableFont: e.target.checked });
            document.documentElement.dataset.readable = e.target.checked ? 'on' : 'off';
          }}
        />
        <span className={s.box} aria-hidden="true" />
        {t.drawer.readableFont}
      </label>
      <label className={s.check}>
        <input type="checkbox" checked={data.spellcheck !== false} onChange={(e) => update({ spellcheck: e.target.checked })} />
        <span className={s.box} aria-hidden="true" />
        {t.drawer.spellcheck}
      </label>
      <fieldset className={s.field}>
        <legend>{t.drawer.reducedMotion}</legend>
        <div className={s.chips}>
          {(['auto', 'on', 'off'] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={s.chip}
              aria-pressed={(data.motion ?? 'auto') === m}
              onClick={() => {
                update({ motion: m });
                setMotion(m);
              }}
            >
              {t.drawer.motion[m]}
            </button>
          ))}
        </div>
      </fieldset>
      {password ? <ChangePasswordCard own onDone={() => setPassword(false)} /> : (
        <button type="button" className={s.linkButton} onClick={() => setPassword(true)}>
          {t.drawer.changePassword}
        </button>
      )}
    </div>
  );
}

function BackupsSection() {
  const index = useBook((st) => st.index);
  const file = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const qc = useQueryClient();
  const years = [...new Set(index.map((e) => e.date.slice(0, 4)))].sort().reverse();
  const download = async (year?: string) => {
    await flushAll();
    window.location.href = apiUrl(year ? `export?year=${year}` : 'export');
  };
  const onImport = async (f: File | undefined) => {
    if (!f) return;
    try {
      const n = await importBackup(f, (done, total) => setProgress(t.drawer.importing(done, total)));
      setProgress(null);
      toast(t.drawer.imported(n), 'done');
      await qc.invalidateQueries();
    } catch {
      setProgress(null);
      toast(t.drawer.importFailed, 'warn');
    }
  };
  return (
    <div className={s.settings}>
      <p className={s.hint}>{t.drawer.exportHint}</p>
      <button type="button" className={s.stampButton} onClick={() => void download()}>
        {t.drawer.export}
      </button>
      {years.length > 1 && (
        <div className={s.chips}>
          {years.map((y) => (
            <button key={y} type="button" className={s.chip} onClick={() => void download(y)}>
              {t.drawer.exportYear(y)}
            </button>
          ))}
        </div>
      )}
      <hr className={s.rule} />
      <p className={s.hint}>{t.drawer.importHint}</p>
      <button type="button" className={s.stampButton} onClick={() => file.current?.click()} disabled={progress !== null}>
        {progress ?? t.drawer.import}
      </button>
      <input ref={file} type="file" accept=".zip,application/zip" hidden onChange={(e) => void onImport(e.target.files?.[0])} />
    </div>
  );
}

function DevicesSection() {
  const devices = useDevices();
  const revoke = async (id: string) => {
    await api('DELETE', `auth/sessions/${id}`);
    void devices.refetch();
  };
  return (
    <ul className={s.devices}>
      {devices.data?.map((d) => (
        <li key={d.id} className={s.deviceRow}>
          <span>
            <strong>{d.device}</strong>
            {d.current && <em> · {t.drawer.thisDevice}</em>}
            <br />
            <small>
              {t.drawer.lastSeen(relativeTime(d.lastSeenAt))}
              {d.remember ? ` · ${t.drawer.remembered}` : ''}
            </small>
          </span>
          {!d.current && (
            <button type="button" className={s.chip} onClick={() => void revoke(d.id)}>
              {t.drawer.signOutDevice}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
