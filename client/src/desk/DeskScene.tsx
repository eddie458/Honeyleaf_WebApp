import type { CSSProperties, ReactNode } from 'react';
import { libraryUrl } from '../library/library';
import type { PlacedProp, PropEntry, SceneEntry } from '../library/scene';
import { DeskObject } from './DeskObject';
import { DustMotes, FairyLights } from './DeskLife';
import { useStageScale } from './stage';
import { WindowLight } from './WindowLight';
import s from './DeskScene.module.css';

export interface DeskObjectSpec {
  label: string;
  /** Present when the object does something; otherwise it is quiet decor. */
  onActivate?: () => void;
  pressed?: boolean;
  /** Art override (the mug's drink, the plant's growth stage). */
  src?: string;
  overlay?: ReactNode;
}

export interface Camera {
  scale: number;
  /** Stage point to center on screen. */
  x: number;
  y: number;
}

export interface DeskSceneProps {
  scene: SceneEntry;
  props: Record<string, PropEntry>;
  stage: { w: number; h: number };
  layout?: Record<string, PlacedProp>;
  /** The objects to show. Others in the layout stay off the desk. */
  objects: Record<string, DeskObjectSpec>;
  /** The journal and everything lying on it (stage coordinates). */
  children?: ReactNode;
  /** Things lying on the desk that are not tools (seasonal leaves…). */
  scatter?: ReactNode;
  /** Drawn above the objects and the journal, in the same light: the pen tray. */
  front?: ReactNode;
  /** Drawn above the room's lighting, so it stays easy to read: open panels. */
  above?: ReactNode;
  camera?: Camera | null;
  /** The desk lamp is off: night, by moonlight and fairy lights. */
  night?: boolean;
  dust?: boolean;
  /** Where the window's patch of sunlight falls (see WindowLight). */
  light?: readonly [number, number];
}

export function DeskScene({ scene, props, stage, layout, objects, children, scatter, front, above, camera, night = false, dust = true, light }: DeskSceneProps) {
  const fitted = useStageScale(stage.w, stage.h);
  const scale = camera?.scale ?? fitted;
  const stageStyle: CSSProperties = { width: stage.w, height: stage.h };
  if (camera) stageStyle.translate = `calc(-50% + ${(stage.w / 2 - camera.x) * scale}px) calc(-50% + ${(stage.h / 2 - camera.y) * scale}px)`;
  const roomStyle = { '--s': scale, '--fit': fitted, '--desk-tint': scene.desk.tint } as CSSProperties;
  const placed = layout ?? scene.layout;
  return (
    <div className={s.room} style={roomStyle} data-room="" data-scene={scene.id} data-light={scene.light} data-lamp={night ? 'off' : 'on'}>
      <div className={s.desk} aria-hidden="true" />
      <div className={s.stage} style={stageStyle} data-stage="">
        {scatter}
        {Object.entries(placed).map(([id, place]) => {
          const spec = objects[id];
          const prop = props[id];
          if (!spec || !prop || place.hidden) return null;
          return (
            <DeskObject
              key={id}
              label={spec.label}
              src={spec.src ?? libraryUrl(prop.file)}
              x={place.x}
              y={place.y}
              w={prop.w}
              h={prop.h}
              rot={place.rot ?? 0}
              lift={prop.lift}
              interactive={Boolean(spec.onActivate)}
              {...(spec.pressed !== undefined ? { pressed: spec.pressed } : {})}
              {...(spec.onActivate ? { onActivate: spec.onActivate } : {})}
              {...(place.tag ? { tag: place.tag } : {})}
            >
              {spec.overlay}
            </DeskObject>
          );
        })}
        <div className={s.journalSlot}>{children}</div>
        <WindowLight {...(light ? { at: light } : {})} />
        {/* After dark: moonlight through the same window. */}
        <WindowLight tone="moon" {...(light ? { at: light } : {})} />
        {dust && <DustMotes />}
        {front}
      </div>
      <div className={s.sunWash} aria-hidden="true" />
      <div className={s.vignette} aria-hidden="true" />
      {/* The lamp switched off: night falls, the open book still catching some light. */}
      <div className={s.night} aria-hidden="true" />
      {/* Lights glow over the dark, moving with the desk when it's zoomed. */}
      {night && (
        <div className={s.stageGlow} style={stageStyle}>
          <FairyLights width={stage.w} />
        </div>
      )}
      {/* Panels keep their usual place and size, however the desk is zoomed. */}
      {above && (
        <div className={s.stageAbove} style={{ width: stage.w, height: stage.h }}>
          {above}
        </div>
      )}
    </div>
  );
}
