// Thin fetch wrapper with officer token handling.
const TOKEN_KEY = 'strawslot.token';
const USER_KEY = 'strawslot.user';

const safe = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };

export const session = {
  token: () => safe(() => localStorage.getItem(TOKEN_KEY)),
  user: () => safe(() => JSON.parse(localStorage.getItem(USER_KEY) || 'null')),
  set: (token, user) => safe(() => { localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(USER_KEY, JSON.stringify(user)); }),
  clear: () => safe(() => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }),
};

export class ApiError extends Error {
  constructor(message, status, details) { super(message); this.status = status; this.details = details; }
}

export async function api(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (auth) headers.authorization = `Bearer ${session.token()}`;
  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && auth) {
    session.clear();
    if (!location.pathname.startsWith('/admin/login')) location.assign('/admin/login?expired=1');
  }
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status, data.details);
  return data;
}

export async function download(path, filename) {
  const res = await fetch(`/api${path}`, { headers: { authorization: `Bearer ${session.token()}` } });
  if (!res.ok) throw new ApiError('Download failed', res.status);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
