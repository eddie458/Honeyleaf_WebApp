import { useBook } from '../data/bookStore';
import { libraryUrl } from '../library/library';
import { useLibrary } from '../library/useLibrary';
import { t } from '../strings/en';
import { Panel } from '../ui/Panel';
import s from './tools.module.css';

/** Pick a roll, then drag across a page to lay a strip. */
export function WashiRolls({ onClose, x, y }: { onClose(): void; x: number; y: number }) {
  const tapes = useLibrary((st) => st.washiList);
  const tool = useBook((st) => st.tool);
  const setTool = useBook((st) => st.setTool);
  return (
    <Panel title={t.tools.washi} x={x} y={y} width={440} from="left" variant="card" tilt={1} onClose={onClose}>
      <p className={s.hint}>{t.tools.washiHint}</p>
      <div className={s.washiList}>
        {tapes.map((tape) => {
          const active = tool?.kind === 'tape' && tool.asset === tape.id;
          return (
            <button
              key={tape.id}
              type="button"
              className={s.washi}
              aria-pressed={active}
              onClick={() => setTool(active ? null : { kind: 'tape', asset: tape.id, width: tape.width })}
            >
              <span className={s.washiStrip} style={{ backgroundImage: `url("${libraryUrl(tape.file)}")`, backgroundSize: `${tape.tile}px ${tape.tile}px` }} />
              <span>{tape.name}</span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
