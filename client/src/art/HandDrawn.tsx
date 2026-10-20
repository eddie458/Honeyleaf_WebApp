// Small hand-drawn pieces that share one line style: round caps, a slight
// wobble, ink-colored strokes and soft fills.

import type { ReactNode } from 'react';
import type { DividerStyle } from '../model/types';

const line = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export function Checkbox({ checked, color, className }: { checked: boolean; color: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 5.6C9 4.7 15 4.4 20.4 5.1C20.9 10.1 21 15.2 20.2 20.3C14.8 21 9 21.2 3.8 20.6C3.3 15.4 3.4 10.2 4 5.6Z"
        {...line}
        stroke={color}
        strokeWidth="1.8"
      />
      {checked && <path d="M6.6 12.4C8.2 13.9 9.4 15.5 10.6 17.4C13.6 11.2 17.6 6.2 23 1.8" {...line} stroke={color} strokeWidth="2.6" />}
    </svg>
  );
}

export function DividerDoodle({ kind, color = '#5f8a4e' }: { kind: DividerStyle; color?: string }) {
  if (kind === 'dots') {
    return (
      <svg viewBox="0 0 300 26" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        {[20, 60, 100, 150, 200, 240, 280].map((x, i) => (
          <circle key={x} cx={x} cy={13} r={i === 3 ? 4.5 : 2.6} fill={color} />
        ))}
      </svg>
    );
  }
  if (kind === 'wave') {
    return (
      <svg viewBox="0 0 300 26" aria-hidden="true">
        <path d="M6 13C26 3 46 23 66 13S106 3 126 13S166 23 186 13S226 3 246 13S286 23 296 13" {...line} stroke={color} strokeWidth="2.2" />
      </svg>
    );
  }
  if (kind === 'stars') {
    return (
      <svg viewBox="0 0 300 26" aria-hidden="true">
        {[40, 150, 260].map((x) => (
          <path key={x} d={`M${x} 4L${x + 3} 11L${x + 10} 13L${x + 3} 15L${x} 22L${x - 3} 15L${x - 10} 13L${x - 3} 11Z`} fill={color} />
        ))}
        {[95, 205].map((x) => (
          <circle key={x} cx={x} cy={13} r={2.5} fill={color} />
        ))}
      </svg>
    );
  }
  // A little vine with leaves and a flower in the middle.
  const leaves: ReactNode[] = [];
  [34, 70, 106, 194, 230, 266].forEach((x, i) => {
    const up = i % 2 === 0;
    leaves.push(
      <path
        key={x}
        d={up ? `M${x} 12C${x + 4} 2 ${x + 14} 2 ${x + 16} 6C${x + 12} 12 ${x + 4} 14 ${x} 12Z` : `M${x} 14C${x + 4} 24 ${x + 14} 24 ${x + 16} 20C${x + 12} 14 ${x + 4} 12 ${x} 14Z`}
        fill={color}
        opacity="0.85"
      />,
    );
  });
  return (
    <svg viewBox="0 0 300 26" aria-hidden="true">
      <path d="M8 14C40 8 70 18 100 13S130 10 140 13M160 13C170 10 200 8 230 13S270 18 292 12" {...line} stroke={color} strokeWidth="1.8" />
      {leaves}
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx="150" cy="7.5" rx="3.4" ry="5.6" fill="#dda7a5" transform={`rotate(${a} 150 13)`} />
      ))}
      <circle cx="150" cy="13" r="3.2" fill="#e3b448" />
    </svg>
  );
}

/** Title swash: an underline that starts with a loop and ends in a flourish. */
export function Swash({ color, className }: { color: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden="true">
      <path
        d="M6 22C14 8 32 10 28 22C24 32 10 30 16 22C30 10 120 20 210 18C290 16 350 12 380 8C392 6 396 12 388 18C376 26 350 30 330 26"
        {...line}
        stroke={color}
        strokeWidth="2.6"
      />
    </svg>
  );
}

/* ---------------------------------------------------------------- moods */

const faceOutline = 'M16 3.2C23.6 3 28.9 8.8 28.7 16.2C28.5 23.6 23 29 15.7 28.8C8.4 28.6 3.1 23 3.3 15.6C3.5 8.4 8.9 3.4 16 3.2Z';

export const MOODS = ['happy', 'content', 'calm', 'excited', 'loved', 'tired', 'sad', 'anxious', 'grumpy'] as const;
export type Mood = (typeof MOODS)[number];

