import { useLayoutEffect, useMemo, useState } from 'react';

/** The desk is laid out on a fixed stage, scaled to fit the window. */
export const STAGE_W = 2200;
export const STAGE_H = 1300;

export function useStageScale(w = STAGE_W, h = STAGE_H): number {
  const [scale, setScale] = useState(() => fit(w, h));
  useLayoutEffect(() => {
    const onResize = () => setScale(fit(w, h));
    onResize();
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
    };
  }, [w, h]);
  return scale;
}

/**
 * A stage `w` wide that grows taller to match a tall window (phones), never
 * shorter than `minH`: the desk then fills the screen edge to edge instead
 * of floating in the middle, and the pencil case sits at the bottom.
 */
export function useTallStage(w: number, minH: number): { w: number; h: number } {
  const pick = () => Math.max(minH, Math.round((w * window.innerHeight) / Math.max(1, window.innerWidth)));
  const [h, setH] = useState(pick);
  useLayoutEffect(() => {
    const onResize = () => setH(pick());
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [w, minH]);
  return useMemo(() => ({ w, h }), [w, h]);
}

/** Wide screens get the two-page spread; portrait tablets and phones one page. */
export function useLayoutMode(): 'spread' | 'single' {
  const pick = () => (window.innerWidth >= 900 && window.innerWidth / window.innerHeight >= 1.15 ? 'spread' : 'single');
  const [mode, setMode] = useState<'spread' | 'single'>(pick);
  useLayoutEffect(() => {
    const onResize = () => setMode(pick());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return mode;
}


function fit(w: number, h: number): number {
  return Math.min(window.innerWidth / w, window.innerHeight / h);
}

/** Shadow offset for an object standing `lift` units above the desk. */
export function shadowOffset(lift: number): { x: number; y: number; blur: number } {
  return { x: 3 + lift * 0.16, y: 5 + lift * 0.26, blur: 3 + lift * 0.05 };
}
