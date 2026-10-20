import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react';
import { useBook } from '../data/bookStore';
import { PAGE_W } from '../model/page';
import { angleOf, contains, corners, resizeFromCorner, snapAngle, tapeBetween, twoFinger, type Box, type Corner, type Point } from '../model/transform';
import type { Decoration, PageDoc } from '../model/types';
import { t } from '../strings/en';
import { addDecoration, duplicateDecoration, patchDecoration, removeDecoration, restack, stickerAt, tapeBox, updateBox } from './decorate';
import s from './DecorationEditor.module.css';

type Gesture =
  | { kind: 'move'; id: string; start: Point; box: Box }
  | { kind: 'resize'; id: string; corner: Corner; box: Box; keep: boolean }
  | { kind: 'rotate'; id: string; box: Box; start: number }
  | { kind: 'pinch'; id: string; a: number; b: number; start: { a: Point; b: Point; box: Box } }
  | { kind: 'tape'; asset: string; width: number; start: Point };

interface Props {
  entryId: string;
  pageId: string;
  page: PageDoc;
  /** Live box of the decoration being dragged (drawn by the page). */
  onDraft(draft: { id: string; box: Box } | null): void;
  /** Starts the crumple animation; resolves when it's over. */
  onToss(id: string): Promise<void>;
}

const KEEP_ASPECT = new Set(['sticker', 'photo', 'stamp']);

const label = (d: Decoration) =>
  ({ sticker: t.decor.sticker, tape: t.decor.tape, photo: t.decor.photo, drawing: t.decor.drawing, stamp: t.decor.sticker, paper: t.decor.note, text: t.decor.note })[d.type];

