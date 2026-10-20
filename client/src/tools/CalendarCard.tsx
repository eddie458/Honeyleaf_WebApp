import { useMemo, useState } from 'react';
import { useBook } from '../data/bookStore';
import { datesWithEntries, localDate } from '../model/book';
import { openDate } from '../journal/entries';
import { t } from '../strings/en';
import { Panel } from '../ui/Panel';
import s from './tools.module.css';

const MONTH = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const LONG = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** A month on a tear-off pad: days you wrote are marked; tap one to go there. */
export function CalendarCard({ onClose, x, y }: { onClose(): void; x: number; y: number }) {
  const index = useBook((st) => st.index);
  const today = localDate();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [picked, setPicked] = useState<string | null>(null);
  const marked = useMemo(() => datesWithEntries(index), [index]);
  const [yy, mm] = month.split('-').map(Number) as [number, number];
  const first = new Date(Date.UTC(yy, mm - 1, 1));
  const daysIn = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  const lead = first.getUTCDay();
  const shift = (d: number) => {
    const n = new Date(Date.UTC(yy, mm - 1 + d, 1));
    setMonth(`${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, '0')}`);
    setPicked(null);
  };
  const iso = (d: number) => `${month}-${String(d).padStart(2, '0')}`;
  const pretty = (date: string) => {
    const [a, b, c] = date.split('-').map(Number);
    return LONG.format(new Date(Date.UTC(a!, b! - 1, c!)));
  };
  return (
    <Panel title={t.tools.calendar} x={x} y={y} width={440} from="top" variant="card" tilt={-1.5} onClose={onClose}>
      <div className={s.calHead}>
        <button type="button" className={s.calArrow} onClick={() => shift(-1)} aria-label={t.tools.prevMonth}>
          ‹
        </button>
        <span className={s.calMonth}>{MONTH.format(first)}</span>
        <button type="button" className={s.calArrow} onClick={() => shift(1)} aria-label={t.tools.nextMonth}>
          ›
        </button>
      </div>
      <div className={s.calGrid} role="grid" aria-label={MONTH.format(first)}>
        {DAYS.map((d, i) => (
          <span key={i} className={s.calDow} aria-hidden="true">
            {d}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`l${i}`} />
        ))}
        {Array.from({ length: daysIn }, (_, i) => {
          const date = iso(i + 1);
          const has = marked.has(date);
          return (
            <button
              key={date}
              type="button"
              className={s.calDay}
              data-today={date === today ? '' : undefined}
              data-has={has ? '' : undefined}
              aria-label={`${pretty(date)}${has ? `, ${t.tools.hasEntry}` : ''}`}
              onClick={() => {
                if (has) {
                  openDate(date, false);
                  onClose();
                } else setPicked(date);
              }}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <div className={s.calFoot}>
        {picked ? (
          <button
            type="button"
            className={s.stampButton}
            onClick={() => {
              openDate(picked, true);
              onClose();
            }}
          >
            {t.tools.newEntryFor(pretty(picked))}
          </button>
        ) : (
          <button
            type="button"
            className={s.stampButton}
            onClick={() => {
              setMonth(today.slice(0, 7));
              if (marked.has(today)) {
                openDate(today, false);
                onClose();
              } else setPicked(today);
            }}
          >
            {t.tools.today}
          </button>
        )}
      </div>
    </Panel>
  );
}
