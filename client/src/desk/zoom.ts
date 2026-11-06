// Looking closer: the magnifying glass zooms into the desk, and so do a
// trackpad pinch or Ctrl+wheel, and two fingers on a touch screen. While
// zoomed, the wheel or a drag on the desk moves around (on a touch screen a
// finger on the page you're writing on does too), and the view follows the
// caret as you write. On a phone, writing zooms in by itself. Tool panels
// keep their usual size (they sit outside the zoomed stage).

import { useEffect, useLayoutEffect, type RefObject } from 'react';
import { create } from 'zustand';
import { useBook } from '../data/bookStore';
import { useActiveEditor } from '../editor/activeEditor';
import { reducedMotion } from '../ui/motion';
import { flickOf, slowed, stageTransform, STOPPED, type Touch, type Zoom } from './camera';
import { useViewport, viewport } from './viewport';

export const MAX_ZOOM = 4;

/** During a pinch, wheel or drag the desk follows at once (no easing lag). */
let settle = 0;
function gesturing(): void {
  document.documentElement.dataset.zooming = '';
  window.clearTimeout(settle);
  settle = window.setTimeout(() => delete document.documentElement.dataset.zooming, 160);
}
const STEP = 1.25;

interface ZoomState {
  /**
   * null = the whole desk. `level` is relative to the fitted scale. `writing`:
   * zoomed in by itself for writing on a phone, and out again after.
   */
  zoom: Zoom | null;
  set(zoom: Zoom | null): void;
}

export const useZoom = create<ZoomState>((set) => ({
  zoom: null,
  set: (zoom) => set({ zoom }),
}));

interface View {
  stage: { w: number; h: number };
  fitted: number;
}

let view: View = { stage: { w: 1, h: 1 }, fitted: 1 };

/** The camera now in force: the zoom, or the whole desk. */
function current(): { level: number; x: number; y: number } {
  return useZoom.getState().zoom ?? { level: 1, x: view.stage.w / 2, y: view.stage.h / 2 };
}

/** Keeps the view on the desk: never past its edges, counting only what's above an on-screen keyboard. */
function clamp(level: number, x: number, y: number): { level: number; x: number; y: number } {
  const scale = view.fitted * level;
  const { w: W, h: H, top, bottom } = viewport();
  const hw = W / scale / 2;
  // How far the stage shows above and below the point at the middle of the window.
  const up = (H / 2 - top) / scale;
  const down = (bottom - H / 2) / scale;
  const { w, h } = view.stage;
  return {
    level,
    x: w > hw * 2 ? Math.min(w - hw, Math.max(hw, x)) : w / 2,
    y: h > up + down ? Math.min(h - down, Math.max(up, y)) : h / 2,
  };
}

/** Screen point → stage point under the current camera. */
export function toStage(sx: number, sy: number): { x: number; y: number } {
  const c = current();
  const scale = view.fitted * c.level;
  const { w, h } = viewport();
  return { x: c.x + (sx - w / 2) / scale, y: c.y + (sy - h / 2) / scale };
}

/** Zooms to `level`, keeping the stage point under screen point (sx, sy) where it is. */
export function zoomAround(level: number, sx?: number, sy?: number): void {
  const next = Math.min(MAX_ZOOM, Math.max(1, level));
  if (next <= 1.01) {
    useZoom.getState().set(null);
    return;
  }
  const v = viewport();
  const px = sx ?? v.w / 2;
  const py = sy ?? (v.top + v.bottom) / 2;
  const p = toStage(px, py);
  const scale = view.fitted * next;
  useZoom.getState().set(clamp(next, p.x - (px - v.w / 2) / scale, p.y - (py - v.h / 2) / scale));
}

export const zoomIn = () => zoomAround(current().level * STEP);
export const zoomOut = () => zoomAround(current().level / STEP);
export const zoomReset = () => useZoom.getState().set(null);

/** Moves the zoomed view by a screen distance. */
export function panBy(dx: number, dy: number): void {
  const z = useZoom.getState().zoom;
  if (!z) return;
  const scale = view.fitted * z.level;
  useZoom.getState().set({ ...z, ...clamp(z.level, z.x + dx / scale, z.y + dy / scale) });
}

