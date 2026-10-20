import { useId } from 'react';
import { deckleEdge } from '../model/photo';
import type { PhotoFrame } from '../model/types';

/** Each frame drawn small (in a 32 × 32 box): the card, and its window as x, y, w, h on it. */
const SHAPES: Partial<Record<PhotoFrame, { w: number; h: number; win: [number, number, number, number]; deckled?: boolean }>> = {
  instant: { w: 16.4, h: 19.9, win: [1.1, 1.1, 14.2, 14.2] },
  'instant-wide': { w: 24.4, h: 19.4, win: [1.05, 1.35, 22.3, 14] },
  'instant-mini': { w: 13.4, h: 21.4, win: [1.1, 1.5, 11.2, 15.3] },
  print: { w: 24, h: 18, win: [1.7, 1.7, 20.6, 14.6] },
  deckled: { w: 23.4, h: 18, win: [2.9, 2.9, 17.6, 12.2], deckled: true },
  plain: { w: 23, h: 17.2, win: [0, 0, 23, 17.2] },
};

/** A tiny print in a frame, with a little landscape in its window, for choosing a print style. */
export function FrameIcon({ frame }: { frame: PhotoFrame }) {
  const clip = useId();
  const shape = SHAPES[frame] ?? SHAPES.instant!;
  const x0 = (32 - shape.w) / 2;
  const y0 = (32 - shape.h) / 2;
  const [wx, wy, ww, wh] = shape.win;
  const plain = frame === 'plain';
  return (
    <svg viewBox="3 3 26 26" aria-hidden="true" style={{ fill: 'none', stroke: 'none' }}>
      <defs>
        <clipPath id={clip}>
          <rect x={x0 + wx} y={y0 + wy} width={ww} height={wh} rx={plain ? 1.2 : 0.3} />
        </clipPath>
      </defs>
      {!plain &&
        (shape.deckled ? (
          <path d={deckleEdge(shape.w, shape.h, 0.75, 2.6)} transform={`translate(${x0} ${y0})`} fill="#f6eedc" stroke="#4a3424" strokeWidth="1.1" strokeLinejoin="round" />
        ) : (
          <rect x={x0} y={y0} width={shape.w} height={shape.h} rx="0.9" fill="#fdfaf3" stroke="#4a3424" strokeWidth="1.3" />
        ))}
      <g clipPath={`url(#${clip})`}>
        <rect x={x0 + wx} y={y0 + wy} width={ww} height={wh} fill="#bfe0f0" />
        <circle cx={x0 + wx + ww * 0.74} cy={y0 + wy + wh * 0.3} r={Math.min(ww, wh) * 0.13} fill="#ffd36e" />
        <ellipse cx={x0 + wx + ww * 0.28} cy={y0 + wy + wh * 1.02} rx={ww * 0.62} ry={wh * 0.44} fill="#8fca8a" />
        <ellipse cx={x0 + wx + ww * 0.92} cy={y0 + wy + wh * 1.08} rx={ww * 0.5} ry={wh * 0.36} fill="#6fb276" />
      </g>
      <rect x={x0 + wx} y={y0 + wy} width={ww} height={wh} rx={plain ? 1.2 : 0.3} stroke="#4a3424" strokeWidth={plain ? 1.3 : 0.8} />
    </svg>
  );
}
