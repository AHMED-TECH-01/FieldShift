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
  public data?: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = typeof data?.code === 'string' ? data.code : undefined;
    this.data = data;
  }
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
 * - Handles non-JSON / HTML error responses gracefully
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
      'Network error: Unable to reach the FieldShift API server. Please verify your connection.',
      0
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

  let parsedData: any = null;
  const isLikelyJson =
    contentType.includes('application/json') ||
    rawText.trim().startsWith('{') ||
    rawText.trim().startsWith('[');

  if (isLikelyJson && rawText.trim().length > 0) {
    try {
      parsedData = JSON.parse(rawText);
    } catch {
      parsedData = null;
    }
  }

  if (!res.ok) {
    if (res.status === 401) {
      clearStoredSessionAndNotify(endpoint);
    }

    const errorMsg =
      parsedData?.error ||
      parsedData?.message ||
      (res.status === 404
        ? `API endpoint '${resolvedUrl}' not found (404).`
        : res.status === 401
        ? 'Authentication required or invalid credentials (401).'
        : res.status === 403
        ? 'Unauthorized access to this resource (403).'
        : res.status >= 500
        ? 'The server encountered an error processing your request.'
        : `Request failed with status ${res.status}`);

    throw new ApiError(errorMsg, res.status, parsedData);
  }

  return (parsedData !== null ? parsedData : rawText) as T;
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
