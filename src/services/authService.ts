import { User } from '../types';
import { apiFetch, getApiBaseUrl, isHtmlPayload } from './apiClient';
import { getActiveSupabaseClient, isSupabaseClientConfigured } from '../lib/supabase';

export interface AuthSessionResponse {
  success: boolean;
  user: User;
  token: string;
  refreshToken?: string | null;
  message?: string;
}

export interface AuthErrorDetails {
  message: string;
  status?: number;
  isNetworkError?: boolean;
}

export class AuthServiceError extends Error {
  public code?: string;
  public status?: number;
  public details?: Record<string, any>;

  constructor(message: string, code?: string, status?: number, details?: Record<string, any>) {
    super(message);
    this.name = 'AuthServiceError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export { getApiBaseUrl };

/**
 * Safely parse HTTP responses before attempting JSON parsing.
 * Prevents "Unexpected token 'T', 'The page c'... is not valid JSON" errors
 * caused by HTML/proxy/404 responses.
 */
export async function safeFetchAuthJson<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const resolvedUrl =
    url.startsWith('http://') || url.startsWith('https://')
      ? url
      : `${baseUrl}${url.startsWith('/') ? url : `/${url}`}`;

  let res: Response;
  try {
    res = await apiFetch(resolvedUrl, {
      credentials: 'include',
      ...options,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new Error(
      'Unable to connect to the authentication server. Please check your network connection or try again later.'
    );
  }

  const contentType = res.headers.get('content-type') || '';
  const rawText = await res.text();
  const trimmed = rawText.trim();
  const isHtml = isHtmlPayload(contentType, rawText);
  const ctLower = contentType.toLowerCase();

  let parsedJson: any = null;
  const isLikelyJson =
    !isHtml &&
    trimmed.length > 0 &&
    (ctLower.includes('application/json') ||
      ctLower.includes('+json') ||
      trimmed.startsWith('{') ||
      trimmed.startsWith('['));

  if (isLikelyJson) {
    try {
      parsedJson = JSON.parse(rawText);
    } catch {
      parsedJson = null;
    }
  }

  if (!res.ok) {
    if (parsedJson && typeof parsedJson.error === 'string') {
      throw new AuthServiceError(parsedJson.error, parsedJson.code, res.status, parsedJson);
    }
    if (parsedJson && typeof parsedJson.message === 'string') {
      throw new AuthServiceError(parsedJson.message, parsedJson.code, res.status, parsedJson);
    }
    if (isHtml) {
      throw new AuthServiceError(
        `Authentication endpoint '${resolvedUrl}' returned HTML instead of JSON (HTTP ${res.status}${ctLower ? `, content-type: ${ctLower}` : ''}).`,
        'INVALID_HTML_RESPONSE',
        res.status,
        { endpoint: resolvedUrl, contentType }
      );
    }

    if (res.status === 401) {
      throw new AuthServiceError('Invalid email or password. Please check your credentials.', 'INVALID_CREDENTIALS', 401);
    }
    if (res.status === 403) {
      throw new AuthServiceError('Access forbidden. Please sign in again.', 'FORBIDDEN', 403);
    }
    if (res.status === 404) {
      throw new Error(`Authentication endpoint '${resolvedUrl}' could not be reached (404 Not Found).`);
    }
    if (res.status === 429) {
      throw new AuthServiceError('Too many attempts. Please wait a minute before trying again.', 'RATE_LIMITED', 429);
    }
    if (res.status >= 500) {
      throw new AuthServiceError(
        `Authentication endpoint '${resolvedUrl}' encountered a temporary error (HTTP ${res.status}). Please try again shortly.`,
        'UPSTREAM_ERROR',
        res.status
      );
    }

    const cleanSnippet = rawText.replace(/<[^>]*>?/gm, '').trim().slice(0, 80);
    throw new Error(cleanSnippet || `Authentication request to '${resolvedUrl}' failed with HTTP ${res.status}.`);
  }

  if (isHtml) {
    throw new AuthServiceError(
      `Authentication endpoint '${resolvedUrl}' returned an HTML page (HTTP ${res.status}) instead of JSON.`,
      'INVALID_HTML_RESPONSE',
      res.status,
      { endpoint: resolvedUrl, contentType }
    );
  }

  if (!parsedJson) {
    throw new Error(`Authentication endpoint '${resolvedUrl}' returned an invalid response format (HTTP ${res.status}).`);
  }

  return parsedJson as T;
}

function mapSupabaseUser(supaUser: {
  email?: string;
  user_metadata?: Record<string, any>;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
}): User {
  const email = supaUser.email || '';
  const metaName = supaUser.user_metadata?.full_name || supaUser.user_metadata?.name;
  return {
    email,
    fullName:
      typeof metaName === 'string' && metaName.trim()
        ? metaName.trim()
        : email.split('@')[0] || 'Farmer',
    verified: Boolean(supaUser.email_confirmed_at || supaUser.confirmed_at),
  };
}

function persistLocalSession(token: string, user: User) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('fieldshift_token', token);
    localStorage.setItem('fieldshift_user', JSON.stringify(user));
  }
}

async function syncSupabaseBrowserSession(accessToken?: string, refreshToken?: string | null) {
  const supa = getActiveSupabaseClient();
  if (!supa || !accessToken || !refreshToken) return;
  try {
    await supa.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  } catch {
    // Backend HttpOnly cookie + localStorage Bearer token remain active
  }
}

/**
 * Authentication Service supporting Email & Password Registration,
 * Password Login, Password Reset, and Backend Session Synchronization.
 */
class AuthService {
  private loginRouteCandidates = [
    '/api/auth/login',
    '/api/v1/auth/login',
  ];

