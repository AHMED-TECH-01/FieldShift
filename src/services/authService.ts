import { User } from '../types';
import { getApiBaseUrl } from './apiClient';
import { supabase, isSupabaseClientConfigured } from '../lib/supabase';

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
    res = await fetch(resolvedUrl, {
      credentials: 'include',
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
      parsedJson = null;
    }
  }

  if (!res.ok) {
    if (parsedJson && typeof parsedJson.error === 'string') {
      throw new Error(parsedJson.error);
    }
    if (parsedJson && typeof parsedJson.message === 'string') {
      throw new Error(parsedJson.message);
    }

    if (res.status === 401) {
      throw new Error('Invalid email or password. Please verify your credentials.');
    }
    if (res.status === 403) {
      throw new Error('Access forbidden. Your account may be pending verification or deactivated.');
    }
    if (res.status === 404) {
      throw new Error(`Authentication endpoint '${resolvedUrl}' could not be reached (404 Not Found).`);
    }
    if (res.status === 429) {
      throw new Error('Too many sign-in attempts. Please wait a minute and try again.');
    }
    if (res.status >= 500) {
      throw new Error('The authentication service encountered a temporary error. Please try again shortly.');
    }

    const cleanSnippet = rawText.replace(/<[^>]*>?/gm, '').trim().slice(0, 80);
    throw new Error(cleanSnippet || `Authentication request failed with HTTP ${res.status}.`);
  }

  if (!parsedJson) {
    throw new Error('The authentication service returned an invalid response format.');
  }

  return parsedJson as T;
}

function mapSupabaseUser(supaUser: { email?: string; user_metadata?: Record<string, any>; email_confirmed_at?: string | null }): User {
  const email = supaUser.email || '';
  const metaName = supaUser.user_metadata?.full_name;
  return {
    email,
    fullName: typeof metaName === 'string' && metaName.trim()
      ? metaName.trim()
      : (email.split('@')[0] || 'Farmer'),
    verified: !!supaUser.email_confirmed_at || true,
  };
}

function persistLocalSession(token: string, user: User) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('fieldshift_token', token);
    localStorage.setItem('fieldshift_user', JSON.stringify(user));
  }
}

/**
 * Authentication Service supporting Supabase Auth and Express backend fallback.
 */
class AuthService {
  private loginRouteCandidates = [
    '/api/auth/login',
    '/api/v1/auth/login',
    '/auth/login',
  ];

  /**
   * Check if Supabase Auth configuration is provided via environment
   */
  public isSupabaseConfigured(): boolean {
    return isSupabaseClientConfigured;
  }

  /**
   * Log in user with email and password
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

    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (!error && data.session && data.user) {
        const user = mapSupabaseUser(data.user);
        persistLocalSession(data.session.access_token, user);
        return {
          success: true,
          user,
          token: data.session.access_token,
        };
      }

      if (error) {
        throw new Error(error.message || 'Invalid email or password.');
      }
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
   * Register a new user
   */
  public async register(payload: { email: string; fullName: string; password?: string }): Promise<{
    success: boolean;
    message: string;
    devOtpCode?: string;
    autoConfirmed?: boolean;
    user?: User;
    token?: string;
  }> {
    const cleanEmail = payload.email.trim().toLowerCase();
    const cleanName = payload.fullName.trim();

    if (supabase && payload.password) {
      const emailRedirectTo = typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined;
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: payload.password,
        options: {
          data: { full_name: cleanName },
          emailRedirectTo,
        },
      });

      if (error) {
        throw new Error(error.message || 'Could not create account.');
      }

      if (data.session && data.user) {
        const user = mapSupabaseUser(data.user);
        persistLocalSession(data.session.access_token, user);
        return {
          success: true,
          autoConfirmed: true,
          user,
          token: data.session.access_token,
          message: 'Account created and verified.',
        };
      }

      return {
        success: true,
        autoConfirmed: false,
        message: 'Verification code / confirmation link sent to your email address.',
      };
    }

    return await safeFetchAuthJson('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: cleanEmail,
        fullName: cleanName,
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
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    if (supabase) {
      const { data, error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanCode,
        type: 'signup',
      });

      if (!error && data.session && data.user) {
        const user = mapSupabaseUser(data.user);
        persistLocalSession(data.session.access_token, user);
        return {
          success: true,
          user,
          token: data.session.access_token,
        };
      }

      if (error) {
        throw new Error(error.message || 'Invalid or expired 6-digit verification code.');
      }
    }

    const res = await safeFetchAuthJson<AuthSessionResponse>('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({
        email: cleanEmail,
        code: cleanCode,
      }),
    });
    if (res && res.token) {
      persistLocalSession(res.token, res.user);
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
    const cleanEmail = email.trim().toLowerCase();

    if (supabase) {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: cleanEmail,
      });
      if (error) {
        throw new Error(error.message || 'Failed to resend verification email.');
      }
      return {
        success: true,
        message: 'A new verification email/code has been dispatched.',
      };
    }

    return await safeFetchAuthJson('/api/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email: cleanEmail }),
    });
  }

  /**
   * Request password reset link
   */
  public async forgotPassword(emailOrPayload: string | { email: string }): Promise<{ success: boolean; message: string }> {
    const email = typeof emailOrPayload === 'string' ? emailOrPayload : emailOrPayload.email;
    const cleanEmail = email.trim().toLowerCase();

    if (supabase) {
      const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth/sign-in` : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo });
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
    if (supabase && !token) {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user) {
          const user = mapSupabaseUser(data.session.user);
          persistLocalSession(data.session.access_token, user);
          return { success: true, user, token: data.session.access_token };
        }
      } catch {
        // Continue to fallback check
      }
    }

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
      if (supabase) {
        await supabase.auth.signOut();
      }
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