let gliding = 0;

function stopGlide(): void {
  cancelAnimationFrame(gliding);
  gliding = 0;
}

/** After a flick the view carries on, until friction or the edge of the desk stops it. */
function glide(flick: { x: number; y: number }): void {
  let v = flick;
  let last = performance.now();
  const step = (now: number) => {
    const before = useZoom.getState().zoom;
    if (!before) return;
    const ms = Math.min(34, Math.max(1, now - last));
    last = now;
    gesturing();
    panBy(v.x * ms, v.y * ms);
    const after = useZoom.getState().zoom!;
    v = slowed({ x: after.x === before.x ? 0 : v.x, y: after.y === before.y ? 0 : v.y }, ms);
    gliding = Math.hypot(v.x, v.y) > STOPPED ? requestAnimationFrame(step) : 0;
  };
  gliding = requestAnimationFrame(step);
}

/** Centers a zoomed view on a screen point (the caret, the book). */
export function zoomTo(level: number, sx: number, sy: number): void {
  const p = toStage(sx, sy);
  useZoom.getState().set(clamp(Math.min(MAX_ZOOM, level), p.x, p.y));
}

/** The magnifying glass: in on what you're writing (or the open book), or back out. */
export function toggleMagnifier(): void {
  if (useZoom.getState().zoom) {
    zoomReset();
    return;
  }
  const ed = useActiveEditor.getState().editor;
  if (ed && !ed.isDestroyed && ed.isFocused) {
    const r = ed.view.coordsAtPos(ed.state.selection.head);
    zoomTo(2, r.left, r.top);
    return;
  }
  const v = viewport();
  const pages = [...document.querySelectorAll('[data-stage] [data-page-id], [data-stage] [data-blank-page]')].map((el) => el.getBoundingClientRect());
  if (pages.length) {
    const left = Math.min(...pages.map((r) => r.left));
    const right = Math.max(...pages.map((r) => r.right));
    const top = Math.min(...pages.map((r) => r.top));
    zoomTo(2, (left + right) / 2, top + v.h * 0.32);
    return;
  }
  zoomTo(2, v.w / 2, v.h / 2);
}

/** Things inside the desk that handle pointers themselves (panels, pages, objects). */
const OWN_POINTERS = 'button, a, input, textarea, select, [contenteditable], [role="toolbar"], [data-page-id], [data-blank-page], [data-panel]';
/** A finger that moves this far is dragging, not tapping. */
const SLOP = 10;

/**
 * Wires the gestures. Returns whether the desk is zoomed: that's all React
 * needs to know, as the view itself moves by useCamera.
 */
