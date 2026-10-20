import type { ReactNode } from 'react';
import { libraryUrl, publicUrl } from '../library/library';
import { t } from '../strings/en';
import s from './auth.module.css';

export const CLOSED_W = 640;
export const CLOSED_H = 880;

interface Props {
  /** 'shut' strapped and locked; 'opening' plays the unlock; 'plain' has no strap (setup). */
  state: 'shut' | 'opening' | 'plain';
  jiggle?: number;
  /** Lies on the strap: the name tag. */
  tag?: ReactNode;
  /** Tucked under the padlock: the password slip. */
  slip?: ReactNode;
  children?: ReactNode;
}

/** The closed journal: leather cover, label with the wordmark, strap and padlock. */
export function ClosedJournal({ state, jiggle = 0, tag, slip, children }: Props) {
  return (
    <div className={s.closed} data-state={state} style={{ width: CLOSED_W, height: CLOSED_H }}>
      <div className={s.pagesUnder} aria-hidden="true" />
      <div className={s.coverWrap}>
        <div className={s.coverFront}>
          <div className={s.spine} aria-hidden="true" />
          <svg className={s.coverStitch} viewBox={`0 0 ${CLOSED_W} ${CLOSED_H}`} aria-hidden="true">
            <rect x="10" y="10" width={CLOSED_W - 20} height={CLOSED_H - 20} rx="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeDasharray="7 6" />
          </svg>
          <div className={s.label}>
            <Wordmark />
          </div>
        </div>
        <div className={s.coverBack} aria-hidden="true" />
      </div>
      {state !== 'plain' && (
        <>
          <div className={s.strap} aria-hidden="true">
            <span className={s.strapLoop} />
          </div>
          <div className={s.padlock} key={jiggle} data-jiggle={jiggle > 0 ? '' : undefined} aria-hidden="true">
            <img src={libraryUrl('props/padlock.svg')} alt="" draggable={false} />
          </div>
          <div className={s.tagSpot}>{tag}</div>
          <div className={s.slipSpot}>{slip}</div>
        </>
      )}
      {children}
    </div>
  );
}

/** The hand-lettered wordmark with its honey leaf. */
export function Wordmark({ small }: { small?: boolean }) {
  return (
    <span className={`${s.wordmark} ${small ? s.wordmarkSmall : ''}`}>
      <img src={publicUrl('icons/honeyleaf.svg')} alt="" className={s.leaf} draggable={false} />
      <span className={s.mark}>{t.app.name}</span>
    </span>
  );
}
