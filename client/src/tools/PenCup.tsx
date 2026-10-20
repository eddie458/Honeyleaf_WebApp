import { useState } from 'react';
import { useBook } from '../data/bookStore';
import { useActiveEditor } from '../editor/activeEditor';
import { fontFamily } from '../library/fonts';
import { useLibrary, type InkEntry } from '../library/useLibrary';
import { t } from '../strings/en';
import { ColorTin } from '../ui/ColorTin';
import { Panel } from '../ui/Panel';
import s from './tools.module.css';

const KINDS: InkEntry['kind'][] = ['fountain', 'gel', 'metallic', 'marker'];
const SIZES = [18, 22, 30] as const;

/** Pens fan out of the cup: choose an ink, a hand and a size to write with. */
export function PenCup({ onClose, x, y }: { onClose(): void; x: number; y: number }) {
  const inks = useLibrary((st) => st.inks);
  const fonts = useLibrary((st) => st.fonts);
  const pen = useBook((st) => st.pen);
  const setPen = useBook((st) => st.setPen);
  const [tin, setTin] = useState(false);

  /** Picking a pen also re-inks the words you have selected. */
  const withSelection = (fn: (ed: NonNullable<ReturnType<typeof useActiveEditor.getState>['editor']>) => void) => {
    const ed = useActiveEditor.getState().editor;
    if (ed && !ed.isDestroyed && !ed.state.selection.empty) fn(ed);
  };
  const chooseInk = (id: string, color: string) => {
    setPen({ ink: { id, color } });
    withSelection((ed) => ed.chain().setMark('ink', { id, color }).run());
  };
  const chooseFont = (id: string) => {
    setPen({ font: id });
    withSelection((ed) => ed.chain().setMark('font', { id }).run());
  };
  const chooseSize = (px: number) => {
    setPen({ size: px });
    withSelection((ed) => ed.chain().setMark('size', { px }).run());
  };

  return (
    <Panel title={t.tools.pens} x={x} y={y} width={470} from="left" variant="notebook" tilt={-1} onClose={onClose}>
      <p className={s.hint}>{t.tools.pensHint}</p>
      {KINDS.map((kind) => (
        <div key={kind} className={s.penRow}>
          <span className={s.rowLabel}>{t.tools.inkKinds[kind]}</span>
          <div className={s.pens}>
            {inks
              .filter((i) => i.kind === kind)
              .map((ink) => (
                <button key={ink.id} type="button" className={s.pen} data-kind={ink.kind} aria-pressed={pen.ink.color === ink.color} aria-label={ink.name} title={ink.name} onClick={() => chooseInk(ink.id, ink.color)}>
                  <svg viewBox="0 0 120 22" aria-hidden="true">
                    <rect x="4" y="5" width="74" height="12" rx="6" fill={ink.color} />
                    <rect x="4" y="5" width="74" height="4" rx="2" fill="#fff" opacity="0.35" />
                    <rect x="78" y="6" width="18" height="10" rx="2" fill="#3b3633" />
                    <path d="M96 7L116 11L96 15Z" fill={kind === 'marker' ? ink.color : '#d9ac4f'} />
                  </svg>
                </button>
              ))}
          </div>
        </div>
      ))}
      <div className={s.penRow}>
        <span className={s.rowLabel}>{t.tools.inkKinds.custom}</span>
        {tin ? (
          <ColorTin
            onPick={(c) => {
              chooseInk('custom', c);
              setTin(false);
            }}
          />
        ) : (
          <button type="button" className={s.tinOpen} onClick={() => setTin(true)}>
            <span className={s.pans} aria-hidden="true" />
            {t.tools.customInk}
          </button>
        )}
      </div>
      <div className={s.penRow}>
        <span className={s.rowLabel}>{t.toolbar.font}</span>
        <div className={s.hands}>
          {fonts
            .filter((f) => f.category !== 'readable')
            .map((f) => (
              <button key={f.id} type="button" className={s.hand} aria-pressed={pen.font === f.id} style={{ fontFamily: `${fontFamily(f.id)}, cursive`, color: pen.ink.color }} onClick={() => chooseFont(f.id)}>
                {f.name}
              </button>
            ))}
        </div>
      </div>
      <div className={s.penRow}>
        <span className={s.rowLabel}>{t.toolbar.size}</span>
        <div className={s.sizes}>
          {SIZES.map((px) => (
            <button key={px} type="button" className={s.size} aria-pressed={pen.size === px} aria-label={t.toolbar.sizes[px]} onClick={() => chooseSize(px)}>
              <span style={{ fontSize: px, fontFamily: `${fontFamily(pen.font)}, cursive` }}>Aa</span>
            </button>
          ))}
        </div>
      </div>
    </Panel>
  );
}
