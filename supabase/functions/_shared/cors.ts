const allowedHeaders = ['authorization', 'apikey', 'content-type', 'x-client-info'];

/** Exact origins only: no wildcard, path, credentials, or opaque "null" origin. */
export function parseAllowedOrigins(value = ''): string[] {
  return [...new Set(value.split(',').map(origin => origin.trim()).filter(origin => {
    try {
      const url = new URL(origin);
      return ['http:', 'https:'].includes(url.protocol) && url.origin === origin;
    } catch { return false; }
  }))];
}

export function corsHeaders(origin: string | null, allowedOrigins: string[]) {
  const headers = new Headers({ 'Content-Type': 'application/json', Vary: 'Origin' });
  if (origin && allowedOrigins.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Headers', allowedHeaders.join(', '));
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  }
  return headers;
}

export function validPreflight(req: Request): boolean {
  const method = req.headers.get('Access-Control-Request-Method');
  const requested = (req.headers.get('Access-Control-Request-Headers') || '').split(',').map(h => h.trim().toLowerCase()).filter(Boolean);
  return method === 'POST' && requested.every(h => allowedHeaders.includes(h));
}
