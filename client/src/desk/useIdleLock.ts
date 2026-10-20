import { useEffect } from 'react';

/** Locks the diary after a while with no typing, tapping or scrolling. */
export function useIdleLock(minutes: number, lock: () => Promise<void> | void): void {
  useEffect(() => {
    const ms = Math.max(1, minutes) * 60_000;
    let timer = window.setTimeout(() => void lock(), ms);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void lock(), ms);
    };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    events.forEach((ev) => window.addEventListener(ev, reset, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((ev) => window.removeEventListener(ev, reset));
    };
  }, [minutes, lock]);
}
