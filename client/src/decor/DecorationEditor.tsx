import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent, type RefObject } from 'react';
import { assetSrc, pictureRatio } from '../data/assets';
import { useBook } from '../data/bookStore';
import { PAGE_H, PAGE_W } from '../model/page';
import { DEFAULT_CROP, DEFAULT_RATIO, MAX_PHOTO_ZOOM, PHOTO_FRAMES, panCrop, photoLayout, zoomCropAt, type Crop, type Rect } from '../model/photo';
import { angleOf, contains, corners, resizeFromCorner, snapAngle, tapeBetween, twoFinger, type Box, type Corner, type Point } from '../model/transform';
import type { Decoration, PageDoc, PhotoFrame } from '../model/types';
import { t } from '../strings/en';
import { addDecoration, arrangePhoto, duplicateDecoration, patchDecoration, reframePhoto, removeDecoration, restack, stickerAt, tapeBox, updateBox, type DecoDraft } from './decorate';
import { PHOTO_FILTERS, pictureSize } from './DecorationView';
import { FrameIcon } from './FrameIcon';
import s from './DecorationEditor.module.css';

type Photo = Extract<Decoration, { type: 'photo' }>;

type Gesture =
  | { kind: 'move'; id: string; start: Point; box: Box }
  | { kind: 'resize'; id: string; corner: Corner; box: Box; keep: boolean }
  | { kind: 'rotate'; id: string; box: Box; start: number }
  | { kind: 'pinch'; id: string; a: number; b: number; start: { a: Point; b: Point; box: Box } }
  | { kind: 'tape'; asset: string; width: number; start: Point }
  // Arranging a photo in its frame: sliding the picture, or pinching it closer.
  | { kind: 'slide'; id: string; start: Point; crop: Crop }
  | { kind: 'zoom'; id: string; a: number; b: number; start: { a: Point; b: Point; crop: Crop } };

interface Props {
  entryId: string;
  pageId: string;
  page: PageDoc;
  /** Live state of the decoration being dragged or arranged (drawn by the page). */
  onDraft(draft: DecoDraft | null): void;
  /** Starts the crumple animation; resolves when it's over. */
  onToss(id: string): Promise<void>;
}

const KEEP_ASPECT = new Set(['sticker', 'photo', 'stamp']);

const label = (d: Decoration) =>
  ({ sticker: t.decor.sticker, tape: t.decor.tape, photo: t.decor.photo, drawing: t.decor.drawing, stamp: t.decor.sticker, paper: t.decor.note, text: t.decor.note })[d.type];

/** A point on the page in a decoration's own units: from its top left, unturned and unflipped. */
function toLocal(d: Box & { flipX?: boolean }, p: Point): Point {
  const l = turnBack(d, p.x - d.x, p.y - d.y);
  return { x: l.x + d.w / 2, y: l.y + d.h / 2 };
}

/** A movement on the page as seen by a turned (and maybe flipped) decoration. */
function turnBack(d: Box & { flipX?: boolean }, dx: number, dy: number): Point {
  const r = (-d.rot * Math.PI) / 180;
  const x = dx * Math.cos(r) - dy * Math.sin(r);
  return { x: d.flipX ? -x : x, y: dx * Math.sin(r) + dy * Math.cos(r) };
}

const within = (p: Point, r: Rect) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

