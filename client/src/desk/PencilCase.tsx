import { useEffect, useState } from 'react';
import { libraryUrl } from '../library/library';
import { useLibrary } from '../library/useLibrary';
import type { Mode } from '../data/bookStore';
import { t } from '../strings/en';
import type { DeskObjectSpec } from './DeskScene';
import s from './PencilCase.module.css';

const TOOLS: { mode: Mode; file: string; label: string }[] = [
  { mode: 'write', file: 'props/tool-fountain-pen.svg', label: t.desk.writeTool },
  { mode: 'decorate', file: 'props/tool-tweezers.svg', label: t.desk.decorateTool },
  { mode: 'draw', file: 'props/tool-pencil.svg', label: t.desk.drawTool },
];

/**
 * On phones and portrait tablets the desk objects are tucked into a pencil
 * case that slides up from the bottom.
 */
export function PencilCase({ objects, mode, onMode, stage }: { objects: Record<string, DeskObjectSpec>; mode: Mode; onMode(m: Mode): void; stage: { w: number; h: number } }) {
  const [open, setOpen] = useState(false);
  const props = useLibrary((st) => st.props);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  const items = Object.entries(objects).filter(([, spec]) => spec.onActivate);
  return (
    <div className={s.case} data-open={open ? '' : undefined} style={{ width: stage.w, top: stage.h - 140 }}>
      <div className={s.tools} role="radiogroup" aria-label={t.desk.penTray}>
        {TOOLS.map((tool) => (
          <button key={tool.mode} type="button" role="radio" aria-checked={mode === tool.mode} aria-label={tool.label} className={s.tool} onClick={() => onMode(tool.mode)}>
            <img src={libraryUrl(tool.file)} alt="" draggable={false} />
          </button>
        ))}
      </div>
      <button type="button" className={s.zip} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? t.desk.trayClose : t.desk.trayOpen}>
        <span className={s.pull} aria-hidden="true" />
        {t.desk.tray}
      </button>
      <div className={s.tray} hidden={!open}>
        {items.map(([id, spec]) => {
          const prop = props[id];
          return (
            <button
              key={id}
              type="button"
              className={s.item}
              onClick={() => {
                spec.onActivate?.();
                setOpen(false);
              }}
            >
              <img src={spec.src ?? (prop ? libraryUrl(prop.file) : '')} alt="" draggable={false} />
              <span>{spec.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
