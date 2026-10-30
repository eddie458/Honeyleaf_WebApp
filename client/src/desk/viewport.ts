// The window the desk is laid out for. On phones and tablets an on-screen
// keyboard covers part of the screen while you type, and browsers report a
// smaller window then: laying the desk out again for it made everything jump,
// and come back wrong. So the desk keeps the size it had, and what must stay
// in sight above the keyboard (the line you're writing) uses `top`/`bottom`.

import { create } from 'zustand';

export interface Viewport {
  /** The window as the desk is laid out for; the on-screen keyboard doesn't count. */
  w: number;
  h: number;
  /** The part you can see, in window coordinates: above the keyboard, where the browser has slid it. */
  top: number;
  bottom: number;
}

/** What the browser says now. */
export interface Reading {
  w: number;
  h: number;
  /** The visual viewport: what's on screen. */
  seenTop: number;
  seenHeight: number;
  /** A touch screen (where keyboards pop up), with a text field focused or only just left. */
  touch: boolean;
  typing: boolean;
  msSinceField: number;
}

/**
 * The viewport after a reading. A keyboard coming up (or still going down
 * after you finish typing) only takes height away; that height is kept.
 */
export function settle(prev: Viewport | null, r: Reading): Viewport {
  const keyboard = r.touch && (r.typing || r.msSinceField < 900);
  const h = prev && keyboard && r.w === prev.w && r.h < prev.h ? prev.h : r.h;
  const top = Math.max(0, Math.round(r.seenTop));
  return { w: r.w, h, top, bottom: Math.min(h, Math.round(r.seenTop + r.seenHeight)) };
}

const typing = () => {
  const el = document.activeElement as HTMLElement | null;
  return Boolean(el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)));
};

let leftField = -Infinity;

function read(): Reading {
  const vv = window.visualViewport;
  return {
    w: window.innerWidth,
    h: window.innerHeight,
    seenTop: vv?.offsetTop ?? 0,
    seenHeight: vv?.height ?? window.innerHeight,
    touch: window.matchMedia('(pointer: coarse)').matches,
    typing: typing(),
    msSinceField: performance.now() - leftField,
  };
}

export const useViewport = create<Viewport>(() => (typeof window === 'undefined' ? { w: 1280, h: 800, top: 0, bottom: 800 } : settle(null, read())));

/** The viewport now, outside React. */
export const viewport = (): Viewport => useViewport.getState();

if (typeof window !== 'undefined') {
  const update = () => {
    const prev = useViewport.getState();
    const next = settle(prev, read());
    if (next.w !== prev.w || next.h !== prev.h || next.top !== prev.top || next.bottom !== prev.bottom) useViewport.setState(next);
  };
  window.addEventListener('resize', update);
  window.visualViewport?.addEventListener('resize', update);
  window.visualViewport?.addEventListener('scroll', update);
  document.addEventListener('focusin', update);
  document.addEventListener('focusout', () => {
    leftField = performance.now();
    window.setTimeout(() => {
      if (typing()) return;
      // iOS can leave the page slid up after the keyboard has gone: put it back.
      if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
      update();
    }, 350);
  });
}
