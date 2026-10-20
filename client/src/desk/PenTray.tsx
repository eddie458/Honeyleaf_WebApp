import { libraryUrl } from '../library/library';
import { t } from '../strings/en';
import s from './PenTray.module.css';

export type Mode = 'write' | 'decorate' | 'draw';

const TOOLS: { mode: Mode; file: string; label: string; tag: string; y: number }[] = [
  { mode: 'write', file: 'props/tool-fountain-pen.svg', label: t.desk.writeTool, tag: t.desk.write, y: 30 },
  { mode: 'decorate', file: 'props/tool-tweezers.svg', label: t.desk.decorateTool, tag: t.desk.decorate, y: 58 },
  { mode: 'draw', file: 'props/tool-pencil.svg', label: t.desk.drawTool, tag: t.desk.draw, y: 86 },
];

/**
 * The pen tray says what is in your hand: the fountain pen writes, the
 * tweezers decorate, the pencil draws. The tool you hold is lifted out.
 */
export function PenTray({ x, y, mode, onMode }: { x: number; y: number; mode: Mode; onMode: (m: Mode) => void }) {
  return (
    <div className={s.tray} style={{ left: x - 240, top: y - 65 }} role="radiogroup" aria-label={t.desk.penTray}>
      <img className={s.wood} src={libraryUrl('props/pen-tray.svg')} alt="" draggable={false} />
      {TOOLS.map((tool) => {
        const active = tool.mode === mode;
        return (
          <button
            key={tool.mode}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={tool.label}
            className={`${s.tool} ${active ? s.active : ''}`}
            style={{ top: tool.y - 20 }}
            onClick={() => onMode(tool.mode)}
          >
            <img className={s.toolShadow} src={libraryUrl(tool.file)} alt="" draggable={false} />
            <img className={s.toolArt} src={libraryUrl(tool.file)} alt="" draggable={false} />
            {active && <span className={s.tag}>{tool.tag}</span>}
          </button>
        );
      })}
    </div>
  );
}
