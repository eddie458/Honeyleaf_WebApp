import { useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react';
import { t } from '../strings/en';
import s from './ColorTin.module.css';

function hslToHex(h: number, sat: number, l: number): string {
  const a = sat * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** A little watercolor tin: pick a hue, then how light or deep. */
export function ColorTin({ onPick }: { onPick(color: string): void }) {
  const [hue, setHue] = useState(24);
  const [pad, setPad] = useState({ x: 0.7, y: 0.45 });
  const hueRef = useRef<HTMLDivElement>(null);
  const padRef = useRef<HTMLDivElement>(null);
  const color = hslToHex(hue, pad.x, 0.15 + (1 - pad.y) * 0.7);

  const drag = (el: React.RefObject<HTMLDivElement | null>, apply: (fx: number, fy: number) => void) => (e: RPointerEvent<HTMLDivElement>) => {
    const node = el.current;
    if (!node) return;
    node.setPointerCapture(e.pointerId);
    const at = (ev: { clientX: number; clientY: number }) => {
      const r = node.getBoundingClientRect();
      apply(Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)));
    };
    at(e);
    const move = (ev: PointerEvent) => at(ev);
    const up = () => {
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', up);
    };
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerup', up);
  };

  return (
    <div className={s.tin} onMouseDown={(e) => e.preventDefault()}>
      <div
        ref={padRef}
        className={s.pad}
        style={{ '--hue': hue } as CSSProperties}
        onPointerDown={drag(padRef, (fx, fy) => setPad({ x: fx, y: fy }))}
        role="slider"
        aria-label={t.tools.shade}
        aria-valuenow={Math.round(pad.y * 100)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') setPad((p) => ({ ...p, y: Math.max(0, p.y - 0.05) }));
          if (e.key === 'ArrowDown') setPad((p) => ({ ...p, y: Math.min(1, p.y + 0.05) }));
          if (e.key === 'ArrowLeft') setPad((p) => ({ ...p, x: Math.max(0, p.x - 0.05) }));
          if (e.key === 'ArrowRight') setPad((p) => ({ ...p, x: Math.min(1, p.x + 0.05) }));
        }}
      >
        <span className={s.puck} style={{ left: `${pad.x * 100}%`, top: `${pad.y * 100}%` }} />
      </div>
      <div
        ref={hueRef}
        className={s.hue}
        onPointerDown={drag(hueRef, (fx) => setHue(Math.round(fx * 360)))}
        role="slider"
        aria-label={t.tools.hue}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={hue}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setHue((h) => (h + 350) % 360);
          if (e.key === 'ArrowRight') setHue((h) => (h + 10) % 360);
        }}
      >
        <span className={s.hueMark} style={{ left: `${(hue / 360) * 100}%` }} />
      </div>
      <button type="button" className={s.use} onClick={() => onPick(color)}>
        <span className={s.blot} style={{ background: color }} />
        {t.tools.useColor}
      </button>
    </div>
  );
}
