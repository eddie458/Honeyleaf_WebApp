import { STAGE_H, STAGE_W } from './stage';
import s from './DeskScene.module.css';

/**
 * Light through a four-pane window off the top-left of the desk: low
 * golden-hour sun by day, cool moonlight at night (the room shows one or the
 * other). The panes are stretched along the light's direction (a low light
 * casts long patches), with soft dapples where leaves outside catch it.
 * Static: drawn once, never animated, so its blur costs nothing after the
 * first paint. `at` moves the window's patch on the stage, so a scene can
 * keep the frame's cross-shaped shadow off the thing it shows.
 */
export function WindowLight({ at = [-40, 400], tone = 'sun' }: { at?: readonly [number, number]; tone?: 'sun' | 'moon' }) {
  const pane = 330;
  const bar = 44;
  const panes = [
    [0, 0],
    [pane + bar, 0],
    [0, pane + bar],
    [pane + bar, pane + bar],
  ] as const;
  const filter = `wl-soft-${tone}`;
  return (
    <svg className={tone === 'sun' ? s.windowLight : s.moonLight} viewBox={`0 0 ${STAGE_W} ${STAGE_H}`} width={STAGE_W} height={STAGE_H} aria-hidden="true">
      <defs>
        <filter id={filter} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation={tone === 'sun' ? 20 : 26} />
        </filter>
      </defs>
      <g filter={`url(#${filter})`}>
        <g transform={`translate(${at[0]} ${at[1]}) rotate(-45) scale(1 1.45)`}>
          {panes.map(([x, y]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width={pane} height={pane} rx="8" fill={tone === 'sun' ? '#ffd27e' : '#b4c6ff'} />
          ))}
          <ellipse cx="210" cy="90" rx="46" ry="20" fill={tone === 'sun' ? '#5a3214' : '#141a3a'} opacity="0.35" />
          <ellipse cx="560" cy="470" rx="36" ry="16" fill={tone === 'sun' ? '#5a3214' : '#141a3a'} opacity="0.3" />
          <ellipse cx="130" cy="560" rx="40" ry="18" fill={tone === 'sun' ? '#5a3214' : '#141a3a'} opacity="0.28" />
        </g>
      </g>
    </svg>
  );
}
