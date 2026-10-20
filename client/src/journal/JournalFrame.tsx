import type { CSSProperties, ReactNode } from 'react';
import { PAGE_H, PAGE_W } from '../model/page';
import type { JournalCover } from '../data/bookStore';
import { t } from '../strings/en';
import s from './JournalFrame.module.css';

export interface FrameTab {
  key: string;
  label: string;
  color: string;
  /** Distance from the top of the page block. */
  y: number;
  side: 'left' | 'right';
  onClick(): void;
}

interface Props {
  layout: 'spread' | 'single';
  cover: JournalCover;
  /** Sheets lying under each side; page edges thicken with them. */
  sheets: { left: number; right: number };
  left?: ReactNode;
  right?: ReactNode;
  /** Drawn above both pages (the turning leaf, corner hot spots). */
  above?: ReactNode;
  tabs: FrameTab[];
  onRibbon(): void;
  status?: ReactNode;
}

export const MARGIN = 16;
export const EDGE = 10;
export const SPREAD_W = PAGE_W * 2 + (MARGIN + EDGE) * 2;
export const SINGLE_W = PAGE_W + (MARGIN + EDGE) * 2;
export const FRAME_H = PAGE_H + MARGIN * 2 + EDGE;
export const PAGE_X = MARGIN + EDGE;
export const PAGE_Y = MARGIN;

/** The open journal around its pages: cover, page edges, spine, tabs, ribbon, elastic. */
export function JournalFrame({ layout, cover, sheets, left, right, above, tabs, onRibbon, status }: Props) {
  const width = layout === 'spread' ? SPREAD_W : SINGLE_W;
  const style = {
    width,
    height: FRAME_H,
    '--cover': cover.color,
    '--cover-texture': `var(--tex-${cover.material})`,
    '--cover-texture-w': `var(--tex-${cover.material}-w)`,
    '--cover-texture-h': `var(--tex-${cover.material}-h)`,
    '--stitch': cover.stitch,
    '--elastic': cover.elastic,
    '--ribbon': cover.ribbon,
  } as CSSProperties;
  const spineX = layout === 'spread' ? PAGE_X + PAGE_W : PAGE_X;
  return (
    <div className={s.journal} style={style} data-layout={layout}>
      <div className={s.cover}>
        <svg className={s.stitching} viewBox={`0 0 ${width} ${FRAME_H}`} aria-hidden="true">
          <rect x="8" y="8" width={width - 16} height={FRAME_H - 16} rx="14" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="7 6" />
        </svg>
      </div>
      {layout === 'spread' && (
        <>
          <div className={s.headband} style={{ left: spineX - 14, top: PAGE_Y - 9 }} />
          <div className={s.headband} style={{ left: spineX - 14, top: PAGE_Y + PAGE_H - 3 }} />
        </>
      )}

      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={s.tab}
          data-side={tab.side}
          style={{ left: tab.side === 'left' ? PAGE_X - 54 : width - PAGE_X - 16, top: PAGE_Y + tab.y, background: tab.color }}
          onClick={tab.onClick}
          aria-label={t.journal.monthTab(tab.label)}
        >
          {tab.label}
        </button>
      ))}

      {layout === 'spread' ? (
        <>
          <div className={s.stack} data-side="left" style={{ left: PAGE_X, top: PAGE_Y, boxShadow: edgeShadow('left', sheets.left) }} />
          <div className={s.stack} data-side="right" style={{ left: PAGE_X + PAGE_W, top: PAGE_Y, boxShadow: edgeShadow('right', sheets.right) }} />
          <div className={s.slot} style={{ left: PAGE_X, top: PAGE_Y }}>
            {left}
          </div>
          <div className={s.slot} style={{ left: PAGE_X + PAGE_W, top: PAGE_Y }}>
            {right}
          </div>
          <div className={s.gutter} style={{ left: PAGE_X + PAGE_W - 3, top: PAGE_Y }} />
        </>
      ) : (
        <>
          <div className={s.stack} data-side="right" style={{ left: PAGE_X, top: PAGE_Y, boxShadow: edgeShadow('right', sheets.right) }} />
          <div className={s.slot} style={{ left: PAGE_X, top: PAGE_Y }}>
            {right ?? left}
          </div>
        </>
      )}

      <div className={s.above} style={{ left: PAGE_X, top: PAGE_Y }}>
        {above}
      </div>

      <button type="button" className={s.ribbon} style={{ left: spineX - 30, top: PAGE_Y + PAGE_H - 26 }} onClick={onRibbon} aria-label={t.journal.ribbon}>
        <svg viewBox="0 0 90 150" aria-hidden="true">
          <path d="M30 0C34 40 30 84 40 128L50 112L62 124C50 82 52 40 48 0Z" className={s.ribbonShadow} />
          <path d="M26 0C30 40 26 84 36 128L46 112L58 124C46 82 48 40 44 0Z" fill="var(--ribbon)" />
          <path d="M30 4C33 44 31 84 39 120" fill="none" stroke="#fff4d2" strokeWidth="2.5" strokeLinecap="round" opacity="0.55" />
        </svg>
      </button>

      <div className={s.elastic} />
      {status && <div className={s.status}>{status}</div>}
    </div>
  );
}

/** Stacked page edges drawn as layered box-shadows, thicker as the journal fills. */
function edgeShadow(side: 'left' | 'right', sheets: number): string {
  const layers = Math.max(1, Math.min(8, Math.round(sheets / 6)));
  const dir = side === 'left' ? -1 : 1;
  const out: string[] = [];
  for (let i = 1; i <= layers; i++) out.push(`${(dir * i * 1.35).toFixed(2)}px ${(i * 1.3).toFixed(2)}px 0 ${i % 2 ? '#d8c9aa' : '#f3e9d4'}`);
  out.push(`${(dir * (layers + 1) * 1.35).toFixed(2)}px ${((layers + 1) * 1.3).toFixed(2)}px 0 #b8a481`);
  return out.join(', ');
}
