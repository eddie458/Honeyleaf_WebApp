import { useState } from 'react';
import { useBook } from '../data/bookStore';
import { fontFamily } from '../library/fonts';
import type { EntryHeader as Header } from '../model/types';
import { MoodIcon, Swash, WeatherIcon } from '../art/HandDrawn';
import { t } from '../strings/en';
import s from './EntryHeader.module.css';

const dateFormat = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });

/** Formats a calendar date (YYYY-MM-DD) the same way on every device. */
export function formatEntryDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return dateFormat.format(new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1, d ?? 1)));
}

const TITLE_INK = '#b5502f';

/** Date line, mood and weather, tiny paper tags and the lettered title. */
export function EntryHeader({ entryId, header, ink, editable }: { entryId?: string; header: Header; ink: string; editable?: boolean }) {
  const editEntry = useBook((st) => st.editEntry);
  const [draft, setDraft] = useState<string | null>(null);
  const title = draft ?? header.title ?? '';
  const commit = (value: string) => {
    setDraft(null);
    if (!entryId || value === (header.title ?? '')) return;
    editEntry(entryId, (e) => ({ header: { ...e.header, title: value.trim() ? value.slice(0, 120) : undefined } as Header }), 'title');
  };
  return (
    <header className={s.header}>
      <div className={s.dateLine}>
        <span className={s.date} style={{ fontFamily: `${fontFamily('caveat')}, cursive`, color: ink }}>
          {formatEntryDate(header.date)}
        </span>
        {header.mood && <MoodIcon className={s.icon} mood={header.mood} color={ink} />}
        {header.weather && <WeatherIcon className={s.icon} kind={header.weather} color={ink} />}
      </div>
      {header.tags.length > 0 && (
        <ul className={s.tags} aria-label="Tags">
          {header.tags.map((tag, i) => (
            <li key={tag} className={s.tag} style={{ rotate: `${i % 2 ? 7 : -5}deg` }}>
              <span className={s.hole} aria-hidden="true" />
              {tag}
            </li>
          ))}
        </ul>
      )}
      {editable ? (
        <input
          className={s.titleInput}
          style={{ fontFamily: `${fontFamily('dancing-script')}, cursive`, color: TITLE_INK }}
          value={title}
          placeholder={t.journal.titlePlaceholder}
          aria-label={t.journal.titleLabel}
          maxLength={120}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') {
              setDraft(null);
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
      ) : (
        title && (
          <h2 className={s.title} style={{ fontFamily: `${fontFamily('dancing-script')}, cursive` }}>
            <span className={s.titleText}>
              {title}
              <Swash className={s.swash} color={TITLE_INK} />
            </span>
          </h2>
        )
      )}
    </header>
  );
}
