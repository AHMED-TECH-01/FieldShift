const REDACTED_KEYS = new Set([
  'apikey',
  'api_key',
  'password',
  'token',
  'access_token',
  'refresh_token',
  'secret',
  'authorization',
  'cookie',
  'set-cookie',
]);

function sanitizeMeta(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[Truncated]';
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeMeta(item, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (REDACTED_KEYS.has(key.toLowerCase())) {
        continue;
      }
      out[key] = sanitizeMeta(val, depth + 1);
    }
    return out;
  }
  return value;
}

export function logEvent(component: string, event: string, meta: Record<string, unknown> = {}): void {
  const safeMeta = sanitizeMeta(meta) as Record<string, unknown>;
  const payload = {
    timestamp: new Date().toISOString(),
    component,
    event,
    ...safeMeta,
  };
  console.log(`[FIELDSHIFT_LOG] ${JSON.stringify(payload)}`);
}

export function logGeminiEvent(event: string, meta: Record<string, unknown> = {}): void {
  logEvent('GeminiAdvisor', event, meta);
}
