// Looking closer: the magnifying glass zooms into the desk, and so do a
// trackpad pinch or Ctrl+wheel, and two fingers on a touch screen. While
// zoomed, the wheel or a drag on the desk moves around, and the view follows
// the caret as you write. Tool panels keep their usual size (they sit
// outside the zoomed stage).

import { useEffect } from 'react';
import { create } from 'zustand';
import { useActiveEditor } from '../editor/activeEditor';
import type { Camera } from './DeskScene';

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
  /** null = the whole desk. `level` is relative to the fitted scale. */
  zoom: { level: number; x: number; y: number } | null;
  set(zoom: ZoomState['zoom']): void;
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

/** Keeps the view on the desk: never past its edges. */
function clamp(level: number, x: number, y: number): { level: number; x: number; y: number } {
  const scale = view.fitted * level;
  const hw = window.innerWidth / scale / 2;
  const hh = window.innerHeight / scale / 2;
  const { w, h } = view.stage;
  return {
    level,
    x: w > hw * 2 ? Math.min(w - hw, Math.max(hw, x)) : w / 2,
    y: h > hh * 2 ? Math.min(h - hh, Math.max(hh, y)) : h / 2,
  };
}

/** Screen point → stage point under the current camera. */
export function toStage(sx: number, sy: number): { x: number; y: number } {
  const c = current();
  const scale = view.fitted * c.level;
  return { x: c.x + (sx - window.innerWidth / 2) / scale, y: c.y + (sy - window.innerHeight / 2) / scale };
}

/** Zooms to `level`, keeping the stage point under screen point (sx, sy) where it is. */
export function zoomAround(level: number, sx = window.innerWidth / 2, sy = window.innerHeight / 2): void {
  const next = Math.min(MAX_ZOOM, Math.max(1, level));
  if (next <= 1.01) {
    useZoom.getState().set(null);
    return;
  }
  const p = toStage(sx, sy);
  const scale = view.fitted * next;
  useZoom.getState().set(clamp(next, p.x - (sx - window.innerWidth / 2) / scale, p.y - (sy - window.innerHeight / 2) / scale));
}

export const zoomIn = () => zoomAround(current().level * STEP);
export const zoomOut = () => zoomAround(current().level / STEP);
export const zoomReset = () => useZoom.getState().set(null);

/** Moves the zoomed view by a screen distance. */
export function panBy(dx: number, dy: number): void {
  const z = useZoom.getState().zoom;
  if (!z) return;
  const scale = view.fitted * z.level;
  useZoom.getState().set(clamp(z.level, z.x + dx / scale, z.y + dy / scale));
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
  const pages = [...document.querySelectorAll('[data-stage] [data-page-id], [data-stage] [data-blank-page]')].map((el) => el.getBoundingClientRect());
  if (pages.length) {
    const left = Math.min(...pages.map((r) => r.left));
    const right = Math.max(...pages.map((r) => r.right));
    const top = Math.min(...pages.map((r) => r.top));
    zoomTo(2, (left + right) / 2, top + (window.innerHeight * 0.32));
    return;
  }
  zoomTo(2, window.innerWidth / 2, window.innerHeight / 2);
}

/** Things inside the desk that handle pointers themselves (panels, pages, objects). */
const OWN_POINTERS = 'button, a, input, textarea, select, [contenteditable], [role="toolbar"], [data-page-id], [data-blank-page], [data-panel]';

/**
 * Wires the gestures and keeps the camera in step. Returns the camera for
 * DeskScene (null when not zoomed).
 */
export function useDeskZoom(stage: { w: number; h: number }, fitted: number): Camera | null {
  const zoom = useZoom((st) => st.zoom);
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
    let drag: { id: number; x: number; y: number } | null = null;
    const midOf = () => {
      const [a, b] = [...touches.values()];
      return { a: a!, b: b!, mid: { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 }, dist: Math.hypot(a!.x - b!.x, a!.y - b!.y) };
    };
    const down = (e: PointerEvent) => {
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
      if (!pinch && useZoom.getState().zoom && !target.closest(OWN_POINTERS) && e.button === 0) {
        drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
      }
    };
    const move = (e: PointerEvent) => {
      if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && touches.size === 2) {
        gesturing();
        const m = midOf();
        zoomAround(pinch.level * (m.dist / pinch.dist), m.mid.x, m.mid.y);
        panBy(pinch.mid.x - m.mid.x, pinch.mid.y - m.mid.y);
        pinch.mid = m.mid;
        pinch.level = current().level;
        pinch.dist = Math.max(1, m.dist);
        return;
      }
      if (drag && drag.id === e.pointerId) {
        gesturing();
        panBy(drag.x - e.clientX, drag.y - e.clientY);
        drag.x = e.clientX;
        drag.y = e.clientY;
      }
    };
    const up = (e: PointerEvent) => {
      touches.delete(e.pointerId);
      if (touches.size < 2) pinch = null;
      if (drag?.id === e.pointerId) drag = null;
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

  // While zoomed, the view keeps the caret in sight as you write.
  const editor = useActiveEditor((st) => st.editor);
  useEffect(() => {
    if (!editor || !zoom) return;
    const follow = () => {
      if (editor.isDestroyed || !editor.isFocused || !useZoom.getState().zoom) return;
      const r = editor.view.coordsAtPos(editor.state.selection.head);
      const margin = 90;
      const vh = window.visualViewport?.height ?? window.innerHeight;
      let dx = 0;
      let dy = 0;
      if (r.left < margin) dx = r.left - margin;
      else if (r.right > window.innerWidth - margin) dx = r.right - (window.innerWidth - margin);
      if (r.top < margin) dy = r.top - margin;
      else if (r.bottom > vh - margin) dy = r.bottom - (vh - margin);
      if (dx || dy) panBy(dx, dy);
    };
    editor.on('selectionUpdate', follow);
    return () => {
      editor.off('selectionUpdate', follow);
    };
  }, [editor, zoom]);

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
  useEffect(() => {
    const onResize = () => {
      const z = useZoom.getState().zoom;
      if (z) useZoom.getState().set(clamp(z.level, z.x, z.y));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return zoom ? { scale: fitted * zoom.level, x: zoom.x, y: zoom.y } : null;
}
