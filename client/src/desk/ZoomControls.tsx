import { t } from '../strings/en';
import { MAX_ZOOM, useZoom, zoomIn, zoomOut, zoomReset } from './zoom';
import s from './ZoomControls.module.css';

/** While looking closer: a brass lens showing how close, two knobs, and a tag back to the whole desk. */
export function ZoomControls() {
  const level = useZoom((st) => st.zoom?.level ?? 1);
  return (
    <div className={s.zoom} role="group" aria-label={t.zoom.label}>
      <button type="button" className={s.knob} onClick={zoomOut} aria-label={t.zoom.out} title={t.zoom.out}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 12h12" />
        </svg>
      </button>
      <span className={s.lens} aria-live="polite">
        {t.zoom.level(level)}
      </span>
      <button type="button" className={s.knob} onClick={zoomIn} disabled={level >= MAX_ZOOM - 0.01} aria-label={t.zoom.in} title={t.zoom.in}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 12h12M12 6v12" />
        </svg>
      </button>
      <button type="button" className={s.tag} onClick={zoomReset}>
        {t.zoom.whole}
      </button>
    </div>
  );
}