export function MoodIcon({ mood, color = '#3b2a22', className }: { mood: string; color?: string; className?: string }) {
  const stroke = { ...line, stroke: color, strokeWidth: 1.8 };
  let features: ReactNode;
  switch (mood) {
    case 'happy':
      features = (
        <>
          <circle cx="11.5" cy="13" r="1.5" fill={color} />
          <circle cx="20.5" cy="13" r="1.5" fill={color} />
          <path d="M9.5 18.5C12 23.5 20 23.5 22.5 18.5Z" fill="#e8a3a3" {...{ stroke: color, strokeWidth: 1.6, strokeLinejoin: 'round' }} />
        </>
      );
      break;
    case 'content':
      features = (
        <>
          <path d="M9.4 14C10.4 12 12.6 12 13.6 14M18.4 14C19.4 12 21.6 12 22.6 14" {...stroke} />
          <path d="M11 19.6C13.6 22.2 18.4 22.2 21 19.6" {...stroke} />
          <ellipse cx="8.6" cy="18.2" rx="2.2" ry="1.3" fill="#e8a3a3" opacity="0.8" />
          <ellipse cx="23.4" cy="18.2" rx="2.2" ry="1.3" fill="#e8a3a3" opacity="0.8" />
        </>
      );
      break;
    case 'calm':
      features = (
        <>
          <path d="M9.4 14.6C10.6 15.6 12.4 15.6 13.6 14.6M18.4 14.6C19.6 15.6 21.4 15.6 22.6 14.6" {...stroke} />
          <path d="M12.4 20.6C14.6 21.6 17.4 21.6 19.6 20.6" {...stroke} />
        </>
      );
      break;
    case 'excited':
      features = (
        <>
          <path d="M11.5 10.5L12.3 12.6L14.4 13L12.3 13.6L11.5 15.6L10.7 13.6L8.6 13L10.7 12.6Z" fill={color} />
          <path d="M20.5 10.5L21.3 12.6L23.4 13L21.3 13.6L20.5 15.6L19.7 13.6L17.6 13L19.7 12.6Z" fill={color} />
          <path d="M10 18.5C12 24.5 20 24.5 22 18.5" {...stroke} />
        </>
      );
      break;
    case 'loved':
      features = (
        <>
          <path d="M11.5 15.5C9 13.6 8.6 11.6 10 11C10.8 10.7 11.4 11.2 11.5 11.8C11.6 11.2 12.2 10.7 13 11C14.4 11.6 14 13.6 11.5 15.5Z" fill="#d0533b" />
          <path d="M20.5 15.5C18 13.6 17.6 11.6 19 11C19.8 10.7 20.4 11.2 20.5 11.8C20.6 11.2 21.2 10.7 22 11C23.4 11.6 23 13.6 20.5 15.5Z" fill="#d0533b" />
          <path d="M11.4 19.8C13.8 22.4 18.2 22.4 20.6 19.8" {...stroke} />
        </>
      );
      break;
    case 'tired':
      features = (
        <>
          <path d="M9.4 14H13.6M18.4 14H22.6" {...stroke} />
          <ellipse cx="16" cy="21" rx="2.2" ry="1.8" {...stroke} />
          <path d="M23 6.5H26.5L23 10H26.5" {...stroke} strokeWidth="1.3" />
        </>
      );
      break;
    case 'sad':
      features = (
        <>
          <circle cx="11.5" cy="13.4" r="1.4" fill={color} />
          <circle cx="20.5" cy="13.4" r="1.4" fill={color} />
          <path d="M11.4 22C13.6 19.4 18.4 19.4 20.6 22" {...stroke} />
          <path d="M9.6 16.4C9 18 9.4 19 10.2 19.2C11 19 11.2 18 9.6 16.4Z" fill="#8ec5e8" />
        </>
      );
      break;
    case 'anxious':
      features = (
        <>
          <circle cx="11.5" cy="13.4" r="1.6" fill={color} />
          <circle cx="20.5" cy="13.4" r="1.6" fill={color} />
          <path d="M10.4 20.6C11.8 19.2 13 21.8 14.4 20.4S17 19.2 18.4 20.6S21 21.8 21.8 20.4" {...stroke} />
        </>
      );
      break;
    default:
      features = (
        <>
          <path d="M9 11.4L13.6 13M23 11.4L18.4 13" {...stroke} />
          <circle cx="11.6" cy="14.6" r="1.3" fill={color} />
          <circle cx="20.4" cy="14.6" r="1.3" fill={color} />
          <path d="M12 21.4H20" {...stroke} />
        </>
      );
  }
  return (
    <svg className={className} viewBox="0 0 32 32" role="img" aria-label={mood}>
      <path d={faceOutline} fill="#fff4dc" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      {features}
    </svg>
  );
}