/** Decorate mode for one page: select, move, resize, turn, lay tape, place stickers, arrange photos. */
export function DecorationEditor({ entryId, pageId, page, onDraft, onToss }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const selectedId = useBook((st) => (st.selected?.pageId === pageId ? st.selected.decoId : null));
  const tool = useBook((st) => st.tool);
  const select = useBook((st) => st.select);
  const [draft, setDraft] = useState<DecoDraft | null>(null);
  const [tapePreview, setTapePreview] = useState<Box | null>(null);
  const [ui, setUi] = useState(1);
  /** The photo being arranged in its frame, and its picture's shape. */
  const [arranging, setArranging] = useState<{ id: string; ratio: number } | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Map<number, Point>());
  // The latest drag result, read when the pointer lifts. (State can still be
  // one move behind on a quick flick: React may not have re-rendered yet.)
  const latest = useRef<DecoDraft | null>(null);
  // A press that let go without moving, for telling a double tap.
  const press = useRef<{ id: string; p: Point; at: number } | null>(null);
  const lastTap = useRef<{ id: string; p: Point; at: number } | null>(null);
  // Wheel, slider and key changes to a photo's arrangement are saved a moment after they stop.
  const pending = useRef<{ id: string; crop: Crop; ratio: number; timer: number } | null>(null);

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

  const flushCrop = useCallback(() => {
    const p = pending.current;
    if (!p) return;
    window.clearTimeout(p.timer);
    pending.current = null;
    arrangePhoto(entryId, pageId, p.id, p.crop, p.ratio);
    latest.current = null;
    setDraft(null);
    onDraft(null);
  }, [entryId, pageId, onDraft]);

  useEffect(
    () => () => {
      flushCrop();
      onDraft(null);
    },
    [flushCrop, onDraft],
  );

  const toPage = (e: { clientX: number; clientY: number }): Point => {
    const r = ref.current!.getBoundingClientRect();
    const k = PAGE_W / r.width;
    return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k };
  };

  const byStack = [...page.decorations].sort((a, b) => (a.layer === b.layer ? b.z - a.z : a.layer === 'front' ? -1 : 1));
  const hit = (p: Point) => byStack.find((d) => contains(d, p, 6 * ui)) ?? null;
  const selected = page.decorations.find((d) => d.id === selectedId) ?? null;
  const shown: Box | null = selected ? (draft?.id === selected.id ? draft.box : selected) : null;

  // The photo being arranged (arranging stops when it's no longer selected, or a tool is picked up).
  const photo: Photo | null = arranging && !tool && selected?.id === arranging.id && selected.type === 'photo' ? selected : null;
  const ratio = arranging?.ratio ?? DEFAULT_RATIO;
  const cropOf = (d: Photo): Crop => (draft?.id === d.id && draft.crop) || d.crop || DEFAULT_CROP;
  const arrangement = photo ? { photo, ratio, crop: cropOf(photo), layout: photoLayout(photo.frame, photo.w, photo.h, ratio, cropOf(photo)) } : null;
  // For the wheel and keys, which listen outside React.
  const current = useRef(arrangement);
  current.current = arrangement;

  useEffect(() => {
    if (arranging && !photo) {
      flushCrop();
      setArranging(null);
    }
  }, [arranging, photo, flushCrop]);

  const live = (next: DecoDraft) => {
    latest.current = next;
    setDraft(next);
    onDraft(next);
  };

  const showCrop = (d: Photo, crop: Crop, r: number) => live({ id: d.id, box: { x: d.x, y: d.y, w: d.w, h: d.h, rot: d.rot }, crop, ratio: r });

  /** Shows a new arrangement now and saves it once things settle. */
  const arrangeSoon = (d: Photo, crop: Crop, r: number) => {
    showCrop(d, crop, r);
    if (current.current) current.current = { ...current.current, crop };
    if (pending.current) window.clearTimeout(pending.current.timer);
    pending.current = { id: d.id, crop, ratio: r, timer: window.setTimeout(flushCrop, 350) };
  };

  const startArranging = async (d: Photo) => {
    if (d.locked) return;
    const r = d.ratio ?? (await pictureRatio(d.asset)) ?? DEFAULT_RATIO;
    if (useBook.getState().selected?.decoId !== d.id) return;
    setArranging({ id: d.id, ratio: r });
  };

  const stopArranging = () => {
    flushCrop();
    setArranging(null);
  };

  const arrangingId = photo?.id ?? null;
  // The arranging strip takes the keyboard (for arrow keys and the slider).
  useEffect(() => {
    if (arrangingId) stripRef.current?.focus({ preventScroll: true });
  }, [arrangingId]);

  // While arranging: the wheel (and a trackpad pinch) over the picture zooms it, not the desk.
  useEffect(() => {
    const el = ref.current;
    if (!el || !arrangingId) return;
    const onWheel = (e: WheelEvent) => {
      const a = current.current;
      if (!a) return;
      const local = toLocal(a.photo, toPage(e));
      if (!within(local, a.layout.picture) && !within(local, { x: 0, y: 0, w: a.photo.w, h: a.photo.h })) return;
      e.preventDefault();
      e.stopPropagation();
      const win = a.layout.window;
      const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : e.ctrlKey ? 0.012 : 0.0022));
      const crop = zoomCropAt(win.w / win.h, a.ratio, a.crop, a.crop.zoom * factor, (local.x - win.x) / win.w, (local.y - win.y) / win.h);
      arrangeSoon(a.photo, crop, a.ratio);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [arrangingId]);

  // While arranging: arrows slide the picture, + and - zoom, 0 resets, Esc or Enter is done.
  useEffect(() => {
    if (!arrangingId) return;
    const onKey = (e: KeyboardEvent) => {
      const a = current.current;
      if (!a) return;
      if (e.ctrlKey || e.metaKey || e.altKey) {
        // Undo and friends: save what's waiting first, so they see it.
        flushCrop();
        return;
      }
      const el = e.target as HTMLElement | null;
      const onSlider = el?.tagName === 'INPUT';
      const win = a.layout.window;
      const aspect = win.w / win.h;
      const step = e.shiftKey ? 0.1 : 0.025;
      const slide = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      let crop: Crop | null = null;
      if (e.key === 'Escape' || (e.key === 'Enter' && el?.tagName !== 'BUTTON')) {
        stopArranging();
      } else if (slide && !onSlider) {
        crop = panCrop(aspect, a.ratio, a.crop, slide[0]!, slide[1]!);
      } else if (e.key === '+' || e.key === '=') {
        crop = zoomCropAt(aspect, a.ratio, a.crop, a.crop.zoom * 1.15);
      } else if (e.key === '-' || e.key === '_') {
        crop = zoomCropAt(aspect, a.ratio, a.crop, a.crop.zoom / 1.15);
      } else if (e.key === '0') {
        crop = DEFAULT_CROP;
      } else if (e.key !== 'Delete' && e.key !== 'Backspace') {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (crop) arrangeSoon(a.photo, crop, a.ratio);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [arrangingId]);

  /** A second quick tap, close to the first, on the same thing. */
  const doubleTap = (id: string, p: Point) => {
    const last = lastTap.current;
    lastTap.current = null;
    return !!last && last.id === id && performance.now() - last.at < 450 && Math.hypot(p.x - last.p.x, p.y - last.p.y) < 16 * ui;
  };

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const p = toPage(e);
    ref.current!.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, p);
    e.preventDefault();
    press.current = null;

    if (photo && arrangement) {
      flushCrop();
      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.entries()];
        gesture.current = { kind: 'zoom', id: photo.id, a: a![0], b: b![0], start: { a: a![1], b: b![1], crop: arrangement.crop } };
        return;
      }
      const local = toLocal(photo, p);
      if (within(local, arrangement.layout.picture) || within(local, { x: 0, y: 0, w: photo.w, h: photo.h })) {
        if (doubleTap(photo.id, p)) {
          stopArranging();
          return;
        }
        press.current = { id: photo.id, p, at: performance.now() };
        gesture.current = { kind: 'slide', id: photo.id, start: p, crop: arrangement.crop };
        return;
      }
      // Pressing anywhere else puts the photo down, then carries on as usual.
      stopArranging();
    }

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
    // Tapping a photo twice opens it for arranging in its frame.
    if (d.type === 'photo' && !d.locked && doubleTap(d.id, p)) {
      void startArranging(d);
      return;
    }
    press.current = { id: d.id, p, at: performance.now() };
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
        if (Math.hypot(p.x - g.start.x, p.y - g.start.y) > 3 * ui) press.current = null;
        live({ id: g.id, box: { ...g.box, x: g.box.x + p.x - g.start.x, y: g.box.y + p.y - g.start.y } });
        break;
      case 'resize':
        live({ id: g.id, box: resizeFromCorner(g.box, g.corner, p, g.keep, 20) });
        break;
      case 'rotate':
        live({ id: g.id, box: { ...g.box, rot: snapAngle(g.box.rot + angleOf(g.box, p) - g.start) } });
        break;
      case 'pinch': {
        const a = pointers.current.get(g.a);
        const b = pointers.current.get(g.b);
        if (a && b) live({ id: g.id, box: twoFinger(g.start, { a, b }) });
        break;
      }
      case 'tape':
        setTapePreview(tapeBetween(g.start, p, g.width));
        break;
      case 'slide': {
        if (!photo || photo.id !== g.id) break;
        const win = photoLayout(photo.frame, photo.w, photo.h, ratio, g.crop).window;
        const l = turnBack(photo, p.x - g.start.x, p.y - g.start.y);
        if (Math.hypot(l.x, l.y) > 3 * ui) press.current = null;
        showCrop(photo, panCrop(win.w / win.h, ratio, g.crop, l.x / win.w, l.y / win.h), ratio);
        break;
      }
      case 'zoom': {
        const a = pointers.current.get(g.a);
        const b = pointers.current.get(g.b);
        if (!a || !b || !photo || photo.id !== g.id) break;
        const win = photoLayout(photo.frame, photo.w, photo.h, ratio, g.start.crop).window;
        const aspect = win.w / win.h;
        const from = { x: (g.start.a.x + g.start.b.x) / 2, y: (g.start.a.y + g.start.b.y) / 2 };
        const to = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const spread = Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, Math.hypot(g.start.a.x - g.start.b.x, g.start.a.y - g.start.b.y));
        const at = toLocal(photo, from);
        const zoomed = zoomCropAt(aspect, ratio, g.start.crop, g.start.crop.zoom * spread, (at.x - win.x) / win.w, (at.y - win.y) / win.h);
        const l = turnBack(photo, to.x - from.x, to.y - from.y);
        showCrop(photo, panCrop(aspect, ratio, zoomed, l.x / win.w, l.y / win.h), ratio);
        break;
      }
    }
  };

  const finish = (e: RPointerEvent<HTMLDivElement>) => {
    const last = pointers.current.get(e.pointerId);
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (!g || ((g.kind === 'pinch' || g.kind === 'zoom') && pointers.current.size > 0)) return;
    gesture.current = null;
    if (g.kind === 'tape') {
      // Laid from where the drag started to where it let go.
      const box = tapeBetween(g.start, e.type === 'pointercancel' && last ? last : toPage(e), g.width);
      setTapePreview(null);
      if (box.w > 30) addDecoration(entryId, pageId, tapeBox(g.asset, box));
      return;
    }
    // A quick press that (hardly) moved is a tap: it changes nothing, and two make a double tap.
    const tap = press.current;
    press.current = null;
    lastTap.current = tap && performance.now() - tap.at < 350 ? { ...tap, at: performance.now() } : null;
    const moved = latest.current;
    latest.current = null;
    if (moved && moved.id === g.id && !tap) {
      if (g.kind === 'slide' || g.kind === 'zoom') {
        if (moved.crop) arrangePhoto(entryId, pageId, g.id, moved.crop, ratio);
      } else {
        updateBox(entryId, pageId, g.id, moved.box);
      }
    }
    setDraft(null);
    onDraft(null);
  };

  const toss = async (id: string) => {
    await onToss(id);
    removeDecoration(entryId, pageId, id);
  };

  const zoomTo = (zoom: number) => {
    const a = current.current;
    if (!a) return;
    const win = a.layout.window;
    arrangeSoon(a.photo, zoomCropAt(win.w / win.h, a.ratio, a.crop, zoom), a.ratio);
  };

  const handle = 30 * ui;
  const frame = shown ? frameStyle(shown, ui) : null;
  const cs = shown ? corners(shown) : null;
  return (
    <div
      ref={ref}
      className={`${s.layer} ${tool?.kind === 'tape' ? s.taping : ''} ${tool?.kind === 'sticker' ? s.placing : ''} ${photo ? s.arranging : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      style={{ '--ui': ui } as CSSProperties}
      // Two fingers here work the selected decoration, not the desk's zoom.
      data-own-pinch={selected && !selected.locked ? '' : undefined}
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

      {arrangement && (
        <>
          <ArrangeGuide photo={arrangement.photo} layout={arrangement.layout} busy={draft?.id === arrangement.photo.id && !!draft.crop} />
          <ArrangeStrip stripRef={stripRef} box={arrangement.photo} ui={ui} zoom={arrangement.crop.zoom} onZoom={zoomTo} onReset={() => arrangeSoon(arrangement.photo, DEFAULT_CROP, arrangement.ratio)} onDone={stopArranging} />
        </>
      )}

      {!arrangement && selected && shown && frame && cs && (
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
          <DecorationMenu key={selected.id} deco={selected} box={shown} ui={ui} onAction={(a) => act(a, selected)} onFrame={(f) => void reframePhoto(entryId, pageId, selected.id, f)} />
        </>
      )}
    </div>
  );

  function act(action: string, d: Decoration) {
    switch (action) {
      case 'arrange':
        if (d.type === 'photo') void startArranging(d);
        break;
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

/**
 * While a photo is being arranged: the whole picture shows faintly beyond
 * its window, so you can see what's left out, with thirds to compose by
 * while it moves.
 */
function ArrangeGuide({ photo, layout, busy }: { photo: Photo; layout: { window: Rect; picture: Rect }; busy: boolean }) {
  const { window: w, picture: p } = layout;
  const hx = w.x - p.x;
  const hy = w.y - p.y;
  // The picture minus the window (that part is drawn for real by the page).
  const hole = `polygon(evenodd, 0 0, ${p.w}px 0, ${p.w}px ${p.h}px, 0 ${p.h}px, 0 0, ${hx}px ${hy}px, ${hx + w.w}px ${hy}px, ${hx + w.w}px ${hy + w.h}px, ${hx}px ${hy + w.h}px, ${hx}px ${hy}px)`;
  const style: CSSProperties = {
    left: photo.x - photo.w / 2,
    top: photo.y - photo.h / 2,
    width: photo.w,
    height: photo.h,
    transform: `rotate(${photo.rot}deg)${photo.flipX ? ' scaleX(-1)' : ''}`,
  };
  return (
    <div className={s.arrange} style={style} aria-hidden="true">
      <img className={s.ghost} src={assetSrc(photo.asset, pictureSize(p))} alt="" draggable={false} style={{ left: p.x, top: p.y, width: p.w, height: p.h, clipPath: hole, filter: PHOTO_FILTERS[photo.filter] }} />
      <div className={`${s.windowLine} ${busy ? s.thirds : ''}`} style={{ left: w.x, top: w.y, width: w.w, height: w.h }} />
    </div>
  );
}

/** The menu strip's size on screen, in page units per `ui`. */
const MENU_H = 50;
const menuWidth = (buttons: number) => 40 * buttons + 32;
const ARRANGE_W = 372;
const ARRANGE_H = 84;

/**
 * Where a strip goes: above everything the selection shows, including the
 * rotate handle on its stalk (which turns with the decoration), or below it
 * when the page has no room above. A strip too wide for a narrow page is
 * drawn a little smaller.
 */
function stripPlace(box: Box, ui: number, width: number, height: number, withHandle: boolean): CSSProperties {
  const k = Math.min(ui, (PAGE_W - 8 * ui) / width);
  const r = (box.rot * Math.PI) / 180;
  const ext = Math.abs(box.w * Math.sin(r)) + Math.abs(box.h * Math.cos(r));
  let top = box.y - ext / 2;
  let bottom = box.y + ext / 2;
  if (withHandle) {
    // Frame padding + stalk + the handle's own size (see .stalk and .rotate).
    const handleY = box.y - Math.cos(r) * (box.h / 2 + (6 + 34 + 14) * ui);
    top = Math.min(top, handleY - 20 * ui);
    bottom = Math.max(bottom, handleY + 20 * ui);
  }
  const gap = 10 * ui;
  const half = (width * k) / 2;
  const left = Math.min(PAGE_W - half - 4 * ui, Math.max(half + 4 * ui, box.x));
  const transform = `translateX(-50%) scale(${k})`;
  return top - gap - height * k >= 4 * ui
    ? { left, bottom: PAGE_H - (top - gap), transform, transformOrigin: '50% 100%' }
    : { left, top: Math.min(PAGE_H - (height + 4) * k, bottom + gap), transform, transformOrigin: '50% 0' };
}

const ACTIONS: { id: string; label: (d: Decoration) => string; icon: string; photo?: boolean }[] = [
  { id: 'arrange', label: () => t.decor.arrange, icon: 'M7 3v14h14M3 7h14v14', photo: true },
  { id: 'frame', label: () => t.decor.frame, icon: 'M5 3h14v18H5zM8 6h8v8H8z', photo: true },
  { id: 'forward', label: () => t.decor.forward, icon: 'M5 15l7-7 7 7' },
  { id: 'backward', label: () => t.decor.backward, icon: 'M5 9l7 7 7-7' },
  { id: 'layer', label: (d) => (d.layer === 'front' ? t.decor.behindText : t.decor.overText), icon: 'M4 8h16M4 12h10M4 16h16' },
  { id: 'flip', label: () => t.decor.flip, icon: 'M12 3v18M8 7l-4 5 4 5M16 7l4 5-4 5' },
  { id: 'lock', label: (d) => (d.locked ? t.decor.unlock : t.decor.lock), icon: 'M7 11V8a5 5 0 0110 0v3M6 11h12v9H6z' },
  { id: 'duplicate', label: () => t.decor.duplicate, icon: 'M8 8h11v11H8zM5 16V5h11' },
  { id: 'delete', label: () => t.decor.delete, icon: 'M6 7h12l-1.5 13h-9zM9 7V4h6v3M4 7h16' },
];

/** The kraft strip of tools for the selected decoration; for a photo it also turns into a choice of frames. */
function DecorationMenu({ deco, box, ui, onAction, onFrame }: { deco: Decoration; box: Box; ui: number; onAction(a: string): void; onFrame(f: PhotoFrame): void }) {
  const [choosing, setChoosing] = useState(false);
  const actions = ACTIONS.filter((a) => !a.photo || (deco.type === 'photo' && !deco.locked));
  if (choosing && deco.type === 'photo') {
    return (
      <div className={s.menu} style={stripPlace(box, ui, menuWidth(PHOTO_FRAMES.length + 1) + 24, MENU_H + 6, !deco.locked)} role="toolbar" aria-label={t.decor.frame} onPointerDown={(e) => e.stopPropagation()}>
        <button type="button" className={s.menuBtn} onClick={() => setChoosing(false)} aria-label={t.decor.back} title={t.decor.back}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <div className={s.frames} role="radiogroup" aria-label={t.decor.frame}>
          {PHOTO_FRAMES.map((f) => (
            <button key={f} type="button" role="radio" aria-checked={deco.frame === f} className={`${s.menuBtn} ${s.frameBtn}`} data-active={deco.frame === f ? '' : undefined} onClick={() => onFrame(f)} aria-label={t.decor.frames[f]} title={t.decor.frames[f]}>
              <FrameIcon frame={f} />
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className={s.menu} style={stripPlace(box, ui, menuWidth(actions.length), MENU_H, !deco.locked)} role="toolbar" aria-label={t.decor.menu} onPointerDown={(e) => e.stopPropagation()}>
      {actions.map((a) => (
        <button
          key={a.id}
          type="button"
          className={s.menuBtn}
          onClick={() => (a.id === 'frame' ? setChoosing(true) : onAction(a.id))}
          aria-label={a.label(deco)}
          title={a.label(deco)}
          data-active={(a.id === 'lock' && deco.locked) || (a.id === 'layer' && deco.layer === 'back') ? '' : undefined}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={a.icon} />
          </svg>
        </button>
      ))}
    </div>
  );
}

/** While arranging a photo: how close to look, back to the start, and done. */
function ArrangeStrip({ stripRef, box, ui, zoom, onZoom, onReset, onDone }: { stripRef: RefObject<HTMLDivElement | null>; box: Box; ui: number; zoom: number; onZoom(z: number): void; onReset(): void; onDone(): void }) {
  const level = Math.round((Math.log(zoom) / Math.log(MAX_PHOTO_ZOOM)) * 100);
  return (
    <div
      ref={stripRef}
      tabIndex={-1}
      className={`${s.menu} ${s.arrangeStrip}`}
      style={stripPlace(box, ui, ARRANGE_W, ARRANGE_H, false)}
      role="group"
      aria-label={t.decor.arranging}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <p className={s.arrangeHint}>{t.decor.arrangeHint}</p>
      <div className={s.arrangeRow}>
        <button type="button" className={s.menuBtn} onClick={() => onZoom(zoom / 1.25)} aria-label={t.decor.zoomOut} title={t.decor.zoomOut}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6" />
            <path d="M8.5 11h5M16 16l4 4" />
          </svg>
        </button>
        <input
          type="range"
          className={s.zoomSlider}
          min={0}
          max={100}
          value={level}
          onChange={(e) => onZoom(Math.pow(MAX_PHOTO_ZOOM, Number(e.target.value) / 100))}
          aria-label={t.decor.photoZoom}
          aria-valuetext={t.zoom.level(zoom)}
        />
        <button type="button" className={s.menuBtn} onClick={() => onZoom(zoom * 1.25)} aria-label={t.decor.zoomIn} title={t.decor.zoomIn}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6" />
            <path d="M8.5 11h5M11 8.5v5M16 16l4 4" />
          </svg>
        </button>
        <button type="button" className={s.wordBtn} onClick={onReset}>
          {t.decor.arrangeReset}
        </button>
        <button type="button" className={`${s.wordBtn} ${s.doneBtn}`} onClick={onDone}>
          {t.decor.arrangeDone}
        </button>
      </div>
    </div>
  );
}
