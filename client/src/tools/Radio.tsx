import { useEffect, useRef } from 'react';
import { useSaveSettings } from '../data/queries';
import { setPlaying, setVolume, tuneTo, useRadio, type Station } from '../desk/radio';
import { t } from '../strings/en';
import { Panel } from '../ui/Panel';
import s from './Radio.module.css';

const STATIONS: { id: Station; label: string }[] = [
  { id: 'piano', label: t.radio.piano },
  { id: 'rain', label: t.radio.rain },
];

/** The little radio's face: a power knob, a tuning dial and the volume. */
export function Radio({ onClose, x, y }: { onClose(): void; x: number; y: number }) {
  const { playing, station, volume } = useRadio();
  const save = useSaveSettings();
  const saveLater = useRef(0);
  // Remember the station and volume (debounced while the slider moves).
  const remember = (patch: { station?: Station; volume?: number }) => {
    window.clearTimeout(saveLater.current);
    saveLater.current = window.setTimeout(() => {
      const st = useRadio.getState();
      save.mutate({ radio: { station: patch.station ?? st.station, volume: patch.volume ?? st.volume } });
    }, 600);
  };
  useEffect(() => () => window.clearTimeout(saveLater.current), []);

  return (
    <Panel title={t.radio.title} x={x} y={y} width={520} from="top" variant="card" tilt={-1} onClose={onClose}>
      <p className={s.hint}>{t.radio.hint}</p>
      <div className={s.face}>
        <button type="button" className={s.power} aria-pressed={playing} aria-label={t.radio.power} onClick={() => void setPlaying(!playing)}>
          <span className={s.bulb} aria-hidden="true" />
          <span aria-hidden="true">{playing ? t.radio.on : t.radio.off}</span>
        </button>
        <div className={s.dial} role="radiogroup" aria-label={t.radio.stations}>
          <span className={s.needle} style={{ left: station === 'piano' ? '27%' : '73%' }} aria-hidden="true" />
          {STATIONS.map((st) => (
            <button
              key={st.id}
              type="button"
              role="radio"
              aria-checked={station === st.id}
              className={s.station}
              onClick={() => {
                tuneTo(st.id);
                remember({ station: st.id });
              }}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>
      <label className={s.volume}>
        <span>{t.radio.softer}</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          aria-label={t.radio.volume}
          onChange={(e) => {
            const v = Number(e.target.value) / 100;
            setVolume(v);
            remember({ volume: v });
          }}
        />
        <span>{t.radio.louder}</span>
      </label>
    </Panel>
  );
}
