import type { CSSProperties } from 'react';
import s from './PaperTag.module.css';

export interface TagPlacement {
  /** Where the tag's hole sits, relative to the object's center (stage units). */
  x: number;
  y: number;
  /** Resting tilt of the tag in degrees. */
  tilt?: number;
}

/** A kraft paper tag on a string: the desk's tooltip. */
export function PaperTag({ text, place, className }: { text: string; place: TagPlacement; className?: string }) {
  const style = {
    '--tag-x': `${place.x}px`,
    '--tag-y': `${place.y}px`,
    '--tag-tilt': `${place.tilt ?? -4}deg`,
  } as CSSProperties;
  return (
    <span className={`${s.anchor} ${className ?? ''}`} style={style} aria-hidden="true">
      <svg className={s.string} viewBox="0 0 60 40" aria-hidden="true">
        <path d="M2 4c14 2 18 18 30 22s20 2 26 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className={s.tag}>
        <span className={s.hole} />
        <span className={s.text}>{text}</span>
      </span>
    </span>
  );
}
