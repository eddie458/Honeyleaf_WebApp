// The one place the client talks to the PHP API (docs/API.md).

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly body: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** A request that never reached the server (offline, DNS, server down). */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super('The diary could not reach the server.');
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

let csrfToken = '';
const listeners = new Set<(code: string) => void>();

export function setCsrf(token: string): void {
  csrfToken = token;
}

/** Told when the server says the session ended or the diary locked. */
export function onSessionTrouble(fn: (code: string) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function apiUrl(route: string): string {
  return new URL(`api/${route}`, document.baseURI).toString();
}

export interface RequestOptions {
  signal?: AbortSignal;
  keepalive?: boolean;
}

export async function api<T>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', route: string, body?: unknown, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (method !== 'GET') headers['X-Honeyleaf-CSRF'] = csrfToken;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res: Response;
  try {
    res = await fetch(apiUrl(route), {
      method,
      headers,
      body: payload,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: opts.signal,
      keepalive: opts.keepalive,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new NetworkError(e);
  }
  const text = await res.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      if (!res.ok) throw new ApiError(res.status, 'server_error', 'The server sent something unexpected.');
    }
  }
  if (!res.ok) {
    const err = (data.error ?? {}) as { code?: string; message?: string };
    const code = err.code ?? 'server_error';
    if (code === 'unauthenticated' || code === 'locked' || code === 'must_change_password') listeners.forEach((fn) => fn(code));
    throw new ApiError(res.status, code, err.message ?? res.statusText, data);
  }
  return data as T;
}

export const isOffline = (e: unknown) => e instanceof NetworkError || (e instanceof ApiError && (e.status === 502 || e.status === 503 || e.status === 504));
