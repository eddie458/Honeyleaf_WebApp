import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { PAGE_H, PAGE_W } from '../model/page';
import { fold, matrixCss, pose, type Pt } from './fold';
import s from './PageTurn.module.css';

export type TurnEnd = 'flat' | 'turned';

export interface TurnSpec {
  /** Leaf mirrored (a left page turning back to the right). */
  mirrored: boolean;
  corner: 'top' | 'bottom';
  /** Where the corner starts, in the leaf's standard frame (spine at x = 0). */
  start: Pt;
  /** The end that completes the turn. */
  done: TurnEnd;
  /** Pointer id when the person is dragging; otherwise it animates by itself. */
  pointerId?: number;
}

interface Props {
  spec: TurnSpec;
  /** Where the leaf sits in the journal's page area (0 for the left slot, PAGE_W for the right). */
  x: number;
  front: ReactNode;
  back: ReactNode;
  reducedMotion: boolean;
  onFinish(done: boolean): void;
}

const W = PAGE_W;
const H = PAGE_H;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Mirror a point across the leaf's middle (for left pages). */
const mirror = (p: Pt): Pt => ({ x: W - p.x, y: p.y });

/**
 * The turning leaf: its front cut off along the fold, its back folded over on
 * top, a soft shadow on the page beneath and a sheen on the curl. Driven by the
 * pointer, then animated to finish or snap back. Each frame only writes
 * transforms, with no React and nothing to redraw: that's what lets a phone
 * keep up.
 */
export function PageTurn({ spec, x, front, back, reducedMotion, onFinish }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const edgeEl = useRef<HTMLDivElement>(null);
  const flatEl = useRef<HTMLDivElement>(null);
  const backEl = useRef<HTMLDivElement>(null);
  const sheenEl = useRef<HTMLDivElement>(null);
  const shadowEl = useRef<HTMLDivElement>(null);
  const corner: Pt = { x: W, y: spec.corner === 'top' ? 0 : H };
  const turnedAt: Pt = { x: -W, y: corner.y };
  const at = useRef<Pt>(spec.start);
  const frame = useRef(0);
  const finished = useRef(false);

  const place = (p: Pt) => {
    at.current = p;
    const q = pose(fold(corner, p, W, H), W, spec.mirrored);
    const edge = matrixCss(q.edge);
    edgeEl.current!.style.transform = edge;
    shadowEl.current!.style.transform = edge;
    flatEl.current!.style.transform = matrixCss(q.flat);
    backEl.current!.style.transform = matrixCss(q.back);
    sheenEl.current!.style.transform = matrixCss(q.sheen);
  };

  const animateTo = (end: TurnEnd) => {
    const from = { ...at.current };
    const to = end === 'turned' ? turnedAt : corner;
    const done = end === spec.done;
    if (reducedMotion) {
      finish(done);
      return;
    }
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const dur = Math.max(220, Math.min(700, dist * 0.55));
    const byItself = spec.pointerId === undefined;
    const lift = byItself ? H * 0.16 : 0;
    // A leaf that has only just appeared is still being drawn: the clock waits
    // for it, so a slow first draw doesn't make the turn jump ahead.
    let wait = byItself ? 2 : 0;
    let t0 = 0;
    const step = (now: number) => {
      if (wait-- > 0) {
        frame.current = requestAnimationFrame(step);
        return;
      }
      t0 ||= now;
      const t = Math.min(1, (now - t0) / dur);
      const k = ease(t);
      const yLift = (spec.corner === 'top' ? 1 : -1) * Math.sin(Math.PI * k) * lift;
      place({ x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k + yLift });
      if (t < 1) frame.current = requestAnimationFrame(step);
      else finish(done);
    };
    frame.current = requestAnimationFrame(step);
  };

  const finish = (done: boolean) => {
    if (finished.current) return;
    finished.current = true;
    onFinish(done);
  };

  useLayoutEffect(() => {
    finished.current = false;
    place(spec.start);
    // The turn is set up once per spec.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec]);

  // Follow the pointer while dragging; on release, finish or snap back.
  useEffect(() => {
    const stop = () => cancelAnimationFrame(frame.current);
    if (spec.pointerId === undefined) {
      animateTo(spec.done);
      return stop;
    }
    const toLeaf = (e: PointerEvent): Pt => {
      const r = ref.current!.getBoundingClientRect();
      const k = W / r.width;
      const local = { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k };
      return spec.mirrored ? mirror(local) : local;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId === spec.pointerId) place(toLeaf(e));
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== spec.pointerId) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      const progress = (W - at.current.x) / (2 * W);
      const goingTurned = spec.done === 'turned' ? progress > 0.28 : progress < 0.72;
      animateTo(goingTurned ? 'turned' : 'flat');
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      stop();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    // The turn is set up once per spec.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec]);

  return (
    <div ref={ref} className={s.leaf} style={{ left: x, width: W, height: H }}>
      <div className={s.beneath}>
        <div ref={shadowEl} className={s.shadow} />
      </div>
      <div ref={edgeEl} className={s.edge}>
        <div ref={flatEl} className={s.flat}>
          {front}
          <div ref={backEl} className={s.back}>
            {back}
            <div ref={sheenEl} className={s.sheen} />
          </div>
        </div>
      </div>
    </div>
  );
}
