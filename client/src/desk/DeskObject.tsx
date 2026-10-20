import type { CSSProperties, ReactNode } from 'react';
import { HandRing } from './HandRing';
import { PaperTag, type TagPlacement } from './PaperTag';
import { shadowOffset } from './stage';
import s from './DeskObject.module.css';

export interface DeskObjectProps {
  label: string;
  /** Art for the object (an SVG from the props manifest). */
  src: string;
  /** Center and size in stage units. */
  x: number;
  y: number;
  w: number;
  h: number;
  rot?: number;
  /** How tall the object stands above the desk; sets its shadow. */
  lift?: number;
  tag?: TagPlacement;
  pressed?: boolean;
  /** False: plain decor (no button, no tag). */
  interactive?: boolean;
  onActivate?: () => void;
  /** Animated layers drawn over the art (steam, glow…). */
  children?: ReactNode;
  className?: string;
}

/**
 * A desk object: a real button whose art lifts, wiggles and shows a paper
 * tag on hover or keyboard focus. The shadow is offset in desk space, so it
 * always falls away from the light no matter how the object is turned.
 */
export function DeskObject(props: DeskObjectProps) {
  const { label, src, x, y, w, h, rot = 0, lift = 20, tag, pressed, interactive = true, onActivate, children, className } = props;
  const sh = shadowOffset(lift);
  const style = {
    left: `${x - w / 2}px`,
    top: `${y - h / 2}px`,
    width: `${w}px`,
    height: `${h}px`,
    '--rot': `${rot}deg`,
    '--sx': `${sh.x}px`,
    '--sy': `${sh.y}px`,
    '--blur': `${sh.blur}px`,
    '--blur-up': `${sh.blur * 2.2 + 4}px`,
  } as CSSProperties;
  if (!interactive) {
    return (
      <div className={`${s.object} ${s.quiet} ${className ?? ''}`} style={style} aria-hidden="true">
        <span className={s.shadow}>
          <img src={src} alt="" draggable={false} />
        </span>
        <span className={s.body}>
          <img className={s.art} src={src} alt="" draggable={false} />
          {children}
        </span>
      </div>
    );
  }
  return (
    <button
      type="button"
      className={`${s.object} ${className ?? ''}`}
      style={style}
      aria-label={label}
      aria-pressed={pressed}
      onClick={onActivate}
    >
      <span className={s.shadow} aria-hidden="true">
        <img src={src} alt="" draggable={false} />
      </span>
      <span className={s.shadowUp} aria-hidden="true">
        <img src={src} alt="" draggable={false} />
      </span>
      <span className={s.body}>
        <img className={s.art} src={src} alt="" draggable={false} />
        {children}
      </span>
      <PaperTag className={s.tag} text={label} place={tag ?? { x: w * 0.3, y: h * 0.3 }} />
      <HandRing className={s.ring} />
    </button>
  );
}