export function useDeskZoom(stage: { w: number; h: number }, fitted: number): boolean {
  const zoomed = useZoom((st) => st.zoom !== null);
  view = { stage, fitted };

  // Trackpad pinch and Ctrl+wheel zoom the desk (not the browser); while
  // zoomed, plain scrolling moves around.
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const target = e.target as Element | null;
      if (!target?.closest('[data-room]') || target.closest('[data-panel]')) return;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        gesturing();
        const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0025));
        zoomAround(current().level * factor, e.clientX, e.clientY);
        return;
      }
      if (useZoom.getState().zoom) {
        e.preventDefault();
        gesturing();
        const k = e.deltaMode === 1 ? 32 : 1;
        panBy(e.deltaX * k, e.deltaY * k);
      }
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, []);

  // Fingers: two pinch and move; one drags the desk around while zoomed.
  useEffect(() => {
    const touches = new Map<number, { x: number; y: number }>();
    let pinch: { dist: number; level: number; mid: { x: number; y: number } } | null = null;
    // `held`: started on the page, so it only moves the view once it's clearly a drag (a tap places the caret).
    let drag: { id: number; x: number; y: number; held: boolean; trail: Touch[] } | null = null;
    const midOf = () => {
      const [a, b] = [...touches.values()];
      return { a: a!, b: b!, mid: { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 }, dist: Math.hypot(a!.x - b!.x, a!.y - b!.y) };
    };
    const down = (e: PointerEvent) => {
      stopGlide();
      const target = e.target as Element | null;
      // A selected decoration takes two fingers for itself (to resize it, or zoom a photo in its frame).
      if (!target?.closest('[data-room]') || target.closest('[data-panel], [data-own-pinch]')) return;
      if (e.pointerType === 'touch') {
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (touches.size === 2) {
          const m = midOf();
          pinch = { dist: Math.max(1, m.dist), level: current().level, mid: m.mid };
          drag = null;
        }
      }
      if (pinch || !useZoom.getState().zoom || e.button !== 0) return;
      const own = target.closest(OWN_POINTERS);
      // On a touch screen a finger also moves the page you're writing on.
      const onPage = e.pointerType === 'touch' && useBook.getState().mode === 'write' && own?.closest('[data-page-id]') && !target.closest('button, a, input, textarea, select');
      if (!own || onPage) drag = { id: e.pointerId, x: e.clientX, y: e.clientY, held: Boolean(own), trail: [] };
    };
    const move = (e: PointerEvent) => {
      if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && touches.size === 2) {
        gesturing();
        const m = midOf();
        // Added up here, not read back from the view: a slow pinch is too small to show at first.
        pinch.level = Math.min(MAX_ZOOM, Math.max(1, pinch.level * (m.dist / pinch.dist)));
        zoomAround(pinch.level, m.mid.x, m.mid.y);
        panBy(pinch.mid.x - m.mid.x, pinch.mid.y - m.mid.y);
        pinch.mid = m.mid;
        pinch.dist = Math.max(1, m.dist);
        return;
      }
      if (drag && drag.id === e.pointerId) {
        if (drag.held) {
          if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < SLOP) return;
          drag.held = false;
        }
        gesturing();
        panBy(drag.x - e.clientX, drag.y - e.clientY);
        drag.x = e.clientX;
        drag.y = e.clientY;
        drag.trail.push({ t: e.timeStamp, x: e.clientX, y: e.clientY });
        if (drag.trail.length > 12) drag.trail.shift();
      }
    };
    const up = (e: PointerEvent) => {
      touches.delete(e.pointerId);
      if (touches.size < 2) pinch = null;
      if (drag?.id !== e.pointerId) return;
      const flick = e.type === 'pointerup' && e.pointerType === 'touch' && !reducedMotion() ? flickOf(drag.trail, e.timeStamp) : null;
      // The view goes the opposite way to the finger.
      if (flick) glide({ x: -flick.x, y: -flick.y });
      drag = null;
    };
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, []);

  // While zoomed, the view keeps the caret in sight as you write, above an on-screen keyboard.
  const editor = useActiveEditor((st) => st.editor);
  useEffect(() => {
    if (!editor || !zoomed) return;
    const follow = () => {
      const z = useZoom.getState().zoom;
      if (editor.isDestroyed || !editor.isFocused || !z) return;
      const r = editor.view.coordsAtPos(editor.state.selection.head);
      const { w, top, bottom } = viewport();
      const margin = Math.min(90, (bottom - top) / 5);
      // The writing view fits the lines on screen: it moves sideways only if the caret leaves it.
      const edge = z.writing ? 0 : margin;
      let dx = 0;
      let dy = 0;
      if (r.left < edge) dx = r.left - margin;
      else if (r.right > w - edge) dx = r.right - (w - margin);
      if (r.top < top + margin) dy = r.top - (top + margin);
      else if (r.bottom > bottom - margin) dy = r.bottom - (bottom - margin);
      if (dx || dy) panBy(dx, dy);
    };
    editor.on('selectionUpdate', follow);
    // The keyboard coming up shrinks what you can see.
    const unsubscribe = useViewport.subscribe((v, prev) => {
      if (v.bottom !== prev.bottom || v.top !== prev.top) follow();
    });
    return () => {
      editor.off('selectionUpdate', follow);
      unsubscribe();
    };
  }, [editor, zoomed]);

  // Keys (when not typing): + and - zoom, 0 shows the whole desk.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey || (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)))) return;
      if (e.key === '+' || e.key === '=') zoomIn();
      else if (e.key === '-' || e.key === '_') zoomOut();
      else if (e.key === '0' && useZoom.getState().zoom) zoomReset();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // A resized window: stay on the desk.
  useEffect(
    () =>
      useViewport.subscribe(() => {
        const z = useZoom.getState().zoom;
        if (z) useZoom.getState().set({ ...z, ...clamp(z.level, z.x, z.y) });
      }),
    [],
  );

  return zoomed;
}

