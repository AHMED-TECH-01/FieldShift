import { getActiveSupabaseClient } from '../lib/supabase';

/**
 * Centralized API Client for FieldShift Frontend
 *
 * Works seamlessly in both:
 * 1. Monolithic local dev / Docker / Cloud Run (where Express and Vite share the origin or use /api proxy)
 * 2. Vercel deployments (where /api/* routes directly to the serverless Express function)
 */

const boundNativeFetch =
  typeof window !== 'undefined' && typeof globalThis.fetch === 'function'
    ? globalThis.fetch.bind(globalThis)
    : null;

/**
 * Safe fetch wrapper bound to native globalThis.fetch.
 * Never mutates or monkey-patches window.fetch or globalThis.fetch.
 */
export async function apiFetch(url: RequestInfo | URL, options: RequestInit = {}): Promise<Response> {
  const fetchImpl = boundNativeFetch ?? globalThis.fetch;
  return fetchImpl(url, options);
}

export function getApiBaseUrl(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) {
    const raw = (import.meta.env.VITE_API_URL as string).trim();
    return raw.endsWith('/') ? raw.slice(0, -1) : raw;
  }
  return '';
}

export interface ApiRequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

export class ApiError extends Error {
  public status: number;
  public code?: string;
  public endpoint?: string;
  public contentType?: string;
  public data?: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = typeof data?.code === 'string' ? data.code : undefined;
    this.endpoint = typeof data?.endpoint === 'string' ? data.endpoint : undefined;
    this.contentType = typeof data?.contentType === 'string' ? data.contentType : undefined;
    this.data = data;
  }
}

export function isHtmlPayload(contentType: string, rawText: string): boolean {
  const ctLower = contentType.toLowerCase();
  if (ctLower.includes('text/html') || ctLower.includes('application/xhtml+xml')) {
    return true;
  }
  const trimmed = rawText.trimStart();
  if (!trimmed) return false;
  const head = trimmed.slice(0, 64).toLowerCase();
  return head.startsWith('<!doctype') || head.startsWith('<html') || trimmed.startsWith('<');
}

async function resolveActiveAccessToken(): Promise<string | null> {
  const supa = getActiveSupabaseClient();
  if (supa) {
    try {
      const { data, error } = await supa.auth.getSession();
      const session = data?.session;
      if (!error && session?.access_token) {
        const expiresAtMs = typeof session.expires_at === 'number' ? session.expires_at * 1000 : null;
        if (expiresAtMs && expiresAtMs <= Date.now() + 30_000) {
          const { data: refreshed, error: refreshErr } = await supa.auth.refreshSession();
          if (!refreshErr && refreshed?.session?.access_token) {
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('fieldshift_token', refreshed.session.access_token);
            }
            return refreshed.session.access_token;
          }
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('fieldshift_token');
          }
          return null;
        }
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('fieldshift_token', session.access_token);
        }
        return session.access_token;
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('fieldshift_token');
      }
      return null;
    } catch {
      return null;
    }
  }
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem('fieldshift_token');
  }
  return null;
}

function clearStoredSessionAndNotify(endpoint: string) {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('fieldshift_token');
    localStorage.removeItem('fieldshift_user');
  }
  if (typeof window !== 'undefined' && !endpoint.includes('/api/auth/')) {
    window.dispatchEvent(new CustomEvent('fieldshift:auth-expired'));
  }
}

