import { fontFamily } from '../library/fonts';
import { libraryUrl } from '../library/library';
import s from './DeskLife.module.css';

/** Steam curling up from the mug. Only transform and opacity animate. */
export function Steam() {
  const src = libraryUrl('props/steam.svg');
  return (
    <span className={s.steam} aria-hidden="true">
      <img className={s.wisp} src={src} alt="" />
      <img className={`${s.wisp} ${s.late}`} src={src} alt="" />
    </span>
  );
}

const monthFmt = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' });
const dayFmt = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' });

/** Today's page on the tear-off calendar. */
export function CalendarFace({ date }: { date: string }) {
  const [y, m, d] = date.split('-').map(Number);
  const when = new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1, d ?? 1));
  return (
    <span className={s.calendar} aria-hidden="true">
      <span className={s.month} style={{ fontFamily: `${fontFamily('special-elite')}, monospace` }}>
        {monthFmt.format(when)}
      </span>
      <span className={s.day} style={{ fontFamily: `${fontFamily('lora')}, serif` }}>
        {d}
      </span>
      <span className={s.weekday} style={{ fontFamily: `${fontFamily('caveat')}, cursive` }}>
        {dayFmt.format(when)}
      </span>
    </span>
  );
}

const LEAVES: { file: string; x: number; y: number; size: number; rot: number }[] = [
  { file: 'props/leaf-maple-red.svg', x: 470, y: 230, size: 86, rot: 24 },
  { file: 'props/leaf-birch.svg', x: 1390, y: 205, size: 60, rot: -38 },
  { file: 'props/leaf-oak.svg', x: 1640, y: 1250, size: 76, rot: 62 },
  { file: 'props/leaf-maple-gold.svg', x: 1760, y: 960, size: 80, rot: -18 },
  { file: 'props/leaf-maple-gold.svg', x: 360, y: 1210, size: 64, rot: 140 },
];

/** October: a few leaves blown in through the window. */
export function AutumnLeaves() {
  return (
    <>
      {LEAVES.map((l, i) => (
        <img
          key={i}
          className={s.leaf}
          src={libraryUrl(l.file)}
          alt=""
          draggable={false}
          style={{ left: l.x - l.size / 2, top: l.y - l.size / 2, width: l.size, height: l.size, rotate: `${l.rot}deg` }}
        />
      ))}
    </>
  );
}

/** Dust motes drifting in the low sunbeam. */
export function DustMotes() {
  const motes = Array.from({ length: 16 }, (_, i) => ({
    x: 120 + ((i * 137) % 520),
    y: 160 + ((i * 89) % 560),
    size: 4 + (i % 4) * 2,
    delay: -((i * 1.7) % 12),
    dur: 12 + (i % 5) * 3,
  }));
  return (
    <div className={s.motes} aria-hidden="true">
      {motes.map((m, i) => (
        <span
          key={i}
          className={s.mote}
          style={{ left: m.x, top: m.y, width: m.size, height: m.size, animationDelay: `${m.delay}s`, animationDuration: `${m.dur}s` }}
        />
      ))}
    </div>
  );
}
