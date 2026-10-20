import { useCallback, useEffect, useMemo, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { useBook } from '../data/bookStore';
import { saveNow } from '../data/sync';
import { useLibrary } from '../library/useLibrary';
import { bookSlots, monthTabs, spreadCount, spreadOf, type BookSlot } from '../model/book';
import { PAGE_H, PAGE_W } from '../model/page';
import { t } from '../strings/en';
import { useReducedMotion } from '../ui/motion';
import { BookPage } from './BookPage';
import { ensureEntry, goToToday } from './entries';
import { JournalFrame, type FrameTab } from './JournalFrame';
import { PageTurn, type TurnSpec } from './PageTurn';
import { SaveMark } from './SaveMark';
import s from './Book.module.css';

type Layout = 'spread' | 'single';

interface Turn {
  dir: 'next' | 'prev';
  spec: TurnSpec;
}

const MONTH = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });
const TAB_COLORS = ['#ecc977', '#bcd1a8', '#eab7b0', '#b7cfe6', '#d8c3e6', '#f2c49b'];
const CORNER = 96;

/** The open journal: the current spread (or page), page turns, tabs and ribbon. */
export function Book({ layout }: { layout: Layout }) {
  const index = useBook((st) => st.index);
  const slot = useBook((st) => st.slot);
  const setSlot = useBook((st) => st.setSlot);
  const journal = useBook((st) => st.journal);
  const holdingTool = useBook((st) => st.mode === 'decorate' && st.tool !== null);
  const ready = useLibrary((st) => st.ready);
  const reducedMotion = useReducedMotion();
  const [turn, setTurn] = useState<Turn | null>(null);

  const slots = useMemo(() => bookSlots(index), [index]);
  const last = slots.length - 1;
  const spread = spreadOf(Math.min(slot, last));
  const step = layout === 'spread' ? 2 : 1;
  const cur = layout === 'spread' ? spread * 2 : Math.min(slot, last);

  // Keep the slot inside the book as entries come and go.
  useEffect(() => {
    if (slot > last) setSlot(last);
  }, [slot, last, setSlot]);

  // Load the entries on screen and the ones a turn away.
  useEffect(() => {
    for (let k = cur - step * 2; k < cur + step * 3; k++) {
      const sl = slots[k];
      if (sl?.kind === 'page') void ensureEntry(sl.entryId).catch(() => undefined);
    }
  }, [slots, cur, step]);

  const canNext = layout === 'spread' ? spread < spreadCount(slots) - 1 : cur < last;
  const canPrev = cur > 0;

  const settle = useCallback(() => {
    // A page turn is a good moment to save.
    for (const e of Object.values(useBook.getState().entries)) if (e.rev > e.savedRev) void saveNow(e.id);
  }, []);

  const begin = useCallback(
    (dir: 'next' | 'prev', corner: 'top' | 'bottom', pointerId?: number, start?: { x: number; y: number }) => {
      if (turn || (dir === 'next' ? !canNext : !canPrev)) return;
      const cy = corner === 'top' ? 0 : PAGE_H;
      const mirrored = layout === 'spread' && dir === 'prev';
      // Single pages turning back: the previous page returns from the left.
      const backwardSingle = layout === 'single' && dir === 'prev';
      const spec: TurnSpec = {
        mirrored,
        corner,
        start: start ?? (backwardSingle ? { x: -PAGE_W, y: cy } : { x: PAGE_W - 1, y: cy - (corner === 'top' ? -1 : 1) }),
        done: backwardSingle ? 'flat' : 'turned',
        ...(pointerId !== undefined ? { pointerId } : {}),
      };
      settle();
      setTurn({ dir, spec });
    },
    [turn, canNext, canPrev, layout, settle],
  );

  const finish = useCallback(
    (done: boolean) => {
      if (done && turn) setSlot(turn.dir === 'next' ? cur + step : Math.max(0, cur - step));
      setTurn(null);
    },
    [turn, cur, step, setSlot],
  );

  // Arrow keys turn pages when you're not typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTyping(e)) return;
      if (useBook.getState().selected) return; // arrows nudge the selected decoration instead
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        begin('next', 'bottom');
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        begin('prev', 'bottom');
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        goToToday();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [begin]);

  if (!journal || !ready) return null;

  // What lies where while settled, and while a leaf is turning.
  const at = (k: number): BookSlot | undefined => (k >= 0 ? slots[k] : undefined);
  let left: ReactNode;
  let right: ReactNode;
  let above: ReactNode = null;
  if (layout === 'spread') {
    const L = cur;
    const R = cur + 1;
    if (turn?.dir === 'next') {
      left = <BookPage slot={at(L)} side="left" live={false} />;
      right = <BookPage slot={at(R + 2)} side="right" live={false} />;
      above = (
        <PageTurn spec={turn.spec} x={PAGE_W} reducedMotion={reducedMotion} onFinish={finish} front={<BookPage slot={at(R)} side="right" live={false} />} back={<BookPage slot={at(L + 2)} side="left" live={false} />} />
      );
    } else if (turn?.dir === 'prev') {
      left = <BookPage slot={at(L - 2)} side="left" live={false} />;
      right = <BookPage slot={at(R)} side="right" live={false} />;
      above = (
        <PageTurn spec={turn.spec} x={0} reducedMotion={reducedMotion} onFinish={finish} front={<BookPage slot={at(L)} side="left" live={false} />} back={<BookPage slot={at(R - 2)} side="right" live={false} />} />
      );
    } else {
      left = <BookPage slot={at(L)} side="left" live />;
      right = <BookPage slot={at(R)} side="right" live />;
    }
  } else {
    const reverse = <div className={s.reverse} style={{ width: PAGE_W, height: PAGE_H }} />;
    if (turn?.dir === 'next') {
      right = <BookPage slot={at(cur + 1)} side="single" live={false} />;
      above = <PageTurn spec={turn.spec} x={0} reducedMotion={reducedMotion} onFinish={finish} front={<BookPage slot={at(cur)} side="single" live={false} />} back={reverse} />;
    } else if (turn?.dir === 'prev') {
      right = <BookPage slot={at(cur)} side="single" live={false} />;
      above = <PageTurn spec={turn.spec} x={0} reducedMotion={reducedMotion} onFinish={finish} front={<BookPage slot={at(cur - 1)} side="single" live={false} />} back={reverse} />;
    } else {
      right = <BookPage slot={at(cur)} side="single" live />;
    }
  }

  const tabs: FrameTab[] = monthTabs(slots).map((tab, i) => {
    const [y, m] = tab.month.split('-').map(Number);
    const label = MONTH.format(new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1, 1)));
    const before = tab.slot < cur;
    const side: 'left' | 'right' = layout === 'single' ? 'right' : before || (tab.slot === cur && cur % 2 === 0) ? 'left' : 'right';
    return { key: tab.month, label, color: TAB_COLORS[i % TAB_COLORS.length]!, y: 60 + ((m ?? 1) - 1) * 58, side, onClick: () => setSlot(tab.slot) };
  });

  const sheets = { left: Math.max(0, cur), right: Math.max(0, last - cur) };

  // With tape or a sticker in hand the corners are for decorating (taping a
  // page corner is the classic move), so they don't peel the page then.
  const corners = !turn && !holdingTool && (
    <>
      {canPrev && (
        <>
          <CornerHotspot side="left" corner="top" layout={layout} onStart={begin} />
          <CornerHotspot side="left" corner="bottom" layout={layout} onStart={begin} />
        </>
      )}
      {canNext && (
        <>
          <CornerHotspot side="right" corner="top" layout={layout} onStart={begin} />
          <CornerHotspot side="right" corner="bottom" layout={layout} onStart={begin} />
        </>
      )}
    </>
  );

  return (
    <JournalFrame
      layout={layout}
      cover={journal.cover}
      sheets={sheets}
      left={left}
      right={right}
      above={
        <>
          {above}
          {corners}
        </>
      }
      tabs={tabs}
      onRibbon={goToToday}
      status={<SaveMark />}
    />
  );
}

