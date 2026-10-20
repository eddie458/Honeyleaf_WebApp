import { useToasts } from './toastStore';
import s from './Toasts.module.css';

/** Sticky notes that land on the corner of the screen, and a "done!" stamp. */
export function Toasts() {
  const toasts = useToasts((st) => st.toasts);
  const dismiss = useToasts((st) => st.dismiss);
  return (
    <div className={s.stack} role="status" aria-live="polite">
      {toasts.map((note, i) => (
        <div key={note.id} className={s.note} data-tone={note.tone} style={{ rotate: `${i % 2 ? 2 : -2}deg` }}>
          {note.tone === 'done' && <span className={s.stamp}>done!</span>}
          <p className={s.text}>{note.text}</p>
          <div className={s.actions}>
            {note.action && (
              <button
                type="button"
                className={s.action}
                onClick={() => {
                  note.action!.run();
                  dismiss(note.id);
                }}
              >
                {note.action.label}
              </button>
            )}
            <button type="button" className={s.close} onClick={() => dismiss(note.id)} aria-label="Dismiss">
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
