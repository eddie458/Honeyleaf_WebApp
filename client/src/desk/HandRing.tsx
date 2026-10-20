/** A hand-drawn loop used as the keyboard focus ring. */
export function HandRing({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path
        d="M14 55C9 25 52 4 83 18c20 10 19 54-12 70C42 102 6 86 7 58 8 42 22 30 37 26"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
