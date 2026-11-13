/**
 * Centralized API Client for FieldShift Frontend
 * 
 * Works seamlessly in both:
 * 1. Monolithic local dev / Docker / Cloud Run (where Express and Vite share the origin or use /api proxy)
 * 2. Vercel deployments (where /api/* routes directly to the serverless Express function)
 */

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
  public data?: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Robust JSON fetch wrapper that:
 * - Prepends proper API base URL
 * - Appends query parameters if provided
 * - Includes credentials (cookies) for authenticated sessions
 * - Handles non-JSON / HTML error responses gracefully
 * - Attaches Bearer token from localStorage if present
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { params, headers, ...restOptions } = options;
  const baseUrl = getApiBaseUrl();

  // Normalize endpoint URL
  let resolvedUrl = endpoint.startsWith('http://') || endpoint.startsWith('https://')
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

  // Retrieve stored auth token if present
  let authToken: string | null = null;
  if (typeof localStorage !== 'undefined') {
    authToken = localStorage.getItem('fieldshift_token');
  }

  const mergedHeaders: Record<string, string> = {
    'Accept': 'application/json',
    ...(restOptions.body ? { 'Content-Type': 'application/json' } : {}),
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...(headers as Record<string, string> || {}),
  };

  let res: Response;
  try {
    res = await fetch(resolvedUrl, {
      credentials: 'include',
      headers: mergedHeaders,
      ...restOptions,
    });
  } catch (networkErr: any) {
    throw new ApiError(
      'Network error: Unable to reach the FieldShift API server. Please verify your connection.',
      0
    );
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
    const errorMsg =
      parsedData?.error ||
      parsedData?.message ||
      (res.status === 404
        ? `API endpoint '${resolvedUrl}' not found (404).`
        : res.status === 401
        ? 'Authentication required or invalid credentials (401).'
        : res.status >= 500
        ? 'The server encountered an error processing your request (500).'
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
