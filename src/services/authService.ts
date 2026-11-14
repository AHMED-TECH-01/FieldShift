import { User } from '../types';
import { apiFetch, getApiBaseUrl } from './apiClient';
import { getActiveSupabaseClient, isSupabaseClientConfigured } from '../lib/supabase';

export interface AuthSessionResponse {
  success: boolean;
  user: User;
  token: string;
  message?: string;
}

export interface AuthErrorDetails {
  message: string;
  status?: number;
  isNetworkError?: boolean;
}

export class AuthServiceError extends Error {
  public code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'AuthServiceError';
    this.code = code;
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
      throw new AuthServiceError(parsedJson.error, parsedJson.code);
    }
    if (parsedJson && typeof parsedJson.message === 'string') {
      throw new AuthServiceError(parsedJson.message, parsedJson.code);
    }

    if (res.status === 401) {
      throw new AuthServiceError('Invalid email or password. Please verify your credentials.', 'INVALID_CREDENTIALS');
    }
    if (res.status === 403) {
      throw new AuthServiceError('Access forbidden. Your account may be pending verification or deactivated.', 'EMAIL_NOT_CONFIRMED');
    }
    if (res.status === 404) {
      throw new Error(`Authentication endpoint '${resolvedUrl}' could not be reached (404 Not Found).`);
    }
    if (res.status === 429) {
      throw new AuthServiceError('Too many attempts. Please wait a minute before trying again.', 'RATE_LIMITED');
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

/**
 * Authentication Service supporting Supabase Auth (Email OTP, Password, Google OAuth)
 * and backend session verification.
 */
class AuthService {
  private loginRouteCandidates = [
    '/api/auth/login',
    '/api/v1/auth/login',
    '/auth/login',
  ];

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

    const supa = getActiveSupabaseClient();
    if (supa) {
      const { data, error } = await supa.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        const isUnconfirmed =
          (error as any).code === 'email_not_confirmed' ||
          /email not confirmed|confirm your email/i.test(error.message);
        if (isUnconfirmed) {
          throw new AuthServiceError(
            'Your email address has not been verified yet. Enter your 6-digit verification code or request a new code.',
            'EMAIL_NOT_CONFIRMED'
          );
        }
        throw new AuthServiceError(error.message || 'Invalid email or password.', (error as any).code);
      }

      if (data.session && data.user) {
        const user = mapSupabaseUser(data.user);
        persistLocalSession(data.session.access_token, user);
        return {
          success: true,
          user,
          token: data.session.access_token,
        };
      }

      throw new AuthServiceError('Unable to establish an authenticated session. Please try again.', 'SESSION_MISSING');
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
   * Sign in with Google OAuth via Supabase Auth
   */
  public async loginWithGoogle(redirectPath = '/dashboard'): Promise<void> {
    const supa = getActiveSupabaseClient();
    if (!supa) {
      throw new AuthServiceError(
        'Google Sign-In requires Supabase client configuration.',
        'SUPABASE_UNCONFIGURED'
      );
    }

    const redirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}${redirectPath.startsWith('/') ? redirectPath : `/${redirectPath}`}`
        : undefined;

    const { error } = await supa.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
      },
    });

    if (error) {
      throw new AuthServiceError(error.message || 'Unable to start Google sign-in.', (error as any).code);
    }
  }

  /**
   * Register a new user with email & password (triggers Supabase 6-digit OTP email)
   */
  public async register(payload: { email: string; fullName: string; password?: string }): Promise<{
    success: boolean;
    message: string;
    autoConfirmed?: boolean;
    user?: User;
    token?: string;
  }> {
    const cleanEmail = payload.email.trim().toLowerCase();
    const cleanName = payload.fullName.trim();

    const supa = getActiveSupabaseClient();
    if (supa && payload.password) {
      const { data, error } = await supa.auth.signUp({
        email: cleanEmail,
        password: payload.password,
        options: cleanName ? { data: { full_name: cleanName } } : undefined,
      });

      if (error) {
        const isDuplicate =
          (error as any).code === 'user_already_exists' ||
          /already registered|already exists/i.test(error.message);
        if (isDuplicate) {
          throw new AuthServiceError(
            'An account with this email address already exists. Please sign in instead.',
            'USER_ALREADY_EXISTS'
          );
        }
        throw new AuthServiceError(error.message || 'Could not create account.', (error as any).code);
      }

      // Supabase returns empty identities when email confirmation is enabled and email already exists
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        throw new AuthServiceError(
          'An account with this email address already exists. Please sign in instead.',
          'USER_ALREADY_EXISTS'
        );
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
        message: 'We sent a 6-digit verification code to your email address.',
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
   * Verify 6-digit signup email OTP with Supabase Auth and confirm session establishment
   */
  public async verifyOtp(
    emailOrPayload: string | { email: string; code: string },
    maybeCode?: string
  ): Promise<AuthSessionResponse> {
    const email = typeof emailOrPayload === 'string' ? emailOrPayload : emailOrPayload.email;
    const code = typeof emailOrPayload === 'string' ? maybeCode || '' : emailOrPayload.code;
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    if (!cleanEmail) {
      throw new AuthServiceError('Email address is required to verify your code.', 'EMAIL_REQUIRED');
    }
    if (!/^\d{6}$/.test(cleanCode)) {
      throw new AuthServiceError('Please enter a valid 6-digit numeric verification code.', 'INVALID_OTP_FORMAT');
    }

    const supa = getActiveSupabaseClient();
    if (supa) {
      const { data, error } = await supa.auth.verifyOtp({
        email: cleanEmail,
        token: cleanCode,
        type: 'signup',
      });

      if (error) {
        const errCode = String((error as any).code || '').toLowerCase();
        const isUnambiguouslyExpired =
          errCode === 'otp_expired' ||
          (/expired/i.test(error.message) && !/or is invalid/i.test(error.message));
        throw new AuthServiceError(
          isUnambiguouslyExpired
            ? 'Your verification code has expired. Please request a new 6-digit code.'
            : 'Invalid or expired 6-digit verification code. Please check the code or request a new one.',
          isUnambiguouslyExpired ? 'OTP_EXPIRED' : 'OTP_INVALID'
        );
      }

      let activeSession = data?.session || null;
      let activeUser = data?.user || activeSession?.user || null;

      if (!activeSession?.access_token) {
        const { data: sessionData } = await supa.auth.getSession();
        activeSession = sessionData?.session || null;
        if (!activeUser && activeSession?.user) {
          activeUser = activeSession.user;
        }
      }

      if (!activeSession?.access_token || !activeUser) {
        throw new AuthServiceError(
          'Email verification could not establish an authenticated session. Please try signing in or request a new code.',
          'SESSION_MISSING'
        );
      }

      const user = mapSupabaseUser(activeUser);
      persistLocalSession(activeSession.access_token, user);
      return {
        success: true,
        user,
        token: activeSession.access_token,
      };
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
   * Resend 6-digit email verification OTP via Supabase Auth
   */
  public async resendOtp(emailOrPayload: string | { email: string }): Promise<{
    success: boolean;
    message: string;
  }> {
    const email = typeof emailOrPayload === 'string' ? emailOrPayload : emailOrPayload.email;
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      throw new AuthServiceError('Email address is required.', 'EMAIL_REQUIRED');
    }

    const supa = getActiveSupabaseClient();
    if (supa) {
      const { error } = await supa.auth.resend({
        type: 'signup',
        email: cleanEmail,
      });
      if (error) {
        const isRateLimit =
          (error as any).status === 429 ||
          /rate limit|security purposes|only request this after/i.test(error.message);
        throw new AuthServiceError(
          isRateLimit
            ? error.message || 'Please wait before requesting another verification code.'
            : error.message || 'Failed to resend verification code.',
          isRateLimit ? 'RATE_LIMITED' : (error as any).code
        );
      }
      return {
        success: true,
        message: 'A new 6-digit verification code has been sent to your email address.',
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
      token || (!supa && typeof localStorage !== 'undefined' ? localStorage.getItem('fieldshift_token') : null);
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
