// The Formquote public quote API (https://pcba-quote-lab.pages.dev/developers):
// GET /api/v2/catalog and POST /api/v2/quotes for the three public digital
// categories. PCB estimates need an operator key and are not used here.
//
// Friendly to the API: identical requests are answered from a short
// in-memory cache, every call has a timeout, and one isolate sends at most
// BURST requests per WINDOW_MS. Failed calls are never answered from cache.

export const DEFAULT_BASE = 'https://pcba-quote-lab.pages.dev';
export const USER_AGENT = 'formquote-mcp/1.0 (+https://github.com/Keith-CY/formquote-mcp)';
const TIMEOUT_MS = 10000;
const CATALOG_TTL = 10 * 60 * 1000;
const QUOTE_TTL = 5 * 60 * 1000;
const CACHE_MAX = 200;
const WINDOW_MS = 10000;
const BURST = 40;

export class UpstreamError extends Error {
  constructor(kind, message, status = 0) {
    super(message);
    this.kind = kind; // 'invalid_input' | 'busy' | 'upstream_error'
    this.status = status;
  }
}

export function createClient({ base = DEFAULT_BASE, fetchImpl = fetch, now = () => Date.now() } = {}) {
  const cache = new Map();
  let windowStart = 0;
  let sent = 0;

  function fromCache(key) {
    const hit = cache.get(key);
    if (!hit) return null;
    if (hit.expires <= now()) {
      cache.delete(key);
      return null;
    }
    return hit.value;
  }
  function toCache(key, value, ttl) {
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(key, { value, expires: now() + ttl });
  }
  function take() {
    const t = now();
    if (t - windowStart >= WINDOW_MS) {
      windowStart = t;
      sent = 0;
    }
    if (sent >= BURST) throw new UpstreamError('busy', 'This connector is receiving many requests right now. Wait a few seconds and try again.');
    sent++;
  }

  async function call(path, init) {
    take();
    let res;
    try {
      res = await fetchImpl(base + path, {
        ...init,
        headers: { Accept: 'application/json', 'User-Agent': USER_AGENT, ...(init?.headers || {}) },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new UpstreamError('upstream_error', 'The Formquote API did not answer in time. Try again in a minute; do not reuse an older quote.');
    }
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    if (res.ok && body && typeof body === 'object') return body;
    const apiMessage = typeof body?.error?.message === 'string' ? body.error.message.slice(0, 500) : '';
    const apiCode = typeof body?.error?.code === 'string' ? body.error.code.slice(0, 80) : '';
    if (res.status === 400 || res.status === 422) {
      throw new UpstreamError('invalid_input', `Formquote rejected the request${apiCode ? ` (${apiCode})` : ''}: ${apiMessage || 'check the inputs against the tool schema.'}`, res.status);
    }
    if (res.status === 429) throw new UpstreamError('busy', 'The Formquote API is rate-limiting requests. Wait a minute and try again.', res.status);
    throw new UpstreamError('upstream_error', `The Formquote API is unavailable right now (HTTP ${res.status}). Try again later; do not reuse an older quote.`, res.status);
  }

  return {
    base,
    async catalog(categoryId) {
      const key = `catalog:${categoryId || ''}`;
      const hit = fromCache(key);
      if (hit) return hit;
      const qs = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : '';
      const value = await call(`/api/v2/catalog${qs}`, { method: 'GET' });
      toCache(key, value, CATALOG_TTL);
      return value;
    },
    async quote(request) {
      const body = JSON.stringify(request);
      const key = `quote:${body}`;
      const hit = fromCache(key);
      if (hit) return hit;
      const value = await call('/api/v2/quotes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      toCache(key, value, QUOTE_TTL);
      return value;
    },
  };
}
