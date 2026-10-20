// Server state through TanStack Query.

import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, onSessionTrouble, setCsrf } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
});

onSessionTrouble(() => void queryClient.invalidateQueries({ queryKey: ['session'] }));

export interface SessionUser {
  id: number;
  username: string;
  displayName: string;
  role: 'admin' | 'member';
  mustChangePassword: boolean;
  lockMinutes: number;
}

export interface SessionInfo {
  state: 'setup' | 'signed_out' | 'locked' | 'signed_in';
  csrf: string;
  user?: SessionUser;
  server: { version: string; maxUploadBytes: number; trashDays: number };
}

export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const s = await api<SessionInfo>('GET', 'session');
      setCsrf(s.csrf);
      return s;
    },
    staleTime: 0,
  });
}

export const refreshSession = () => queryClient.invalidateQueries({ queryKey: ['session'] });

export interface Settings {
  lockMinutes?: number;
  readableFont?: boolean;
  motion?: 'auto' | 'on' | 'off';
  welcomed?: boolean;
  mug?: 'cocoa' | 'coffee' | 'tea';
  lamp?: boolean;
  /** The print style new photos come out in. */
  photoFrame?: string;
  /** Red wavy lines under misspelled words (on unless switched off). */
  spellcheck?: boolean;
  [key: string]: unknown;
}

export function useSettings(enabled = true) {
  return useQuery({ queryKey: ['settings'], queryFn: () => api<{ settings: Settings }>('GET', 'settings').then((r) => r.settings ?? {}), enabled });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Settings) => {
      const current = qc.getQueryData<Settings>(['settings']) ?? {};
      const next = { ...current, ...patch };
      qc.setQueryData(['settings'], next);
      await api('PUT', 'settings', { settings: next });
      return next;
    },
  });
}

export interface DeviceSession {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  remember: boolean;
  current: boolean;
  device: string;
}

export const useDevices = () => useQuery({ queryKey: ['devices'], queryFn: () => api<{ sessions: DeviceSession[] }>('GET', 'auth/sessions').then((r) => r.sessions) });

export interface AdminUser {
  id: number;
  username: string;
  displayName: string;
  role: 'admin' | 'member';
  active: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  storageUsedBytes: number;
  storageLimitBytes: number | null;
  createdAt: string;
}

export const useUsers = () => useQuery({ queryKey: ['users'], queryFn: () => api<{ users: AdminUser[] }>('GET', 'admin/users').then((r) => r.users) });

export interface TrashItem {
  type: 'journal' | 'entry' | 'page' | 'asset';
  id: string;
  label: string;
  date?: string;
  entryId?: string;
  deletedAt: string;
  purgeAt: string;
}

export const useTrash = () => useQuery({ queryKey: ['trash'], queryFn: () => api<{ items: TrashItem[] }>('GET', 'trash').then((r) => r.items) });

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

const rel = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
export function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const diff = (Date.parse(iso) - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return rel.format(Math.round(diff), 'second');
  if (abs < 3600) return rel.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rel.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rel.format(Math.round(diff / 86400), 'day');
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
