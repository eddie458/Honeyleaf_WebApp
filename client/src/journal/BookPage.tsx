import { memo, useCallback, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react';
import { useBook } from '../data/bookStore';
import { useLibrary } from '../library/useLibrary';
import type { BookSlot } from '../model/book';
import { GRID, PAGE_H, PAGE_W, type WritingArea } from '../model/page';
import type { Decoration, PageDoc, Stroke, StrokePoint } from '../model/types';
import { DecorationEditor } from '../decor/DecorationEditor';
import { addDecoration, type DecoDraft } from '../decor/decorate';
import { strokePath } from '../decor/DecorationView';
import { PageEditor } from '../editor/PageEditor';
import { reflowEntry } from '../editor/flowController';
import { StaticText } from '../text/StaticText';
import { t } from '../strings/en';
import { EntryHeader } from './EntryHeader';
import { PageSurface, type PaperEntry } from './PageSurface';
import { startFreshEntry } from './entries';
import s from './BookPage.module.css';

interface Props {
  slot: BookSlot | undefined;
  side: 'left' | 'right' | 'single';
  /** The settled, current spread: editable. Pages in a turn are drawn still. */
  live: boolean;
}

/** Whatever lies at one slot of the book. */
export const BookPage = memo(function BookPage({ slot, side, live }: Props) {
  if (!slot) return <Endpaper side={side} />;
  if (slot.kind === 'lining') return <Endpaper side={side} nameplate />;
  if (slot.kind === 'blank') return <BlankPage side={side} live={live} />;
  return <JournalPage entryId={slot.entryId} pageId={slot.pageId} side={side} live={live} />;
});

function useDefaults() {
  const d = useBook((st) => st.journal?.defaults);
  return { font: d?.font ?? 'caveat', size: d?.size ?? 22, color: d?.inkColor ?? '#3b2a22' };
}

function JournalPage({ entryId, pageId, side, live }: { entryId: string; pageId: string; side: Props['side']; live: boolean }) {
  const entry = useBook((st) => st.entries[entryId]);
  const mode = useBook((st) => st.mode);
  const papers = useLibrary((st) => st.papers);
  const washi = useLibrary((st) => st.washi);
  const defaults = useDefaults();
  const [draft, setDraft] = useState<DecoDraft | null>(null);
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(new Set());
  const onDraft = useCallback((d: DecoDraft | null) => setDraft(d), []);
  const onToss = useCallback(
    (id: string) =>
      new Promise<void>((resolve) => {
        setLeaving((prev) => new Set(prev).add(id));
        window.setTimeout(() => {
          setLeaving((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          resolve();
        }, 480);
      }),
    [],
  );

  const page = entry?.pages.find((p) => p.id === pageId);
  if (!entry || !page) return <LoadingPaper side={side} />;
  const index = entry.pages.indexOf(page);
  const paper = papers[page.doc.paper.id] ?? fallbackPaper;
  const header = index === 0 ? <EntryHeader entryId={entryId} header={entry.header} ink={defaults.color} editable={live && mode === 'write'} /> : null;
  const text = live && mode === 'write' ? <PageEditor entryId={entryId} pageId={pageId} defaults={defaults} placeholder={index === 0 ? t.journal.startWriting : ''} /> : <StaticText doc={page.doc.text} defaults={defaults} />;
  let overlay = null;
  if (live && mode === 'decorate') {
    overlay = (
      <>
        <AreaClips entryId={entryId} pageId={pageId} pageIndex={index} area={page.doc.area} />
        <DecorationEditor entryId={entryId} pageId={pageId} page={page.doc} onDraft={onDraft} onToss={onToss} />
        <PaperTab entryId={entryId} pageId={pageId} current={page.doc.paper.id} side={side} />
      </>
    );
  } else if (live && mode === 'draw') {
    overlay = <DrawLayer entryId={entryId} pageId={pageId} page={page.doc} />;
  }
  return (
    <PageSurface page={page.doc} side={side} paper={paper} washi={washi} header={header} overlay={overlay} override={draft} leaving={leaving} entryId={entryId} pageId={pageId}>
      {text}
    </PageSurface>
  );
}

const fallbackPaper: PaperEntry = { id: 'lined-cream', name: 'Lined', base: '#fbf4e6', texture: 'paper-grain', pattern: 'lined', line: '#b7cfe6', margin: '#e8a3a3' };

const EMPTY_PAGE: PageDoc = { v: 1, paper: { id: 'blank-cream' }, area: { top: 0, right: 0, bottom: 0, left: 0 }, text: { type: 'doc', content: [{ type: 'paragraph' }] }, decorations: [] };

function LoadingPaper({ side }: { side: Props['side'] }) {
  const papers = useLibrary((st) => st.papers);
  const washi = useLibrary((st) => st.washi);
  return (
    <PageSurface page={EMPTY_PAGE} side={side} paper={papers['blank-cream'] ?? fallbackPaper} washi={washi}>
      <p className={s.loading}>{t.journal.loadingPage}</p>
    </PageSurface>
  );
}

/** The last page of the book: a fresh page waiting for today. */
function BlankPage({ side, live }: { side: Props['side']; live: boolean }) {
  const journal = useBook((st) => st.journal);
  const papers = useLibrary((st) => st.papers);
  const washi = useLibrary((st) => st.washi);
  const paper = papers[journal?.defaults.paper ?? 'lined-cream'] ?? fallbackPaper;
  const page: PageDoc = { ...EMPTY_PAGE, paper: { id: paper.id } };
  return (
    <PageSurface page={page} side={side} paper={paper} washi={washi} blank>
      {live && (
        <button type="button" className={s.fresh} onClick={startFreshEntry}>
          <span className={s.freshTitle}>{t.journal.freshPage}</span>
          <span className={s.freshHint}>{t.journal.freshPageHint}</span>
        </button>
      )}
    </PageSurface>
  );
}

/** The inside of the cover: patterned endpaper, and a nameplate up front. */
function Endpaper({ side, nameplate }: { side: Props['side']; nameplate?: boolean }) {
  const journal = useBook((st) => st.journal);
  const owner = useBook((st) => st.ownerName);
  return (
    <div className={s.endpaper} data-side={side} style={{ width: PAGE_W, height: PAGE_H }}>
      {nameplate && (
        <div className={s.nameplate}>
          <span className={s.belongs}>{t.journal.nameplate}</span>
          <span className={s.owner}>{owner}</span>
          <span className={s.journalTitle}>{journal?.title}</span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------- writing area */

const SIDES = ['top', 'bottom', 'left', 'right'] as const;

/** Clips on the four edges of the writing area: drag them to change its margins. */
function AreaClips({ entryId, pageId, pageIndex, area }: { entryId: string; pageId: string; pageIndex: number; area: WritingArea }) {
  const editPage = useBook((st) => st.editPage);
  const [live, setLive] = useState<WritingArea | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const a = live ?? area;
  const drag = (sideName: (typeof SIDES)[number]) => (e: RPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const el = ref.current?.parentElement;
    if (!el) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    const k = PAGE_W / rect.width;
    let latest = area;
    const move = (ev: PointerEvent) => {
      const x = (ev.clientX - rect.left) * k;
      const y = (ev.clientY - rect.top) * k;
      const next = { ...area };
      if (sideName === 'top') next.top = Math.min(PAGE_H - area.bottom, Math.max(0, Math.round(y / GRID) * GRID));
      if (sideName === 'bottom') next.bottom = Math.min(PAGE_H - area.top, Math.max(0, PAGE_H - Math.round(y / GRID) * GRID));
      if (sideName === 'left') next.left = Math.min(PAGE_W - area.right - 120, Math.max(0, Math.round(x / 4) * 4));
      if (sideName === 'right') next.right = Math.min(PAGE_W - area.left - 120, Math.max(0, Math.round((PAGE_W - x) / 4) * 4));
      latest = next;
      setLive(next);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setLive(null);
      if (JSON.stringify(latest) === JSON.stringify(area)) return;
      editPage(entryId, pageId, (doc) => ({ ...doc, area: latest }), `area:${pageId}`);
      reflowEntry(entryId, Math.max(0, pageIndex - 1), `area:${pageId}`);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const box = { left: a.left, top: a.top, width: PAGE_W - a.left - a.right, height: PAGE_H - a.top - a.bottom };
  const labels = { top: t.journal.marginTop, bottom: t.journal.marginBottom, left: t.journal.marginLeft, right: t.journal.marginRight };
  return (
    <div ref={ref} className={s.areaOutline} style={box} aria-label={t.journal.writingArea}>
      {SIDES.map((side) => (
        <button key={side} type="button" className={s.clip} data-edge={side} aria-label={labels[side]} onPointerDown={drag(side)} />
      ))}
    </div>
  );
}

/** A little paper swatch on the page corner: change this page's paper. */
function PaperTab({ entryId, pageId, current, side }: { entryId: string; pageId: string; current: string; side: Props['side'] }) {
  const [open, setOpen] = useState(false);
  const papers = useLibrary((st) => st.paperList);
  const editPage = useBook((st) => st.editPage);
  return (
    <div className={s.paperTab} data-side={side} onPointerDown={(e) => e.stopPropagation()}>
      <button type="button" className={s.paperButton} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={t.tools.paperPicker}>
        {t.journal.paper}
      </button>
      {open && (
        <div className={s.paperCard} role="listbox" aria-label={t.tools.paperPicker}>
          {papers.map((p) => (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={p.id === current}
              className={s.swatch}
              style={{ '--sw-base': p.base, '--sw-line': p.line ?? 'transparent' } as CSSProperties}
              data-pattern={p.pattern}
              onClick={() => {
                editPage(entryId, pageId, (doc) => ({ ...doc, paper: { id: p.id } }));
                setOpen(false);
              }}
            >
              <span className={s.swatchPaper} />
              <span className={s.swatchName}>{p.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ drawing */

/** The pencil: freehand strokes, with stylus pressure where there is one. */
function DrawLayer({ entryId, pageId, page }: { entryId: string; pageId: string; page: PageDoc }) {
  const ink = useBook((st) => st.pen.ink.color);
  const ref = useRef<HTMLDivElement>(null);
  const [points, setPoints] = useState<StrokePoint[] | null>(null);
  const last = useRef<{ id: string; at: number } | null>(null);
  const toPage = (e: { clientX: number; clientY: number }) => {
    const r = ref.current!.getBoundingClientRect();
    const k = PAGE_W / r.width;
    return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k };
  };
  const pressure = (e: RPointerEvent) => (e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5);
  const down = (e: RPointerEvent<HTMLDivElement>) => {
    ref.current!.setPointerCapture(e.pointerId);
    const p = toPage(e);
    setPoints([{ x: p.x, y: p.y, p: pressure(e) }]);
  };
  const move = (e: RPointerEvent<HTMLDivElement>) => {
    if (!points) return;
    const events = 'getCoalescedEvents' in e.nativeEvent ? e.nativeEvent.getCoalescedEvents() : [e.nativeEvent];
    const extra = (events.length ? events : [e.nativeEvent]).map((ev) => ({ ...toPage(ev), p: ev.pointerType === 'pen' && ev.pressure > 0 ? ev.pressure : 0.5 }));
    setPoints((prev) => (prev ? [...prev, ...extra] : prev));
  };
  const up = () => {
    if (!points || points.length < 2) {
      setPoints(null);
      return;
    }
    commitStroke(entryId, pageId, page, points, ink, last);
    setPoints(null);
  };
  return (
    <div ref={ref} className={s.drawLayer} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      {points && (
        <svg className={s.drawPreview} viewBox={`0 0 ${PAGE_W} ${PAGE_H}`} aria-hidden="true">
          <path d={strokePath({ tool: 'pen', color: ink, size: 3.2, points })} fill={ink} />
        </svg>
      )}
    </div>
  );
}

/** Strokes drawn in quick succession join the same doodle. */
function commitStroke(entryId: string, pageId: string, page: PageDoc, points: StrokePoint[], color: string, last: { current: { id: string; at: number } | null }) {
  const pad = 8;
  const recent = last.current && Date.now() - last.current.at < 2500 ? page.decorations.find((d) => d.id === last.current!.id && d.type === 'drawing') : undefined;
  const stroke = { tool: 'pen' as const, color, size: 3.2, points };
  if (recent && recent.type === 'drawing') {
    const ox = recent.x - recent.w / 2;
    const oy = recent.y - recent.h / 2;
    const all = [...recent.strokes.map((st) => ({ ...st, points: st.points.map((q) => ({ ...q, x: q.x + ox, y: q.y + oy })) })), stroke];
    const next = drawingFrom(all, pad);
    useBook.getState().editDecoration(entryId, pageId, recent.id, (d) => ({ ...d, ...next }) as Decoration, `draw:${recent.id}`);
    last.current = { id: recent.id, at: Date.now() };
    return;
  }
  const deco = drawingFrom([stroke], pad);
  const id = addDecoration(entryId, pageId, { type: 'drawing', layer: 'front', rot: 0, ...deco });
  useBook.getState().select(null);
  last.current = { id, at: Date.now() };
}

function drawingFrom(strokes: Stroke[], pad: number) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const st of strokes)
    for (const q of st.points) {
      minX = Math.min(minX, q.x);
      minY = Math.min(minY, q.y);
      maxX = Math.max(maxX, q.x);
      maxY = Math.max(maxY, q.y);
    }
  minX -= pad;
  minY -= pad;
  maxX += pad;
  maxY += pad;
  const w = Math.max(16, maxX - minX);
  const h = Math.max(16, maxY - minY);
  return {
    x: minX + w / 2,
    y: minY + h / 2,
    w,
    h,
    strokes: strokes.map((st) => ({ ...st, points: st.points.map((q) => ({ x: Math.round((q.x - minX) * 10) / 10, y: Math.round((q.y - minY) * 10) / 10, p: Math.round(q.p * 100) / 100 })) })),
  };
}
