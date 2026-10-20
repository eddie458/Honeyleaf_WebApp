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

/* ------------------------------------------------------- after dark */

const BULB_COLORS = ['#ffe3a6', '#ffd27e', '#ffc98c', '#ffeccb', '#ffd9a0'];

/**
 * After dark: a string of warm fairy lights draped along the back of the
 * desk, each bulb glowing and breathing gently (still when motion is
 * reduced). Drawn in code like all the desk's art.
 */
export function FairyLights({ width }: { width: number }) {
  const drapes = Math.max(2, Math.round(width / 540));
  const span = width / drapes;
  const sag = Math.min(64, span * 0.13);
  const top = 6;
  let wire = `M -30 ${top - 4}`;
  const bulbs: { x: number; y: number; tilt: number; color: string; delay: number; dur: number }[] = [];
  for (let i = 0; i < drapes; i++) {
    const x0 = i * span;
    const x1 = (i + 1) * span;
    const cx = (x0 + x1) / 2;
    const cy = top + sag * 2;
    wire += ` Q ${cx} ${cy} ${x1} ${top}`;
    const per = Math.max(3, Math.round(span / 105));
    for (let k = 1; k <= per; k++) {
      const t = k / (per + 1);
      const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
      const y = (1 - t) * (1 - t) * top + 2 * (1 - t) * t * cy + t * t * top;
      // Bulbs hang along the wire's slope, a little crooked.
      const slope = (2 * (1 - t) * (cy - top) + 2 * t * (top - cy)) / (2 * (1 - t) * (cx - x0) + 2 * t * (x1 - cx));
      const n = bulbs.length;
      bulbs.push({ x, y, tilt: (Math.atan(slope) * 180) / Math.PI * 0.5 + ((n * 37) % 11) - 5, color: BULB_COLORS[n % BULB_COLORS.length]!, delay: -((n * 1.3) % 6), dur: 3.4 + ((n * 7) % 5) * 0.6 });
    }
  }
  const h = top + sag * 2 + 70;
  return (
    <div className={s.lights} style={{ width, height: h }} aria-hidden="true">
      <svg className={s.glows} viewBox={`0 0 ${width} ${h}`} width={width} height={h}>
        <defs>
          <radialGradient id="fl-glow">
            <stop offset="0" stopColor="#ffd98f" stopOpacity="0.9" />
            <stop offset="0.35" stopColor="#ffbf66" stopOpacity="0.35" />
            <stop offset="1" stopColor="#ffb050" stopOpacity="0" />
          </radialGradient>
        </defs>
        {bulbs.map((b, i) => (
          <circle key={i} className={s.glow} cx={b.x} cy={b.y + 16} r="54" fill="url(#fl-glow)" style={{ animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s` }} />
        ))}
      </svg>
      <svg className={s.string} viewBox={`0 0 ${width} ${h}`} width={width} height={h}>
        <path d={wire} fill="none" stroke="#2f3a2a" strokeWidth="2.6" strokeLinecap="round" />
        {bulbs.map((b, i) => (
          <g key={i} transform={`translate(${b.x} ${b.y}) rotate(${b.tilt})`}>
            <rect x="-4.5" y="-1" width="9" height="9" rx="2" fill="#3b4a34" />
            <path d="M0 6C-7.5 6 -9 14 -8 19C-6.5 26 -3 30 0 30C3 30 6.5 26 8 19C9 14 7.5 6 0 6Z" fill={b.color} />
            <path d="M-3.6 12C-5 15 -5 19 -3.8 22" fill="none" stroke="#fffaf0" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
          </g>
        ))}
      </svg>
    </div>
  );
}

/** The radio playing: its dial glows and a few notes drift up from the speaker. */
export function RadioGlow() {
  return (
    <span className={s.radio} aria-hidden="true">
      <span className={s.dialGlow} />
      {[0, 1, 2].map((i) => (
        <svg key={i} className={s.note} viewBox="0 0 24 34">
          {i === 1 ? (
            <path d="M5 27.5c0-2.4 2.6-4.2 5.4-4.2.8 0 1.5.1 2.1.4V5.2l9-2.4v18.6c0 2.4-2.6 4.2-5.4 4.2s-4.6-1.5-4.6-3.6 2.6-4.2 5.4-4.2c.7 0 1.4.1 2 .3V8.4l-6 1.7v17.2c0 2.4-2.6 4.2-5.4 4.2S5 29.6 5 27.5z" />
          ) : (
            <path d="M6 27.5c0-2.4 2.6-4.2 5.4-4.2.8 0 1.5.1 2.1.4V3h2.2c.6 3.4 2.6 5 4.4 6.8 1.8 1.8 2.6 4.6 1.4 7.6-.3-2.8-2.4-4.8-5.6-5.4v15.5c0 2.4-2.6 4.2-5.4 4.2S6 29.6 6 27.5z" />
          )}
        </svg>
      ))}
    </span>
  );
}