/* -------------------------------------------------------------- weather */

export const WEATHER = ['sun', 'sun-cloud', 'cloud', 'rain', 'storm', 'snow', 'wind', 'fog', 'night'] as const;

export function WeatherIcon({ kind, color = '#3b2a22', className }: { kind: string; color?: string; className?: string }) {
  const stroke = { ...line, stroke: color, strokeWidth: 1.8 };
  const sun = (cx: number, cy: number, r: number) => (
    <>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
        const rad = (a * Math.PI) / 180;
        return (
          <path
            key={a}
            d={`M${cx + Math.cos(rad) * (r + 2.6)} ${cy + Math.sin(rad) * (r + 2.6)}L${cx + Math.cos(rad) * (r + 5.4)} ${cy + Math.sin(rad) * (r + 5.4)}`}
            {...stroke}
          />
        );
      })}
      <circle cx={cx} cy={cy} r={r} fill="#f2c44f" stroke={color} strokeWidth="1.8" />
    </>
  );
  const cloud = (dx: number, dy: number) => (
    <path
      d={`M${7 + dx} ${24 + dy}C${3 + dx} ${24 + dy} ${2.6 + dx} ${18 + dy} ${7 + dx} ${17.4 + dy}C${7.4 + dx} ${12 + dy} ${14 + dx} ${10.6 + dy} ${16.4 + dx} ${14.4 + dy}C${18.6 + dx} ${11 + dy} ${25 + dx} ${12.4 + dy} ${24.6 + dx} ${17.6 + dy}C${29 + dx} ${17.6 + dy} ${29 + dx} ${24 + dy} ${25 + dx} ${24 + dy}Z`}
      fill="#fbf6ec"
      {...{ stroke: color, strokeWidth: 1.8, strokeLinejoin: 'round' }}
    />
  );
  let body: ReactNode;
  switch (kind) {
    case 'sun':
      body = sun(16, 16, 6.4);
      break;
    case 'sun-cloud':
      body = (
        <>
          {sun(11.5, 11, 5)}
          {cloud(2, 1)}
        </>
      );
      break;
    case 'rain':
      body = (
        <>
          {cloud(0, -4)}
          <path d="M10 24L8.6 28M16 24L14.6 28M22 24L20.6 28" {...stroke} stroke="#4f97c9" />
        </>
      );
      break;
    case 'storm':
      body = (
        <>
          {cloud(0, -4)}
          <path d="M16.5 21L13.5 26H17L15 30.5" fill="none" stroke="#e3b448" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        </>
      );
      break;
    case 'snow':
      body = (
        <>
          {cloud(0, -4)}
          {[10, 16, 22].map((x) => (
            <path key={x} d={`M${x} 23.5V28.5M${x - 2.2} 26H${x + 2.2}`} {...stroke} strokeWidth="1.4" stroke="#8ec5e8" />
          ))}
        </>
      );
      break;
    case 'wind':
      body = <path d="M4 12H19C23 12 23 6.5 19.6 6.5M4 18H24C28 18 28 24 24.4 24M4 24H13" {...stroke} />;
      break;
    case 'fog':
      body = (
        <>
          {cloud(0, -5)}
          <path d="M5 23H27M8 27.4H24" {...stroke} />
        </>
      );
      break;
    case 'night':
      body = (
        <>
          <path d="M20 5C13 5 8.4 10.6 8.8 16.6C9.2 23 15 27.4 21 26.6C24 26.2 26.4 24.6 27.6 22.6C21.6 23.6 15.6 19 16 12.4C16.2 9 17.8 6.6 20 5Z" fill="#f2dc8f" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M24.5 8.5L25.2 10.3L27 11L25.2 11.7L24.5 13.5L23.8 11.7L22 11L23.8 10.3Z" fill={color} />
        </>
      );
      break;
    default:
      body = cloud(0, -2);
  }
  return (
    <svg className={className} viewBox="0 0 32 32" role="img" aria-label={kind}>
      {body}
    </svg>
  );
}