interface CameraLayers {
  deskView: RefObject<HTMLElement | null>;
  stage: RefObject<HTMLElement | null>;
  glow: RefObject<HTMLElement | null>;
}

/**
 * Keeps the desk's layers where the camera is. A finger moves them many times
 * a second, so this goes straight onto the elements and not through React:
 * drawing the desk again for each move is what made it choppy on a phone.
 * The wood stays fitted to the window and is scaled like a picture, so it
 * always covers the room.
 */
export function useCamera(layers: CameraLayers, stage: { w: number; h: number }, fitted: number, enabled: boolean): void {
  const { w, h } = stage;
  useLayoutEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    const show = () => {
      const z = useZoom.getState().zoom;
      const moved = stageTransform(z, { w, h }, fitted);
      if (layers.stage.current) layers.stage.current.style.transform = moved;
      if (layers.glow.current) layers.glow.current.style.transform = moved;
      if (layers.deskView.current) layers.deskView.current.style.transform = z ? `scale(${z.level})` : '';
      root.toggleAttribute('data-close-up', fitted * (z?.level ?? 1) > 1);
    };
    show();
    const unsubscribe = useZoom.subscribe(show);
    return () => {
      unsubscribe();
      root.removeAttribute('data-close-up');
    };
  }, [layers.deskView, layers.stage, layers.glow, w, h, fitted, enabled]);
}

/** Writing at a size you can read: 22 px text at most. */
const WRITING_SCALE = 1;
/** Room left on each side of the lines in the writing view. */
const GUTTER = 12;

let leaving = 0;

/** Out of the writing view once no page has the caret (focus moving on to the next page as the words flow isn't stopping). */
function leaveSoon(): void {
  window.clearTimeout(leaving);
  leaving = window.setTimeout(() => {
    const ed = useActiveEditor.getState().editor;
    if (useZoom.getState().zoom?.writing && !(ed && !ed.isDestroyed && ed.isFocused)) zoomReset();
  }, 250);
}

/**
 * Phones: a page that fits the screen is too small to write on. While the
 * caret is in it the desk zooms in until the lines fill the screen's width,
 * with the line you're on a third of the way down what you can see, and it
 * zooms back out when you stop writing (unless you zoomed in yourself).
 */
export function useWritingZoom(enabled: boolean): void {
  const editor = useActiveEditor((st) => st.editor);
  useEffect(() => {
    if (!enabled || !editor) return;
    const start = () => {
      window.clearTimeout(leaving);
      const z = useZoom.getState().zoom;
      if (editor.isDestroyed || !editor.isFocused || (z && !z.writing)) return;
      const col = editor.view.dom.getBoundingClientRect();
      const { w, h, top, bottom } = viewport();
      const scale = Math.min(WRITING_SCALE, (w - GUTTER * 2) / (col.width / (view.fitted * current().level)));
      if (scale <= view.fitted * 1.05) return; // already big enough (tablets)
      const level = Math.min(MAX_ZOOM, scale / view.fitted);
      const caret = editor.view.coordsAtPos(editor.state.selection.head);
      const at = toStage(col.left + col.width / 2, caret.top);
      const y = at.y - (top + (bottom - top) * 0.3 - h / 2) / (view.fitted * level);
      gesturing();
      useZoom.getState().set({ ...clamp(level, at.x, y), writing: true });
    };
    // A tap focuses the page before it moves the caret to where you tapped: look there.
    let settling = 0;
    const focused = () => {
      window.clearTimeout(leaving);
      window.clearTimeout(settling);
      settling = window.setTimeout(start, 120);
    };
    // (Tapping a page also makes its editor this one, so this is often that very tap.)
    if (editor.isFocused) focused();
    editor.on('focus', focused);
    editor.on('blur', leaveSoon);
    return () => {
      window.clearTimeout(settling);
      editor.off('focus', focused);
      editor.off('blur', leaveSoon);
      leaveSoon();
    };
  }, [enabled, editor]);
}
