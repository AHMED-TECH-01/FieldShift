import { User } from '../types';
import { apiFetch, getApiBaseUrl } from './apiClient';
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
      throw new AuthServiceError(parsedJson.error, parsedJson.code, res.status, parsedJson);
    }
    if (parsedJson && typeof parsedJson.message === 'string') {
      throw new AuthServiceError(parsedJson.message, parsedJson.code, res.status, parsedJson);
    }

    if (res.status === 401) {
      throw new AuthServiceError('Invalid email or password. Please verify your credentials.', 'INVALID_CREDENTIALS', 401);
    }
    if (res.status === 403) {
      throw new AuthServiceError('Access forbidden. Your account may be pending verification or deactivated.', 'EMAIL_NOT_CONFIRMED', 403);
    }
    if (res.status === 404) {
      throw new Error(`Authentication endpoint '${resolvedUrl}' could not be reached (404 Not Found).`);
    }
    if (res.status === 429) {
      throw new AuthServiceError('Too many attempts. Please wait a minute before trying again.', 'RATE_LIMITED', 429);
    }
    if (res.status >= 500) {
      throw new AuthServiceError('The authentication service encountered a temporary error. Please try again shortly.', 'UPSTREAM_ERROR', res.status);
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

export interface OtpLifecyclePayload {
  success: boolean;
  message: string;
  email?: string;
  autoConfirmed?: boolean;
  user?: User;
  token?: string;
  refreshToken?: string | null;
  expiresAt?: string;
  resendAvailableAt?: string;
  resendCooldownSeconds?: number;
  otpValiditySeconds?: number;
  maxAttempts?: number;
  pendingToken?: string;
}

export interface VerificationStatusPayload {
  success: boolean;
  email: string;
  hasActiveOtp: boolean;
  expired: boolean;
  lockedOut: boolean;
  remainingAttempts: number;
  maxAttempts: number;
  resendCooldownRemainingSeconds: number;
  expiresAt: string | null;
  resendAvailableAt: string | null;
}

/**
 * Authentication Service supporting Server-Validated Email OTP Verification,
 * Password Login, Google OAuth, and Backend Session Synchronization.
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
   * Log in user with email and password through backend auth proxy
   * (enforces email verification check and syncs session cookie + Supabase SDK).
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
   * Register a new user with email & password (triggers server-managed 6-digit OTP email)
   */
  public async register(payload: { email: string; fullName: string; password?: string }): Promise<OtpLifecyclePayload> {
    const cleanEmail = payload.email.trim().toLowerCase();
    const cleanName = payload.fullName.trim();

    const res = await safeFetchAuthJson<OtpLifecyclePayload>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: cleanEmail,
        fullName: cleanName,
        password: payload.password,
      }),
    });

    if (res.autoConfirmed && res.token && res.user) {
      persistLocalSession(res.token, res.user);
      await syncSupabaseBrowserSession(res.token, res.refreshToken);
    }

    return res;
  }

  /**
   * Verify 6-digit email OTP through backend atomic validator & establish authenticated session
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

    const res = await safeFetchAuthJson<AuthSessionResponse>('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({
        email: cleanEmail,
        code: cleanCode,
      }),
    });
    if (res && res.token && res.user) {
      persistLocalSession(res.token, res.user);
      await syncSupabaseBrowserSession(res.token, res.refreshToken);
    }
    return res;
  }

  /**
   * Resend 6-digit email verification OTP with server-side cooldown & atomic invalidation
   */
  public async resendOtp(emailOrPayload: string | { email: string }): Promise<OtpLifecyclePayload> {
    const email = typeof emailOrPayload === 'string' ? emailOrPayload : emailOrPayload.email;
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      throw new AuthServiceError('Email address is required.', 'EMAIL_REQUIRED');
    }

    return await safeFetchAuthJson<OtpLifecyclePayload>('/api/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email: cleanEmail }),
    });
  }

  /**
   * Change pending unverified registration email address, invalidate old OTPs, and issue a fresh 6-digit code
   */
  public async changePendingEmail(payload: {
    currentEmail: string;
    newEmail: string;
    pendingToken?: string;
    password?: string;
  }): Promise<OtpLifecyclePayload> {
    return await safeFetchAuthJson<OtpLifecyclePayload>('/api/auth/change-email', {
      method: 'POST',
      body: JSON.stringify({
        currentEmail: payload.currentEmail.trim().toLowerCase(),
        newEmail: payload.newEmail.trim().toLowerCase(),
        pendingToken: payload.pendingToken,
        password: payload.password,
      }),
    });
  }

  /**
   * Query server-side verification cooldown, expiration & remaining attempt state
   */
  public async getVerificationStatus(email: string): Promise<VerificationStatusPayload> {
    const cleanEmail = email.trim().toLowerCase();
    return await safeFetchAuthJson<VerificationStatusPayload>(
      `/api/auth/verification-status?email=${encodeURIComponent(cleanEmail)}`,
      { method: 'GET' }
    );
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
