import type { ReactNode } from 'react';
import { DeskScene } from '../desk/DeskScene';
import { useLayoutMode } from '../desk/stage';
import { Steam } from '../desk/DeskLife';
import { useLibrary } from '../library/useLibrary';
import { t } from '../strings/en';
import { Toasts } from '../ui/Toasts';
import s from './auth.module.css';

const WIDE = { w: 1700, h: 1200 };
const NARROW = { w: 760, h: 1440 };

const WIDE_LAYOUT = {
  lamp: { x: 170, y: 170 },
  plant: { x: 1560, y: 170 },
  mug: { x: 1560, y: 1060, rot: -12 },
  pencilCup: { x: 170, y: 980 },
  washi: { x: 200, y: 640, rot: -8 },
};

const NARROW_LAYOUT = {
  plant: { x: 700, y: 60 },
  mug: { x: 660, y: 1370, rot: -12 },
  pencilCup: { x: 90, y: 1380 },
};

/* The window's sunlight: one pane falls across the cover's top corner, and
   the frame's cross-shaped shadow stays on the desk beside the diary. */
const WIDE_LIGHT = [-690, 138] as const;
const NARROW_LIGHT = [-910, 188] as const;

/** A calm desk for signing in: no personal things on it, just the closed diary. */
export function AuthDesk({ children }: { children: ReactNode }) {
  const scene = useLibrary((st) => st.scenes[0]);
  const props = useLibrary((st) => st.props);
  const narrow = useLayoutMode() === 'single';
  if (!scene) return null;
  return (
    <>
      <DeskScene
        scene={scene}
        props={props}
        stage={narrow ? NARROW : WIDE}
        layout={narrow ? NARROW_LAYOUT : WIDE_LAYOUT}
        light={narrow ? NARROW_LIGHT : WIDE_LIGHT}
        objects={{
          lamp: { label: t.desk.lamp },
          plant: { label: t.desk.plant },
          mug: { label: t.desk.mug, overlay: <Steam /> },
          pencilCup: { label: t.desk.pencilCup },
          washi: { label: t.desk.washi },
        }}
        dust
      >
        <div className={`${s.center} ${narrow ? s.narrow : ''}`}>{children}</div>
      </DeskScene>
      <Toasts />
    </>
  );
}
