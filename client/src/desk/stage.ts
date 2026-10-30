import { useMemo } from 'react';
import { useViewport } from './viewport';

/** The desk is laid out on a fixed stage, scaled to fit the window. */
export const STAGE_W = 2200;
export const STAGE_H = 1300;

export function useStageScale(w = STAGE_W, h = STAGE_H): number {
  return useViewport((v) => Math.min(v.w / w, v.h / h));
}

/**
 * A stage `w` wide that grows taller to match a tall window (phones), never
 * shorter than `minH`: the desk then fills the screen edge to edge instead
 * of floating in the middle, and the pencil case sits at the bottom.
 */
export function useTallStage(w: number, minH: number): { w: number; h: number } {
  const h = useViewport((v) => Math.max(minH, Math.round((w * v.h) / Math.max(1, v.w))));
  return useMemo(() => ({ w, h }), [w, h]);
}

/** Wide screens get the two-page spread; portrait tablets and phones one page. */
export function useLayoutMode(): 'spread' | 'single' {
  return useViewport((v) => (v.w >= 900 && v.w / v.h >= 1.15 ? 'spread' : 'single'));
}

/** Shadow offset for an object standing `lift` units above the desk. */
export function shadowOffset(lift: number): { x: number; y: number; blur: number } {
  return { x: 3 + lift * 0.16, y: 5 + lift * 0.26, blur: 3 + lift * 0.05 };
}
