import { useBook } from '../data/bookStore';
import { t } from '../strings/en';
import s from './SaveMark.module.css';

/** The tiny "ink drying… / saved" note under the journal. */
export function SaveMark() {
  const status = useBook((st) => st.saveStatus);
  const text = { saved: t.journal.saved, drying: t.journal.drying, offline: t.journal.offline, error: t.journal.saveError }[status];
  return (
    <span className={s.mark} data-status={status} role="status" aria-live="polite">
      {status === 'saved' && (
        <svg viewBox="0 0 20 16" aria-hidden="true">
          <path d="M2 9l5 5L18 2" />
        </svg>
      )}
      {status === 'drying' && <span className={s.drop} aria-hidden="true" />}
      {text}
    </span>
  );
}
