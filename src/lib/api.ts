// Thin fetch wrapper with officer token handling.
const TOKEN_KEY = 'strawslot.token';
const USER_KEY = 'strawslot.user';

const safe = <T,>(fn: () => T, fallback: T | null = null): T | null => { try { return fn(); } catch { return fallback; } };

export const session = {
  token: () => safe(() => localStorage.getItem(TOKEN_KEY)),
  user: () => safe(() => JSON.parse(localStorage.getItem(USER_KEY) || 'null')),
  set: (token: string, user: unknown) => safe(() => { localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(USER_KEY, JSON.stringify(user)); }),
  clear: () => safe(() => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }),
};

export class ApiError extends Error {
  status: number;
  details?: { path: string; message: string }[];
  constructor(message: string, status: number, details?: { path: string; message: string }[]) { super(message); this.status = status; this.details = details; }
}

interface ApiOptions { method?: 'GET' | 'POST' | 'DELETE'; body?: unknown; auth?: boolean }

export async function api<T = any>(path: string, { method = 'GET', body, auth = false }: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (auth) headers.authorization = `Bearer ${session.token()}`;
  // A cold serverless start can return 502/503/504 once; GETs are safe to retry quietly.
  const attempts = method === 'GET' ? 3 : 1;
  let res: Response | undefined;
  for (let i = 0; i < attempts; i++) {
    try {
      res = await fetch(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
      if (![502, 503, 504].includes(res.status) || i === attempts - 1) break;
    } catch {
      if (i === attempts - 1) throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
    }
    await new Promise((r) => setTimeout(r, 700 * (i + 1)));
  }
  if (!res) throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && auth) {
    session.clear();
    if (!location.pathname.startsWith('/admin/login')) location.assign('/admin/login?expired=1');
  }
  if (!res.ok) {
    const friendly = [502, 503, 504].includes(res.status) ? 'The service is starting up. Please try again in a few seconds.' : undefined;
    throw new ApiError(data.error || friendly || `Request failed (${res.status})`, res.status, data.details);
  }
  return data;
}

export async function download(path: string, filename: string) {
  const res = await fetch(`/api${path}`, { headers: { authorization: `Bearer ${session.token()}` } });
  if (!res.ok) throw new ApiError('Download failed', res.status);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