/** Decorate mode for one page: select, move, resize, turn, lay tape, place stickers. */
export function DecorationEditor({ entryId, pageId, page, onDraft, onToss }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const selectedId = useBook((st) => (st.selected?.pageId === pageId ? st.selected.decoId : null));
  const tool = useBook((st) => st.tool);
  const select = useBook((st) => st.select);
  const [draft, setDraft] = useState<{ id: string; box: Box } | null>(null);
  const [tapePreview, setTapePreview] = useState<Box | null>(null);
  const [ui, setUi] = useState(1);
  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Map<number, Point>());
  // The latest drag result, read when the pointer lifts. (State can still be
  // one move behind on a quick flick: React may not have re-rendered yet.)
  const latest = useRef<{ id: string; box: Box } | null>(null);

  // Handles keep a steady size on screen whatever the zoom.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setUi(PAGE_W / Math.max(1, el.getBoundingClientRect().width));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  useEffect(() => () => onDraft(null), [onDraft]);

  const toPage = (e: { clientX: number; clientY: number }): Point => {
    const r = ref.current!.getBoundingClientRect();
    const k = PAGE_W / r.width;
    return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k };
  };

  const byStack = [...page.decorations].sort((a, b) => (a.layer === b.layer ? b.z - a.z : a.layer === 'front' ? -1 : 1));
  const hit = (p: Point) => byStack.find((d) => contains(d, p, 6 * ui)) ?? null;
  const selected = page.decorations.find((d) => d.id === selectedId) ?? null;
  const shown: Box | null = selected ? (draft?.id === selected.id ? draft.box : selected) : null;

  const live = (id: string, box: Box) => {
    latest.current = { id, box };
    setDraft({ id, box });
    onDraft({ id, box });
  };

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const p = toPage(e);
    ref.current!.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, p);
    e.preventDefault();

    if (pointers.current.size === 2 && selected && !selected.locked) {
      const [a, b] = [...pointers.current.entries()];
      gesture.current = { kind: 'pinch', id: selected.id, a: a![0], b: b![0], start: { a: a![1], b: b![1], box: shown! } };
      return;
    }
    if (tool?.kind === 'tape') {
      gesture.current = { kind: 'tape', asset: tool.asset, width: tool.width, start: p };
      return;
    }
    if (tool?.kind === 'sticker') {
      addDecoration(entryId, pageId, stickerAt(tool.asset, tool.size, p));
      return;
    }
    const handle = (e.target as HTMLElement).closest<HTMLElement>('[data-handle]')?.dataset.handle;
    if (handle && selected && !selected.locked) {
      if (handle === 'rotate') gesture.current = { kind: 'rotate', id: selected.id, box: { ...selected }, start: angleOf(selected, p) };
      else gesture.current = { kind: 'resize', id: selected.id, corner: handle as Corner, box: { ...selected }, keep: KEEP_ASPECT.has(selected.type) };
      return;
    }
    const d = hit(p);
    if (!d) {
      select(null);
      return;
    }
    select({ entryId, pageId, decoId: d.id });
    if (!d.locked) gesture.current = { kind: 'move', id: d.id, start: p, box: { x: d.x, y: d.y, w: d.w, h: d.h, rot: d.rot } };
  };

  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = toPage(e);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    if (!g) return;
    switch (g.kind) {
      case 'move':
        live(g.id, { ...g.box, x: g.box.x + p.x - g.start.x, y: g.box.y + p.y - g.start.y });
        break;
      case 'resize':
        live(g.id, resizeFromCorner(g.box, g.corner, p, g.keep, 20));
        break;
      case 'rotate':
        live(g.id, { ...g.box, rot: snapAngle(g.box.rot + angleOf(g.box, p) - g.start) });
        break;
      case 'pinch': {
        const a = pointers.current.get(g.a);
        const b = pointers.current.get(g.b);
        if (a && b) live(g.id, twoFinger(g.start, { a, b }));
        break;
      }
      case 'tape':
        setTapePreview(tapeBetween(g.start, p, g.width));
        break;
    }
  };

  const finish = (e: RPointerEvent<HTMLDivElement>) => {
    const last = pointers.current.get(e.pointerId);
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (!g || (g.kind === 'pinch' && pointers.current.size > 0)) return;
    gesture.current = null;
    if (g.kind === 'tape') {
      // Laid from where the drag started to where it let go.
      const box = tapeBetween(g.start, e.type === 'pointercancel' && last ? last : toPage(e), g.width);
      setTapePreview(null);
      if (box.w > 30) addDecoration(entryId, pageId, tapeBox(g.asset, box));
      return;
    }
    const moved = latest.current;
    latest.current = null;
    if (moved && moved.id === g.id) updateBox(entryId, pageId, g.id, moved.box);
    setDraft(null);
    onDraft(null);
  };

  const toss = async (id: string) => {
    await onToss(id);
    removeDecoration(entryId, pageId, id);
  };

  const handle = 30 * ui;
  const frame = shown ? frameStyle(shown, ui) : null;
  const cs = shown ? corners(shown) : null;
  return (
    <div
      ref={ref}
      className={`${s.layer} ${tool?.kind === 'tape' ? s.taping : ''} ${tool?.kind === 'sticker' ? s.placing : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      style={{ '--ui': ui } as CSSProperties}
    >
      {/* Keyboard and screen-reader access to every decoration. */}
      <ul className={s.srList} aria-label={t.decor.menu}>
        {byStack.map((d) => (
          <li key={d.id}>
            <button type="button" onFocus={() => select({ entryId, pageId, decoId: d.id })} aria-pressed={d.id === selectedId}>
              {label(d)}
            </button>
          </li>
        ))}
      </ul>

      {tapePreview && <div className={s.tapeGhost} style={frameStyle(tapePreview, ui)} />}

      {selected && shown && frame && cs && (
        <>
          <div className={`${s.frame} ${selected.locked ? s.glued : ''}`} style={frame} aria-hidden="true">
            {!selected.locked && (
              <span className={s.stalk} style={{ height: 34 * ui }}>
                <span className={s.rotate} data-handle="rotate" style={{ width: handle * 1.1, height: handle * 1.1 }} title={t.decor.rotate} />
              </span>
            )}
          </div>
          {!selected.locked &&
            (Object.keys(cs) as Corner[]).map((c) => (
              <span key={c} className={s.corner} data-handle={c} style={{ left: cs[c].x, top: cs[c].y, width: handle, height: handle }} title={t.decor.resize} />
            ))}
          <DecorationMenu deco={selected} box={shown} ui={ui} onAction={(a) => act(a, selected)} />
        </>
      )}
    </div>
  );

  function act(action: string, d: Decoration) {
    switch (action) {
      case 'forward':
        restack(entryId, pageId, d.id, 1);
        break;
      case 'backward':
        restack(entryId, pageId, d.id, -1);
        break;
      case 'layer':
        patchDecoration(entryId, pageId, d.id, { layer: d.layer === 'front' ? 'back' : 'front' });
        break;
      case 'flip':
        patchDecoration(entryId, pageId, d.id, { flipX: !d.flipX });
        break;
      case 'lock':
        patchDecoration(entryId, pageId, d.id, { locked: !d.locked });
        break;
      case 'duplicate':
        duplicateDecoration(entryId, pageId, d.id);
        break;
      case 'delete':
        void toss(d.id);
        break;
    }
  }
}

function frameStyle(b: Box, ui: number): CSSProperties {
  const pad = 6 * ui;
  return { left: b.x - b.w / 2 - pad, top: b.y - b.h / 2 - pad, width: b.w + pad * 2, height: b.h + pad * 2, transform: `rotate(${b.rot}deg)` };
}

const ACTIONS: { id: string; label: (d: Decoration) => string; icon: string }[] = [
  { id: 'forward', label: () => t.decor.forward, icon: 'M5 15l7-7 7 7' },
  { id: 'backward', label: () => t.decor.backward, icon: 'M5 9l7 7 7-7' },
  { id: 'layer', label: (d) => (d.layer === 'front' ? t.decor.behindText : t.decor.overText), icon: 'M4 8h16M4 12h10M4 16h16' },
  { id: 'flip', label: () => t.decor.flip, icon: 'M12 3v18M8 7l-4 5 4 5M16 7l4 5-4 5' },
  { id: 'lock', label: (d) => (d.locked ? t.decor.unlock : t.decor.lock), icon: 'M7 11V8a5 5 0 0110 0v3M6 11h12v9H6z' },
  { id: 'duplicate', label: () => t.decor.duplicate, icon: 'M8 8h11v11H8zM5 16V5h11' },
  { id: 'delete', label: () => t.decor.delete, icon: 'M6 7h12l-1.5 13h-9zM9 7V4h6v3M4 7h16' },
];

function DecorationMenu({ deco, box, ui, onAction }: { deco: Decoration; box: Box; ui: number; onAction(a: string): void }) {
  const ext = Math.abs(box.w * Math.sin((box.rot * Math.PI) / 180)) + Math.abs(box.h * Math.cos((box.rot * Math.PI) / 180));
  const top = box.y - ext / 2 - 64 * ui;
  const style: CSSProperties = { left: box.x, top: Math.max(8 * ui, top), transform: `translateX(-50%) scale(${ui})` };
  return (
    <div className={s.menu} style={style} role="toolbar" aria-label={t.decor.menu} onPointerDown={(e) => e.stopPropagation()}>
      {ACTIONS.map((a) => (
        <button key={a.id} type="button" className={s.menuBtn} onClick={() => onAction(a.id)} aria-label={a.label(deco)} title={a.label(deco)} data-active={(a.id === 'lock' && deco.locked) || (a.id === 'layer' && deco.layer === 'back') ? '' : undefined}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={a.icon} />
          </svg>
        </button>
      ))}
    </div>
  );
}
