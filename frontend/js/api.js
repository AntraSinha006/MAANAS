// Thin wrapper around fetch for the MAANAS API (same origin as the web app).
const TOKEN_KEY = 'maanas_token';

export const session = {
  get token() {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set token(value) {
    try {
      if (value) localStorage.setItem(TOKEN_KEY, value);
      else localStorage.removeItem(TOKEN_KEY);
    } catch { /* storage blocked: token lives only for this page */ }
  },
  user: null,
  therapist: null,
};

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message || `Request failed (${status})`);
    this.status = status;
    this.code = body?.error?.code;
    this.details = body?.error?.details;
  }
}

export async function api(path, { method = 'GET', body, query } = {}) {
  const url = new URL(`/api${path}`, window.location.origin);
  if (query) for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '') url.searchParams.set(k, v);

  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (session.token) headers.Authorization = `Bearer ${session.token}`;

  let res;
  try {
    res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, { error: { message: 'Cannot reach the MAANAS server. Is it running?' } });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && session.token) {
      session.token = null;
      session.user = null;
      session.therapist = null;
    }
    throw new ApiError(res.status, data);
  }
  return data;
}