/** Invisible corners you can grab to peel a page, with a little lift on hover. */
function CornerHotspot({ side, corner, layout, onStart }: { side: 'left' | 'right'; corner: 'top' | 'bottom'; layout: Layout; onStart: (dir: 'next' | 'prev', corner: 'top' | 'bottom', pointerId?: number, start?: { x: number; y: number }) => void }) {
  const pageLeft = layout === 'spread' && side === 'right' ? PAGE_W : 0;
  const x = side === 'right' ? pageLeft + PAGE_W - CORNER : 0;
  const y = corner === 'top' ? 0 : PAGE_H - CORNER;
  const down = (e: RPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    const r = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    const k = (layout === 'spread' ? PAGE_W * 2 : PAGE_W) / r.width;
    const px = (e.clientX - r.left) * k;
    const py = (e.clientY - r.top) * k;
    if (side === 'right') onStart('next', corner, e.pointerId, { x: px - pageLeft, y: py });
    else if (layout === 'spread') onStart('prev', corner, e.pointerId, { x: PAGE_W - px, y: py });
    else onStart('prev', corner, e.pointerId, { x: -PAGE_W + px, y: py });
  };
  return (
    <button
      type="button"
      className={s.corner}
      data-side={side}
      data-corner={corner}
      style={{ left: x, top: y, width: CORNER, height: CORNER }}
      onPointerDown={down}
      onClick={(e) => {
        if (e.detail === 0) onStart(side === 'right' ? 'next' : 'prev', corner);
      }}
      aria-label={side === 'right' ? t.journal.nextPage : t.journal.prevPage}
    />
  );
}

function isTyping(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
}
