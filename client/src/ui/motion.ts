import { useSyncExternalStore } from 'react';
import { create } from 'zustand';

/** 'auto' follows the device; the drawer can force calm or lively motion. */
export const useMotionSetting = create<{ motion: 'auto' | 'on' | 'off'; set(m: 'auto' | 'on' | 'off'): void }>((set) => ({
  motion: 'auto',
  set: (motion) => {
    document.documentElement.dataset.motion = motion;
    set({ motion });
  },
}));

const query = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

export function useReducedMotion(): boolean {
  const os = useSyncExternalStore(
    (cb) => {
      query?.addEventListener('change', cb);
      return () => query?.removeEventListener('change', cb);
    },
    () => query?.matches ?? false,
  );
  const setting = useMotionSetting((st) => st.motion);
  return setting === 'on' || (setting === 'auto' && os);
}