  public isSupabaseConfigured(): boolean {
    return isSupabaseClientConfigured;
  }

  /**
   * Log in user with email and password through backend auth proxy
   * (syncs HttpOnly session cookie + Supabase SDK).
   */
  public async login(
    emailOrCreds: string | { email: string; password: string },
    maybePassword?: string
  ): Promise<AuthSessionResponse> {
    const email = typeof emailOrCreds === 'string' ? emailOrCreds : emailOrCreds.email;
    const password = typeof emailOrCreds === 'string' ? maybePassword || '' : emailOrCreds.password;
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      throw new Error('Email and password are required.');
    }

    let lastError: any = null;
    for (const route of this.loginRouteCandidates) {
      try {
        const res = await safeFetchAuthJson<AuthSessionResponse>(route, {
          method: 'POST',
          body: JSON.stringify({ email: cleanEmail, password }),
        });
        if (res && res.token) {
          persistLocalSession(res.token, res.user);
          await syncSupabaseBrowserSession(res.token, res.refreshToken);
        }
        return res;
      } catch (err: any) {
        lastError = err;
        if (!err.message || !err.message.includes('404')) {
          throw err;
        }
      }
    }

    throw lastError || new Error("Authentication endpoint '/api/auth/login' could not be reached (404 Not Found).");
  }

  /**
   * Register a new user with email & password and establish an immediate authenticated session.
   */
  public async register(payload: { email: string; fullName: string; password?: string }): Promise<AuthSessionResponse> {
    const cleanEmail = payload.email.trim().toLowerCase();
    const cleanName = payload.fullName.trim();

    const res = await safeFetchAuthJson<AuthSessionResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: cleanEmail,
        fullName: cleanName,
        password: payload.password,
      }),
    });

    if (res && res.token && res.user) {
      persistLocalSession(res.token, res.user);
      await syncSupabaseBrowserSession(res.token, res.refreshToken);
    }

    return res;
  }

  /**
   * Request password reset link
   */
  public async forgotPassword(emailOrPayload: string | { email: string }): Promise<{ success: boolean; message: string }> {
    const email = typeof emailOrPayload === 'string' ? emailOrPayload : emailOrPayload.email;
    const cleanEmail = email.trim().toLowerCase();

    const supa = getActiveSupabaseClient();
    if (supa) {
      const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth/sign-in` : undefined;
      const { error } = await supa.auth.resetPasswordForEmail(cleanEmail, { redirectTo });
      if (error) {
        throw new Error(error.message || 'Unable to send password reset instructions.');
      }
      return {
        success: true,
        message: 'Password reset link dispatched to your email address.',
      };
    }

    return await safeFetchAuthJson('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: cleanEmail }),
    });
  }

  /**
   * Verify active token session with Supabase or backend
   */
  public async getSession(token?: string): Promise<{ success: boolean; user?: User; token?: string }> {
    const supa = getActiveSupabaseClient();
    if (supa && !token) {
      try {
        const { data } = await supa.auth.getSession();
        if (data?.session?.access_token) {
          const { data: userCheck, error: userErr } = await supa.auth.getUser(data.session.access_token);
          if (!userErr && userCheck?.user) {
            const user = mapSupabaseUser(userCheck.user);
            persistLocalSession(data.session.access_token, user);
            return { success: true, user, token: data.session.access_token };
          }
          const { data: refreshed, error: refreshErr } = await supa.auth.refreshSession();
          if (!refreshErr && refreshed?.session?.user) {
            const user = mapSupabaseUser(refreshed.session.user);
            persistLocalSession(refreshed.session.access_token, user);
            return { success: true, user, token: refreshed.session.access_token };
          }
        }
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('fieldshift_token');
          localStorage.removeItem('fieldshift_user');
        }
      } catch {
        // Continue to backend cookie session verification
      }
    }

    const activeToken =
      token || (typeof localStorage !== 'undefined' ? localStorage.getItem('fieldshift_token') : null);
    try {
      const res = await safeFetchAuthJson<{ success: boolean; user: User }>('/api/auth/session', {
        method: 'GET',
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
      });
      if (res?.success && res.user && activeToken) {
        persistLocalSession(activeToken, res.user);
      }
      return res;
    } catch {
      return { success: false };
    }
  }

  /**
   * Log out current user across both Supabase Auth and backend HttpOnly session cookie
   */
  public async logout(): Promise<void> {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('fieldshift_token') : null;
    const supa = getActiveSupabaseClient();
    try {
      if (supa) {
        await supa.auth.signOut();
      }
      await safeFetchAuthJson('/api/auth/logout', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {
      // Local session wipe is authoritative
    } finally {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('fieldshift_token');
        localStorage.removeItem('fieldshift_user');
      }
    }
  }
}

export const authService = new AuthService();