/**
 * Robust JSON fetch wrapper that:
 * - Prepends proper API base URL
 * - Appends query parameters if provided
 * - Includes credentials (cookies) for authenticated sessions
 * - Attaches fresh Supabase Bearer access_token (with one-shot refresh on 401)
 * - Inspects Content-Type & HTML markers before JSON parsing, throwing endpoint+status errors on HTML/non-JSON
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: ApiRequestOptions = {},
  isRetry = false
): Promise<T> {
  const { params, headers, ...restOptions } = options;
  const baseUrl = getApiBaseUrl();

  // Normalize endpoint URL
  let resolvedUrl =
    endpoint.startsWith('http://') || endpoint.startsWith('https://')
      ? endpoint
      : `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  // Append query params if specified
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        searchParams.append(key, String(val));
      }
    });
    const qs = searchParams.toString();
    if (qs) {
      resolvedUrl += (resolvedUrl.includes('?') ? '&' : '?') + qs;
    }
  }

  const authToken = await resolveActiveAccessToken();

  const mergedHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(restOptions.body ? { 'Content-Type': 'application/json' } : {}),
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...((headers as Record<string, string>) || {}),
  };

  let res: Response;
  try {
    res = await apiFetch(resolvedUrl, {
      credentials: 'include',
      headers: mergedHeaders,
      ...restOptions,
    });
  } catch {
    throw new ApiError(
      `Network error reaching '${resolvedUrl}': Unable to reach the FieldShift API server. Please verify your connection.`,
      0,
      { code: 'NETWORK_ERROR', endpoint: resolvedUrl }
    );
  }

  // On 401, try refreshing Supabase session once before failing
  const supaForRetry = getActiveSupabaseClient();
  if (res.status === 401 && !isRetry && supaForRetry && !endpoint.includes('/api/auth/')) {
    try {
      const { data, error } = await supaForRetry.auth.refreshSession();
      if (!error && data?.session?.access_token) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('fieldshift_token', data.session.access_token);
        }
        return apiRequest<T>(endpoint, options, true);
      }
    } catch {
      // Fall through to 401 error handling
    }
  }

  const contentType = res.headers.get('content-type') || '';
  const rawText = await res.text();
  const trimmed = rawText.trim();
  const isHtml = isHtmlPayload(contentType, rawText);

  let parsedData: any = null;
  let jsonParseFailed = false;
  const ctLower = contentType.toLowerCase();
  const hasJsonContentType = ctLower.includes('application/json') || ctLower.includes('+json');
  const looksLikeJson = trimmed.startsWith('{') || trimmed.startsWith('[');

  if (!isHtml && trimmed.length > 0 && (hasJsonContentType || looksLikeJson)) {
    try {
      parsedData = JSON.parse(rawText);
    } catch {
      parsedData = null;
      jsonParseFailed = true;
    }
  }

  if (!res.ok) {
    if (res.status === 401) {
      clearStoredSessionAndNotify(endpoint);
    }

    if (isHtml) {
      throw new ApiError(
        `API endpoint '${resolvedUrl}' returned HTML instead of JSON (HTTP ${res.status}${ctLower ? `, content-type: ${ctLower}` : ''}).`,
        res.status,
        {
          code: 'INVALID_HTML_RESPONSE',
          endpoint: resolvedUrl,
          contentType,
          isHtml: true,
        }
      );
    }

    if (jsonParseFailed) {
      throw new ApiError(
        `API endpoint '${resolvedUrl}' returned malformed JSON (HTTP ${res.status}).`,
        res.status,
        {
          code: 'INVALID_JSON_RESPONSE',
          endpoint: resolvedUrl,
          contentType,
        }
      );
    }

    const errorMsg =
      parsedData?.error ||
      parsedData?.message ||
      (res.status === 404
        ? `API endpoint '${resolvedUrl}' not found (404).`
        : res.status === 401
        ? `Authentication required or invalid credentials (401) at '${resolvedUrl}'.`
        : res.status === 403
        ? `Unauthorized access to '${resolvedUrl}' (403).`
        : res.status >= 500
        ? `API endpoint '${resolvedUrl}' returned server error HTTP ${res.status}.`
        : `Request to '${resolvedUrl}' failed with HTTP ${res.status}.`);

    throw new ApiError(errorMsg, res.status, {
      ...(parsedData && typeof parsedData === 'object' ? parsedData : {}),
      endpoint: resolvedUrl,
      contentType,
    });
  }

  if (isHtml) {
    throw new ApiError(
      `API endpoint '${resolvedUrl}' returned an HTML page (HTTP ${res.status}, content-type: ${contentType || 'unknown'}) instead of JSON.`,
      res.status,
      {
        code: 'INVALID_HTML_RESPONSE',
        endpoint: resolvedUrl,
        contentType,
        isHtml: true,
      }
    );
  }

  if (jsonParseFailed) {
    throw new ApiError(
      `API endpoint '${resolvedUrl}' returned malformed JSON (HTTP ${res.status}, content-type: ${contentType || 'unknown'}).`,
      res.status,
      {
        code: 'INVALID_JSON_RESPONSE',
        endpoint: resolvedUrl,
        contentType,
      }
    );
  }

  if (parsedData !== null) {
    return parsedData as T;
  }

  if (trimmed.length === 0) {
    return {} as T;
  }

  throw new ApiError(
    `API endpoint '${resolvedUrl}' returned non-JSON response (HTTP ${res.status}, content-type: ${contentType || 'unknown'}).`,
    res.status,
    {
      code: 'INVALID_JSON_RESPONSE',
      endpoint: resolvedUrl,
      contentType,
    }
  );
}

export const apiClient = {
  get: <T = any>(endpoint: string, options?: ApiRequestOptions) =>
    apiRequest<T>(endpoint, { method: 'GET', ...options }),

  post: <T = any>(endpoint: string, body?: any, options?: ApiRequestOptions) =>
    apiRequest<T>(endpoint, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    }),

  put: <T = any>(endpoint: string, body?: any, options?: ApiRequestOptions) =>
    apiRequest<T>(endpoint, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    }),

  patch: <T = any>(endpoint: string, body?: any, options?: ApiRequestOptions) =>
    apiRequest<T>(endpoint, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    }),

  delete: <T = any>(endpoint: string, options?: ApiRequestOptions) =>
    apiRequest<T>(endpoint, { method: 'DELETE', ...options }),
};
