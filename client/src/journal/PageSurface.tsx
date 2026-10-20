import type { CSSProperties, ReactNode } from 'react';
import { libraryUrl } from '../library/library';
import { PAGE_H, PAGE_W } from '../model/page';
import type { Box } from '../model/transform';
import type { Decoration, PageDoc } from '../model/types';
import { DecorationView, type WashiTile } from '../decor/DecorationView';
import s from './PageSurface.module.css';

export interface PaperEntry {
  id: string;
  name: string;
  base: string;
  texture: string;
  pattern: 'lined' | 'dotted' | 'grid' | 'blank';
  line?: string;
  margin?: string;
  dark?: boolean;
  aged?: boolean;
  doubleMargin?: boolean;
}

interface Props {
  page: PageDoc;
  side: 'left' | 'right' | 'single';
  paper: PaperEntry;
  washi: Record<string, WashiTile>;
  /** The entry's date and title, on its first page. */
  header?: ReactNode;
  /** The text layer (live editor or static text). */
  children?: ReactNode;
  /** Editing aids drawn above everything (decoration handles, margin clips). */
  overlay?: ReactNode;
  /** A decoration being dragged right now, drawn at its live box. */
  override?: { id: string; box: Box } | null;
  /** Decorations that are mid-crumple. */
  leaving?: ReadonlySet<string>;
  entryId?: string;
  pageId?: string;
  /** The fresh page at the end of the book (things dropped here start today's entry). */
  blank?: boolean;
  className?: string;
}

/** A journal page at its fixed size: paper, decorations, header, text and shading. */
export function PageSurface({ page, side, paper, washi, header, children, overlay, override, leaving, entryId, pageId, blank, className }: Props) {
  const style = {
    width: PAGE_W,
    height: PAGE_H,
    '--paper-base': paper.base,
    '--paper-line': paper.line ?? 'transparent',
    '--paper-margin': paper.margin ?? 'transparent',
    '--paper-texture': `var(--tex-${paper.texture})`,
    '--paper-texture-w': `var(--tex-${paper.texture}-w)`,
    '--paper-texture-h': `var(--tex-${paper.texture}-h)`,
  } as CSSProperties;
  const area = page.area;
  const sorted = [...page.decorations].sort((a, b) => a.z - b.z);
  const view = (d: Decoration) => {
    const live = override?.id === d.id ? { ...d, ...override.box } : d;
    return <DecorationView key={d.id} deco={live as Decoration} washi={washi} leaving={leaving?.has(d.id) ?? false} />;
  };
  return (
    <div
      className={`${s.page} ${className ?? ''}`}
      style={style}
      data-side={side}
      data-paper={paper.id}
      data-dark={paper.dark ? '' : undefined}
      data-entry-id={entryId}
      data-page-id={pageId}
      data-blank-page={blank ? '' : undefined}
    >
      <div className={s.paper} data-pattern={paper.pattern} data-aged={paper.aged ? '' : undefined} data-double={paper.doubleMargin ? '' : undefined} />
      <div className={s.layer}>{sorted.filter((d) => d.layer === 'back').map(view)}</div>
      {header}
      <div className={s.area} style={{ left: area.left, top: area.top, width: PAGE_W - area.left - area.right, height: PAGE_H - area.top - area.bottom }}>
        {children}
      </div>
      <div className={`${s.layer} ${s.front}`}>{sorted.filter((d) => d.layer === 'front').map(view)}</div>
      {page.favorite && <img className={s.favorite} src={libraryUrl('stickers/cozy/heart.svg')} alt="" draggable={false} />}
      <div className={s.shade} aria-hidden="true" />
      <div className={s.sheen} aria-hidden="true" />
      {overlay}
    </div>
  );
}
