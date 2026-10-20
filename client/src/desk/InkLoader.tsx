import s from './InkLoader.module.css';

/** Loading state: a pen doodling a loop. */
export function InkLoader({ label }: { label: string }) {
  return (
    <div className={s.wrap} role="status" aria-live="polite">
      <svg className={s.svg} viewBox="0 0 160 120" aria-hidden="true">
        <path
          className={s.loop}
          d="M18 86C40 88 56 70 60 52 64 34 52 22 42 30 30 40 44 66 70 70 96 74 112 50 104 38 96 26 80 40 88 60 96 80 126 84 144 70"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
        />
      </svg>
      <span className={s.label}>{label}</span>
    </div>
  );
}
