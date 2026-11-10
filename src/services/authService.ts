import { User } from '../types';

export interface AuthSessionResponse {
  success: boolean;
  user: User;
  token: string;
  message?: string;
  devOtpCode?: string;
}

export interface AuthErrorDetails {
  message: string;
  status?: number;
  isNetworkError?: boolean;
}

/**
 * Safely parse HTTP responses before attempting JSON parsing.
 * Prevents "Unexpected token 'T', 'The page c'... is not valid JSON" errors
 * caused by HTML/proxy/404 responses.
 */
export async function safeFetchAuthJson<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
  } catch (netErr: any) {
    throw new Error(
      'Unable to connect to the authentication server. Please check your network connection or try again later.'
    );
  }

  const contentType = res.headers.get('content-type') || '';
  const rawText = await res.text();

  let parsedJson: any = null;
  const isLikelyJson =
    contentType.includes('application/json') ||
    rawText.trim().startsWith('{') ||
    rawText.trim().startsWith('[');

  if (isLikelyJson) {
    try {
      parsedJson = JSON.parse(rawText);
    } catch {
      // JSON syntax error on malformed JSON payload
      parsedJson = null;
    }
  }

  // Handle HTTP error statuses gracefully
  if (!res.ok) {
    if (parsedJson && typeof parsedJson.error === 'string') {
      throw new Error(parsedJson.error);
    }
    if (parsedJson && typeof parsedJson.message === 'string') {
      throw new Error(parsedJson.message);
    }

    // Status-specific friendly messages when non-JSON or HTML was returned
    if (res.status === 401) {
      throw new Error('Invalid email or password. Please verify your credentials.');
    }
    if (res.status === 403) {
      throw new Error('Access forbidden. Your account may be pending verification or deactivated.');
    }
    if (res.status === 404) {
      throw new Error(`Authentication endpoint '${url}' could not be reached (404 Not Found).`);
    }
    if (res.status === 429) {
      throw new Error('Too many sign-in attempts. Please wait a minute and try again.');
    }
    if (res.status >= 500) {
      throw new Error('The authentication service encountered a temporary error. Please try again shortly.');
    }

    // Clean truncated text if plain text was returned
    const cleanSnippet = rawText.replace(/<[^>]*>?/gm, '').trim().slice(0, 80);
    throw new Error(cleanSnippet || `Authentication request failed with HTTP ${res.status}.`);
  }

  if (!parsedJson) {
    throw new Error('The authentication service returned an invalid response format.');
  }

  return parsedJson as T;
}

/**
 * Authentication Service supporting both local Express backend and optional Supabase.
 */
class AuthService {
  private primaryLoginUrl = '/api/auth/login';
  private secondaryLoginUrl = '/auth/login';

  /**
   * Check if Supabase Auth configuration is provided via environment
   */
  public isSupabaseConfigured(): boolean {
    const url = typeof import.meta !== 'undefined' && import.meta.env
      ? (import.meta.env.VITE_SUPABASE_URL as string | undefined)
      : undefined;
    const key = typeof import.meta !== 'undefined' && import.meta.env
      ? (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
      : undefined;
    return !!(url && key && url.startsWith('http'));
  }

  /**
   * Log in user with email and password
   */
  /**
   * Log in user with email and password
   */
  public async login(
    emailOrCreds: string | { email: string; password: string },
    maybePassword?: string
  ): Promise<AuthSessionResponse> {
    const email = typeof emailOrCreds === 'string' ? emailOrCreds : emailOrCreds.email;
    const password = typeof emailOrCreds === 'string' ? maybePassword || '' : emailOrCreds.password;
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      throw new Error('Email and password are required.');
    }

    // Try primary API route first (/api/auth/login)
    try {
      const res = await safeFetchAuthJson<AuthSessionResponse>(this.primaryLoginUrl, {
        method: 'POST',
        body: JSON.stringify({ email: cleanEmail, password }),
      });
      if (res && res.token && typeof localStorage !== 'undefined') {
        localStorage.setItem('fieldshift_token', res.token);
        localStorage.setItem('fieldshift_user', JSON.stringify(res.user));
      }
      return res;
    } catch (primaryError: any) {
      // If 404 on primary route, attempt fallback route (/auth/login)
      if (primaryError.message && primaryError.message.includes('404')) {
        try {
          const res = await safeFetchAuthJson<AuthSessionResponse>(this.secondaryLoginUrl, {
            method: 'POST',
            body: JSON.stringify({ email: cleanEmail, password }),
          });
          if (res && res.token && typeof localStorage !== 'undefined') {
            localStorage.setItem('fieldshift_token', res.token);
            localStorage.setItem('fieldshift_user', JSON.stringify(res.user));
          }
          return res;
        } catch {
          // Re-throw original error if fallback also fails
          throw primaryError;
        }
      }
      throw primaryError;
    }
  }

  /**
   * Register a new user
   */
  public async register(payload: { email: string; fullName: string; password?: string }): Promise<{
    success: boolean;
    message: string;
    devOtpCode?: string;
  }> {
    const cleanEmail = payload.email.trim();
    return await safeFetchAuthJson('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: cleanEmail,
        fullName: payload.fullName.trim(),
        password: payload.password,
      }),
    });
  }

  /**
   * Verify 6-digit email OTP
   */
  public async verifyOtp(
    emailOrPayload: string | { email: string; code: string },
    maybeCode?: string
  ): Promise<AuthSessionResponse> {
    const email = typeof emailOrPayload === 'string' ? emailOrPayload : emailOrPayload.email;
    const code = typeof emailOrPayload === 'string' ? maybeCode || '' : emailOrPayload.code;
    const res = await safeFetchAuthJson<AuthSessionResponse>('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({
        email: email.trim(),
        code: code.trim(),
      }),
    });
    if (res && res.token && typeof localStorage !== 'undefined') {
      localStorage.setItem('fieldshift_token', res.token);
      localStorage.setItem('fieldshift_user', JSON.stringify(res.user));
    }
    return res;
  }

  /**
   * Resend 6-digit email verification OTP
   */
  public async resendOtp(emailOrPayload: string | { email: string }): Promise<{
    success: boolean;
    message: string;
    devOtpCode?: string;
  }> {
    const email = typeof emailOrPayload === 'string' ? emailOrPayload : emailOrPayload.email;
    return await safeFetchAuthJson('/api/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim() }),
    });
  }

  /**
   * Request password reset link
   */
  public async forgotPassword(emailOrPayload: string | { email: string }): Promise<{ success: boolean; message: string }> {
    const email = typeof emailOrPayload === 'string' ? emailOrPayload : emailOrPayload.email;
    return await safeFetchAuthJson('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim() }),
    });
  }

  /**
   * Verify active token session with backend
   */
  public async getSession(token?: string): Promise<{ success: boolean; user?: User }> {
    const activeToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('fieldshift_token') : null);
    if (!activeToken) {
      return { success: false };
    }

    try {
      const res = await safeFetchAuthJson<{ success: boolean; user: User }>('/api/auth/session', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${activeToken}`,
        },
      });
      return res;
    } catch {
      return { success: false };
    }
  }

  /**
   * Log out current user
   */
  public async logout(): Promise<void> {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('fieldshift_token') : null;
    try {
      if (token) {
        await safeFetchAuthJson('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
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
