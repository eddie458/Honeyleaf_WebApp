// Toasts are sticky notes that land on the desk for a few seconds.

import { create } from 'zustand';

export type ToastTone = 'info' | 'done' | 'warn';

export interface Toast {
  id: number;
  text: string;
  tone: ToastTone;
  action?: { label: string; run: () => void };
}

interface ToastState {
  toasts: Toast[];
  push(t: Omit<Toast, 'id'>): number;
  dismiss(id: number): void;
}

let seq = 1;

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = seq++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export function toast(text: string, tone: ToastTone = 'info', action?: Toast['action'], ms = tone === 'warn' ? 9000 : 4200): number {
  const id = useToasts.getState().push(action ? { text, tone, action } : { text, tone });
  window.setTimeout(() => useToasts.getState().dismiss(id), ms);
  return id;
}
