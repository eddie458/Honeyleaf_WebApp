import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { PAGE_H, PAGE_W } from '../model/page';
import { fold, matrixCss, polygonCss, type Fold, type Pt } from './fold';
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

type Affine = [number, number, number, number, number, number];
function compose(a: Affine, b: Affine): Affine {
  // a ∘ b for CSS matrix(a, b, c, d, e, f) = [[a c e], [b d f]].
  return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
}
const MIRROR: Affine = [-1, 0, 0, 1, W, 0];

/**
 * The turning leaf: its front clipped where it still lies flat, its back
 * folded over on top, a soft shadow on the page beneath and a sheen on the
 * curl. Driven by the pointer, then animated to finish or snap back.
 */
export function PageTurn({ spec, x, front, back, reducedMotion, onFinish }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const corner: Pt = { x: W, y: spec.corner === 'top' ? 0 : H };
  const turnedAt: Pt = { x: -W, y: corner.y };
  const [p, setP] = useState<Pt>(spec.start);
  const pRef = useRef(p);
  pRef.current = p;
  const finished = useRef(false);

  const animateTo = (end: TurnEnd) => {
    const from = { ...pRef.current };
    const to = end === 'turned' ? turnedAt : corner;
    const done = end === spec.done;
    if (reducedMotion) {
      finish(done);
      return;
    }
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const dur = Math.max(220, Math.min(700, dist * 0.55));
    const lift = spec.pointerId === undefined ? H * 0.16 : 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const k = ease(t);
      const yLift = (spec.corner === 'top' ? 1 : -1) * Math.sin(Math.PI * k) * lift;
      setP({ x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k + yLift });
      if (t < 1) requestAnimationFrame(step);
      else finish(done);
    };
    requestAnimationFrame(step);
  };

  const finish = (done: boolean) => {
    if (finished.current) return;
    finished.current = true;
    onFinish(done);
  };

  // Follow the pointer while dragging; on release, finish or snap back.
  useEffect(() => {
    if (spec.pointerId === undefined) {
      animateTo(spec.done);
      return;
    }
    const toLeaf = (e: PointerEvent): Pt => {
      const r = ref.current!.getBoundingClientRect();
      const k = W / r.width;
      const local = { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k };
      return spec.mirrored ? mirror(local) : local;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId === spec.pointerId) setP(toLeaf(e));
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== spec.pointerId) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      const progress = (W - pRef.current.x) / (2 * W);
      const goingTurned = spec.done === 'turned' ? progress > 0.28 : progress < 0.72;
      animateTo(goingTurned ? 'turned' : 'flat');
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    // The turn is set up once per spec.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec]);

  useLayoutEffect(() => {
    finished.current = false;
  }, [spec]);

  const f: Fold = fold(corner, p, W, H);
  const map = (pts: Pt[]) => (spec.mirrored ? pts.map(mirror) : pts);
  const backMatrix = spec.mirrored ? compose(compose(MIRROR, f.backMatrix), MIRROR) : f.backMatrix;
  const backClip = map(f.backClip);
  const lifted = map(f.lifted);
  const flap = map(f.flap);
  const mid = spec.mirrored ? mirror(f.mid) : f.mid;
  const n = spec.mirrored ? { x: -f.normal.x, y: f.normal.y } : f.normal;
  const pts = (list: Pt[]) => list.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' ');
  const shadowTo = { x: mid.x + n.x * 70, y: mid.y + n.y * 70 };
  const sheenTo = { x: mid.x - n.x * 140, y: mid.y - n.y * 140 };

  return (
    <div ref={ref} className={s.leaf} style={{ left: x, width: W, height: H }}>
      <svg className={s.overlay} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        <defs>
          <linearGradient id="hl-turn-shadow" gradientUnits="userSpaceOnUse" x1={mid.x} y1={mid.y} x2={shadowTo.x} y2={shadowTo.y}>
            <stop offset="0" stopColor="#2a1709" stopOpacity="0.42" />
            <stop offset="1" stopColor="#2a1709" stopOpacity="0" />
          </linearGradient>
        </defs>
        {lifted.length > 2 && <polygon points={pts(lifted)} fill="url(#hl-turn-shadow)" />}
      </svg>
      <div className={s.front} style={{ clipPath: polygonCss(map(f.front)) }}>
        {front}
      </div>
      {flap.length > 2 && (
        <div className={s.back} style={{ transform: matrixCss(backMatrix), clipPath: polygonCss(backClip) }}>
          {back}
        </div>
      )}
      <svg className={s.overlay} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        <defs>
          <linearGradient id="hl-turn-sheen" gradientUnits="userSpaceOnUse" x1={mid.x} y1={mid.y} x2={sheenTo.x} y2={sheenTo.y}>
            <stop offset="0" stopColor="#fffaf0" stopOpacity="0.55" />
            <stop offset="0.25" stopColor="#fffaf0" stopOpacity="0.08" />
            <stop offset="1" stopColor="#2a1709" stopOpacity="0.14" />
          </linearGradient>
        </defs>
        {flap.length > 2 && <polygon points={pts(flap)} fill="url(#hl-turn-sheen)" />}
      </svg>
    </div>
  );
}
