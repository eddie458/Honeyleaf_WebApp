import { STAGE_H, STAGE_W } from './stage';
import s from './DeskScene.module.css';

/**
 * Low golden-hour sun through a four-pane window off the top-left of the
 * desk. The panes are stretched along the light's direction (a low sun casts
 * long patches), with soft dapples where leaves outside catch the light.
 * Static: drawn once, never animated, so its blur costs nothing after the
 * first paint. `at` moves the window's patch on the stage, so a scene can
 * keep the frame's cross-shaped shadow off the thing it shows.
 */
export function WindowLight({ at = [-40, 400] }: { at?: readonly [number, number] }) {
  const pane = 330;
  const bar = 44;
  const panes = [
    [0, 0],
    [pane + bar, 0],
    [0, pane + bar],
    [pane + bar, pane + bar],
  ] as const;
  return (
    <svg className={s.windowLight} viewBox={`0 0 ${STAGE_W} ${STAGE_H}`} width={STAGE_W} height={STAGE_H} aria-hidden="true">
      <defs>
        <filter id="wl-soft" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="20" />
        </filter>
      </defs>
      <g filter="url(#wl-soft)">
        <g transform={`translate(${at[0]} ${at[1]}) rotate(-45) scale(1 1.45)`}>
          {panes.map(([x, y]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width={pane} height={pane} rx="8" fill="#ffd27e" />
          ))}
          <ellipse cx="210" cy="90" rx="46" ry="20" fill="#5a3214" opacity="0.35" />
          <ellipse cx="560" cy="470" rx="36" ry="16" fill="#5a3214" opacity="0.3" />
          <ellipse cx="130" cy="560" rx="40" ry="18" fill="#5a3214" opacity="0.28" />
        </g>
      </g>
    </svg>
  );
}
