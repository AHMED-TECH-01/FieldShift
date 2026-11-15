import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  EmailDeliveryError,
  EmailSendTransport,
  isSmtpConfigured,
  sendVerificationEmailSmtp,
} from './email.js';
import { logEvent } from './logger.js';

export interface OtpRuntimeConfig {
  ttlSeconds: number;
  cooldownSeconds: number;
  maxAttempts: number;
}

export function getOtpConfig(): OtpRuntimeConfig {
  const ttlRaw = Number(process.env.OTP_TTL_SECONDS || '600');
  const cooldownRaw = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || '60');
  const maxAttemptsRaw = Number(process.env.OTP_MAX_ATTEMPTS || '5');

  return {
    ttlSeconds: Number.isFinite(ttlRaw) && ttlRaw >= 60 ? Math.floor(ttlRaw) : 600,
    cooldownSeconds: Number.isFinite(cooldownRaw) && cooldownRaw >= 0 ? Math.floor(cooldownRaw) : 60,
    maxAttempts:
      Number.isFinite(maxAttemptsRaw) && maxAttemptsRaw >= 1 && maxAttemptsRaw <= 20
        ? Math.floor(maxAttemptsRaw)
        : 5,
  };
}

function getOtpHmacSecret(): string {
  const secret = (
    process.env.OTP_HMAC_SECRET ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ''
  ).trim();

  if (!secret) {
    throw new Error('OTP_HMAC_SECRET or SUPABASE_SECRET_KEY is required for secure OTP hashing.');
  }
  return secret;
}

/**
 * Generates a cryptographically secure, uniformly distributed 6-digit numeric OTP (100000 - 999999).
 */
export function generateSixDigitOtp(): string {
  return String(crypto.randomInt(100000, 1000000));
}

/**
 * Computes deterministic HMAC-SHA256 digest bound to userId, email, and 6-digit code.
 */
export function hashEmailOtp(userId: string, email: string, code: string, secretOverride?: string): string {
  const key = secretOverride || getOtpHmacSecret();
  const normalizedEmail = email.trim().toLowerCase();
  return crypto
    .createHmac('sha256', key)
    .update(`${userId}:${normalizedEmail}:${code}`)
    .digest('hex');
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function createPendingVerificationToken(
  userId: string,
  email: string,
  ttlSeconds = 1800,
  secretOverride?: string
): string {
  const key = secretOverride || getOtpHmacSecret();
  const payload = Buffer.from(
    JSON.stringify({
      uid: userId,
      email: email.trim().toLowerCase(),
      exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    }),
    'utf8'
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', key).update(`pending:${payload}`).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyPendingVerificationToken(
  token: string | undefined | null,
  expectedEmail?: string,
  secretOverride?: string
): { valid: boolean; userId?: string; email?: string } {
  if (!token || typeof token !== 'string') return { valid: false };
  const parts = token.trim().split('.');
  if (parts.length !== 2) return { valid: false };
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return { valid: false };

  let key: string;
  try {
    key = secretOverride || getOtpHmacSecret();
  } catch {
    return { valid: false };
  }

  const expectedSig = crypto.createHmac('sha256', key).update(`pending:${payloadB64}`).digest('base64url');
  if (!timingSafeEqualHex(sigB64, expectedSig)) {
    return { valid: false };
  }

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!parsed?.uid || !parsed?.email || typeof parsed.exp !== 'number') {
      return { valid: false };
    }
    if (Math.floor(Date.now() / 1000) > parsed.exp) {
      return { valid: false };
    }
    const tokenEmail = String(parsed.email).trim().toLowerCase();
    if (expectedEmail && tokenEmail !== expectedEmail.trim().toLowerCase()) {
      return { valid: false };
    }
    return { valid: true, userId: String(parsed.uid), email: tokenEmail };
  } catch {
    return { valid: false };
  }
}

export interface AuthUserRecord {
  id: string;
  email: string;
  emailConfirmedAt: string | null;
  confirmationSentAt: string | null;
  fullName: string;
}

export interface AuthSessionResult {
  accessToken: string;
  refreshToken: string | null;
  user: {
    id: string;
    email: string;
    fullName: string;
    verified: boolean;
  };
}

export interface OtpReserveResult {
  ok: boolean;
  code: string;
  otpId?: string;
  expiresAt?: string;
  cooldownUntil?: string;
  retryAfterSeconds?: number;
}

export interface OtpActivateResult {
  ok: boolean;
  code: string;
  otpId?: string;
  email?: string;
  expiresAt?: string;
  cooldownUntil?: string;
  maxAttempts?: number;
}

export interface OtpVerifyAttemptResult {
  ok: boolean;
  code: string;
  otpId?: string;
  userId?: string;
  email?: string;
  attempts?: number;
  maxAttempts?: number;
  remainingAttempts?: number;
  expiresAt?: string;
}

export interface OtpStatusSummary {
  hasActiveOtp: boolean;
  expired: boolean;
  lockedOut: boolean;
  remainingAttempts: number;
  maxAttempts: number;
  resendCooldownRemainingSeconds: number;
  expiresAt: string | null;
  resendAvailableAt: string | null;
}

export interface OtpStoreAdapter {
  reserveOtp(params: {
    userId: string;
    email: string;
    otpHash: string | null;
    deliveryProvider: 'smtp' | 'supabase_auth';
    ttlSeconds: number;
    cooldownSeconds: number;
    maxAttempts: number;
    enforceCooldown: boolean;
  }): Promise<OtpReserveResult>;
  activateOtp(otpId: string, userId: string): Promise<OtpActivateResult>;
  abortOtp(otpId: string, errorMessage: string): Promise<void>;
  invalidateUserOtps(userId: string): Promise<number>;
  verifyAttempt(
    email: string,
    otpHash: string | null,
    mode: 'hash' | 'managed_precheck'
  ): Promise<OtpVerifyAttemptResult>;
  completeManagedAttempt(otpId: string, email: string, success: boolean): Promise<OtpVerifyAttemptResult>;
  getStatusSummary(email: string): Promise<OtpStatusSummary>;
}

export interface AuthProviderAdapter {
  findUserByEmail(email: string): Promise<AuthUserRecord | null>;
  createUnconfirmedUser(params: {
    email: string;
    password: string;
    fullName: string;
  }): Promise<{ ok: true; user: AuthUserRecord } | { ok: false; status: number; code: string; error: string }>;
  signUpWithSupabaseEmail(params: {
    email: string;
    password: string;
    fullName: string;
  }): Promise<
    | { ok: true; user: AuthUserRecord; session: AuthSessionResult | null; duplicate: boolean }
    | { ok: false; status: number; code: string; error: string }
  >;
  resendSupabaseSignupEmail(
    email: string
  ): Promise<{ ok: true } | { ok: false; status: number; code: string; error: string }>;
  verifySupabaseSignupOtp(
    email: string,
    code: string
  ): Promise<{ ok: true; session: AuthSessionResult } | { ok: false; status: number; code: string; error: string }>;
  confirmUserAndMintSession(
    userId: string,
    email: string
  ): Promise<{ ok: true; session: AuthSessionResult } | { ok: false; status: number; code: string; error: string }>;
  updatePendingUserEmail(
    userId: string,
    newEmail: string
  ): Promise<{ ok: true; user: AuthUserRecord } | { ok: false; status: number; code: string; error: string }>;
  verifyUserPassword(email: string, password: string): Promise<{ ok: boolean; unconfirmed?: boolean }>;
  syncProfileEmail(userId: string, newEmail: string): Promise<void>;
}

export interface EmailOtpServiceDeps {
  store: OtpStoreAdapter;
  auth: AuthProviderAdapter;
  emailTransport?: EmailSendTransport;
  forceSmtpMode?: boolean;
  hmacSecret?: string;
}

export class SupabaseOtpStore implements OtpStoreAdapter {
  constructor(private adminClient: SupabaseClient) {}

  async reserveOtp(params: {
    userId: string;
    email: string;
    otpHash: string | null;
    deliveryProvider: 'smtp' | 'supabase_auth';
    ttlSeconds: number;
    cooldownSeconds: number;
    maxAttempts: number;
    enforceCooldown: boolean;
  }): Promise<OtpReserveResult> {
    const { data, error } = await this.adminClient.rpc('reserve_email_otp', {
      p_user_id: params.userId,
      p_email: params.email.trim().toLowerCase(),
      p_otp_hash: params.otpHash,
      p_delivery_provider: params.deliveryProvider,
      p_ttl_seconds: params.ttlSeconds,
      p_cooldown_seconds: params.cooldownSeconds,
      p_max_attempts: params.maxAttempts,
      p_enforce_cooldown: params.enforceCooldown,
    });
    if (error || !data) {
      throw new Error(error?.message || 'Failed to reserve OTP record.');
    }
    return {
      ok: Boolean(data.ok),
      code: String(data.code || 'UNKNOWN'),
      otpId: data.otp_id ? String(data.otp_id) : undefined,
      expiresAt: data.expires_at ? String(data.expires_at) : undefined,
      cooldownUntil: data.cooldown_until ? String(data.cooldown_until) : undefined,
      retryAfterSeconds: typeof data.retry_after_seconds === 'number' ? data.retry_after_seconds : undefined,
    };
  }

  async activateOtp(otpId: string, userId: string): Promise<OtpActivateResult> {
    const { data, error } = await this.adminClient.rpc('activate_email_otp', {
      p_otp_id: otpId,
      p_user_id: userId,
    });
    if (error || !data) {
      throw new Error(error?.message || 'Failed to activate OTP record.');
    }
    return {
      ok: Boolean(data.ok),
      code: String(data.code || 'UNKNOWN'),
      otpId: data.otp_id ? String(data.otp_id) : undefined,
      email: data.email ? String(data.email) : undefined,
      expiresAt: data.expires_at ? String(data.expires_at) : undefined,
      cooldownUntil: data.cooldown_until ? String(data.cooldown_until) : undefined,
      maxAttempts: typeof data.max_attempts === 'number' ? data.max_attempts : undefined,
    };
  }

  async abortOtp(otpId: string, errorMessage: string): Promise<void> {
    await this.adminClient.rpc('abort_email_otp', {
      p_otp_id: otpId,
      p_error: errorMessage,
    });
  }

  async invalidateUserOtps(userId: string): Promise<number> {
    const { data } = await this.adminClient.rpc('invalidate_user_otps', {
      p_user_id: userId,
    });
    return typeof data === 'number' ? data : 0;
  }

  async verifyAttempt(
    email: string,
    otpHash: string | null,
    mode: 'hash' | 'managed_precheck'
  ): Promise<OtpVerifyAttemptResult> {
    const { data, error } = await this.adminClient.rpc('verify_email_otp_attempt', {
      p_email: email.trim().toLowerCase(),
      p_otp_hash: otpHash,
      p_mode: mode,
    });
    if (error || !data) {
      throw new Error(error?.message || 'Failed to verify OTP attempt.');
    }
    return {
      ok: Boolean(data.ok),
      code: String(data.code || 'OTP_INVALID'),
      otpId: data.otp_id ? String(data.otp_id) : undefined,
      userId: data.user_id ? String(data.user_id) : undefined,
      email: data.email ? String(data.email) : undefined,
      attempts: typeof data.attempts === 'number' ? data.attempts : undefined,
      maxAttempts: typeof data.max_attempts === 'number' ? data.max_attempts : undefined,
      remainingAttempts: typeof data.remaining_attempts === 'number' ? data.remaining_attempts : undefined,
      expiresAt: data.expires_at ? String(data.expires_at) : undefined,
    };
  }

  async completeManagedAttempt(otpId: string, email: string, success: boolean): Promise<OtpVerifyAttemptResult> {
    const { data, error } = await this.adminClient.rpc('complete_managed_email_otp', {
      p_otp_id: otpId,
      p_email: email.trim().toLowerCase(),
      p_success: success,
    });
    if (error || !data) {
      throw new Error(error?.message || 'Failed to finalize OTP attempt.');
    }
    return {
      ok: Boolean(data.ok),
      code: String(data.code || 'OTP_INVALID'),
      userId: data.user_id ? String(data.user_id) : undefined,
      email: data.email ? String(data.email) : undefined,
      attempts: typeof data.attempts === 'number' ? data.attempts : undefined,
      maxAttempts: typeof data.max_attempts === 'number' ? data.max_attempts : undefined,
      remainingAttempts: typeof data.remaining_attempts === 'number' ? data.remaining_attempts : undefined,
    };
  }

  async getStatusSummary(email: string): Promise<OtpStatusSummary> {
    const cfg = getOtpConfig();
    const cleanEmail = email.trim().toLowerCase();
    const { data } = await this.adminClient
      .from('email_verification_otps')
      .select('status, attempts, max_attempts, expires_at, cooldown_until')
      .ilike('email', cleanEmail)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) {
      return {
        hasActiveOtp: false,
        expired: false,
        lockedOut: false,
        remainingAttempts: cfg.maxAttempts,
        maxAttempts: cfg.maxAttempts,
        resendCooldownRemainingSeconds: 0,
        expiresAt: null,
        resendAvailableAt: null,
      };
    }

    const nowMs = Date.now();
    const expiresMs = new Date(data.expires_at).getTime();
    const cooldownMs = new Date(data.cooldown_until).getTime();
    const maxAttempts = Number(data.max_attempts || cfg.maxAttempts);
    const attempts = Number(data.attempts || 0);

    return {
      hasActiveOtp: true,
      expired: nowMs > expiresMs,
      lockedOut: attempts >= maxAttempts,
      remainingAttempts: Math.max(0, maxAttempts - attempts),
      maxAttempts,
      resendCooldownRemainingSeconds: Math.max(0, Math.ceil((cooldownMs - nowMs) / 1000)),
      expiresAt: new Date(expiresMs).toISOString(),
      resendAvailableAt: new Date(cooldownMs).toISOString(),
    };
  }
}

function mapSupabaseAuthUser(u: any): AuthUserRecord {
  const email = String(u.email || '').toLowerCase();
  const metaName = u.user_metadata?.full_name || u.user_metadata?.name;
  return {
    id: String(u.id),
    email,
    emailConfirmedAt: u.email_confirmed_at ? String(u.email_confirmed_at) : null,
    confirmationSentAt: u.confirmation_sent_at ? String(u.confirmation_sent_at) : null,
    fullName:
      typeof metaName === 'string' && metaName.trim()
        ? metaName.trim()
        : email.split('@')[0] || 'Farmer',
  };
}

export class SupabaseAuthProvider implements AuthProviderAdapter {
  constructor(
    private authClient: SupabaseClient,
    private adminClient: SupabaseClient
  ) {}

  async findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    const cleanEmail = email.trim().toLowerCase();

    // Fast O(1) indexed lookup via public.profiles first
    const { data: prof } = await this.adminClient
      .from('profiles')
      .select('id')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (prof?.id) {
      const { data: userRes, error } = await this.adminClient.auth.admin.getUserById(prof.id);
      if (!error && userRes?.user && String(userRes.user.email || '').toLowerCase() === cleanEmail) {
        return mapSupabaseAuthUser(userRes.user);
      }
    }

    // Fallback scan across Supabase Auth pages
    let page = 1;
    const perPage = 200;
    while (page <= 10) {
      const { data, error } = await this.adminClient.auth.admin.listUsers({ page, perPage });
      if (error || !data?.users?.length) break;
      const found = data.users.find((u) => String(u.email || '').toLowerCase() === cleanEmail);
      if (found) {
        return mapSupabaseAuthUser(found);
      }
      if (data.users.length < perPage) break;
      page += 1;
    }

    return null;
  }

  async createUnconfirmedUser(params: {
    email: string;
    password: string;
    fullName: string;
  }): Promise<{ ok: true; user: AuthUserRecord } | { ok: false; status: number; code: string; error: string }> {
    const { data, error } = await this.adminClient.auth.admin.createUser({
      email: params.email.trim().toLowerCase(),
      password: params.password,
      email_confirm: false,
      user_metadata: { full_name: params.fullName.trim() },
    });

    if (error || !data?.user) {
      const msg = error?.message || 'Could not create account.';
      const isDuplicate = /already registered|already exists|duplicate/i.test(msg);
      return {
        ok: false,
        status: isDuplicate ? 409 : 400,
        code: isDuplicate ? 'USER_ALREADY_EXISTS' : 'SIGNUP_FAILED',
        error: isDuplicate ? 'An account with this email already exists.' : msg,
      };
    }

    return { ok: true, user: mapSupabaseAuthUser(data.user) };
  }

  async signUpWithSupabaseEmail(params: {
    email: string;
    password: string;
    fullName: string;
  }): Promise<
    | { ok: true; user: AuthUserRecord; session: AuthSessionResult | null; duplicate: boolean }
    | { ok: false; status: number; code: string; error: string }
  > {
    const cleanEmail = params.email.trim().toLowerCase();
    const { data, error } = await this.authClient.auth.signUp({
      email: cleanEmail,
      password: params.password,
      options: { data: { full_name: params.fullName.trim() } },
    });

    if (error) {
      const isDuplicate = /already registered|already exists/i.test(error.message);
      const isRateLimit = (error as any).status === 429 || /rate limit|only request this after/i.test(error.message);
      const isEmailErr = /error sending confirmation|smtp|mail/i.test(error.message);
      return {
        ok: false,
        status: isDuplicate ? 409 : isRateLimit ? 429 : isEmailErr ? 502 : 400,
        code: isDuplicate
          ? 'USER_ALREADY_EXISTS'
          : isRateLimit
          ? 'RATE_LIMITED'
          : isEmailErr
          ? 'EMAIL_DELIVERY_FAILED'
          : 'SIGNUP_FAILED',
        error: error.message,
      };
    }

    if (!data.user) {
      return { ok: false, status: 500, code: 'SIGNUP_FAILED', error: 'Account registration failed.' };
    }

    const duplicate = Array.isArray(data.user.identities) && data.user.identities.length === 0;
    const mapped = mapSupabaseAuthUser(data.user);
    const session: AuthSessionResult | null = data.session
      ? {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token || null,
          user: {
            id: mapped.id,
            email: mapped.email,
            fullName: mapped.fullName,
            verified: Boolean(mapped.emailConfirmedAt),
          },
        }
      : null;

    return { ok: true, user: mapped, session, duplicate };
  }

  async resendSupabaseSignupEmail(
    email: string
  ): Promise<{ ok: true } | { ok: false; status: number; code: string; error: string }> {
    const { error } = await this.authClient.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
    });
    if (error) {
      const isRateLimit =
        (error as any).status === 429 ||
        /rate limit|security purposes|only request this after/i.test(error.message);
      const isMailErr = /error sending|smtp|mail/i.test(error.message);
      return {
        ok: false,
        status: isRateLimit ? 429 : isMailErr ? 502 : 400,
        code: isRateLimit ? 'RATE_LIMITED' : isMailErr ? 'EMAIL_DELIVERY_FAILED' : 'RESEND_FAILED',
        error: error.message,
      };
    }
    return { ok: true };
  }

  async verifySupabaseSignupOtp(
    email: string,
    code: string
  ): Promise<{ ok: true; session: AuthSessionResult } | { ok: false; status: number; code: string; error: string }> {
    const { data, error } = await this.authClient.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code,
      type: 'signup',
    });

    if (error || !data?.session || !data?.user) {
      return {
        ok: false,
        status: 400,
        code: 'OTP_INVALID',
        error: error?.message || 'Verification code is invalid or expired.',
      };
    }

    const mapped = mapSupabaseAuthUser(data.user);
    return {
      ok: true,
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token || null,
        user: {
          id: mapped.id,
          email: mapped.email,
          fullName: mapped.fullName,
          verified: Boolean(mapped.emailConfirmedAt),
        },
      },
    };
  }

  async confirmUserAndMintSession(
    userId: string,
    email: string
  ): Promise<{ ok: true; session: AuthSessionResult } | { ok: false; status: number; code: string; error: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const { data: updatedUser, error: confirmErr } = await this.adminClient.auth.admin.updateUserById(userId, {
      email_confirm: true,
    });
    if (confirmErr || !updatedUser?.user) {
      return {
        ok: false,
        status: 500,
        code: 'CONFIRM_USER_FAILED',
        error: confirmErr?.message || 'Failed to confirm user email.',
      };
    }

    const { data: linkData, error: linkErr } = await this.adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: cleanEmail,
    });
    const hashedToken = linkData?.properties?.hashed_token;
    if (linkErr || !hashedToken) {
      return {
        ok: false,
        status: 500,
        code: 'SESSION_CREATION_FAILED',
        error: 'Email verified, but session creation failed. Please sign in with your email and password.',
      };
    }

    const { data: sessionData, error: verifyErr } = await this.authClient.auth.verifyOtp({
      token_hash: hashedToken,
      type: 'magiclink',
    });

    if (verifyErr || !sessionData?.session || !sessionData?.user) {
      return {
        ok: false,
        status: 500,
        code: 'SESSION_CREATION_FAILED',
        error: 'Email verified, but session initialization failed. Please sign in.',
      };
    }

    const mapped = mapSupabaseAuthUser(sessionData.user);
    return {
      ok: true,
      session: {
        accessToken: sessionData.session.access_token,
        refreshToken: sessionData.session.refresh_token || null,
        user: {
          id: mapped.id,
          email: mapped.email,
          fullName: mapped.fullName,
          verified: true,
        },
      },
    };
  }

  async updatePendingUserEmail(
    userId: string,
    newEmail: string
  ): Promise<{ ok: true; user: AuthUserRecord } | { ok: false; status: number; code: string; error: string }> {
    const { data, error } = await this.adminClient.auth.admin.updateUserById(userId, {
      email: newEmail.trim().toLowerCase(),
      email_confirm: false,
    });
    if (error || !data?.user) {
      const msg = error?.message || 'Failed to update pending email address.';
      const isDuplicate = /already exists|already registered|duplicate/i.test(msg);
      return {
        ok: false,
        status: isDuplicate ? 409 : 400,
        code: isDuplicate ? 'EMAIL_ALREADY_IN_USE' : 'CHANGE_EMAIL_FAILED',
        error: isDuplicate ? 'An account with this email address already exists.' : msg,
      };
    }
    return { ok: true, user: mapSupabaseAuthUser(data.user) };
  }

  async verifyUserPassword(email: string, password: string): Promise<{ ok: boolean; unconfirmed?: boolean }> {
    const { data, error } = await this.authClient.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (!error && data?.user) {
      return { ok: true, unconfirmed: !data.user.email_confirmed_at };
    }
    if (error && /email not confirmed|confirm your email/i.test(error.message)) {
      // Supabase verifies password BEFORE returning email_not_confirmed!
      return { ok: true, unconfirmed: true };
    }
    return { ok: false };
  }

  async syncProfileEmail(userId: string, newEmail: string): Promise<void> {
    await this.adminClient
      .from('profiles')
      .update({ email: newEmail.trim().toLowerCase(), updated_at: new Date().toISOString() })
      .eq('id', userId);
  }
}

export interface OtpServiceResponse {
  status: number;
  body: Record<string, any>;
}

export class EmailOtpService {
  constructor(private deps: EmailOtpServiceDeps) {}

  private usesDirectSmtp(): boolean {
    return Boolean(this.deps.forceSmtpMode || this.deps.emailTransport || isSmtpConfigured());
  }

  private computeHash(userId: string, email: string, code: string): string {
    return hashEmailOtp(userId, email, code, this.deps.hmacSecret);
  }

  private makePendingToken(userId: string, email: string): string {
    return createPendingVerificationToken(userId, email, 1800, this.deps.hmacSecret);
  }

  private checkPendingToken(token: string | undefined | null, email?: string) {
    return verifyPendingVerificationToken(token, email, this.deps.hmacSecret);
  }

  async register(params: {
    email: string;
    fullName: string;
    password: string;
  }): Promise<OtpServiceResponse> {
    const cleanEmail = params.email.trim().toLowerCase();
    const cleanName = params.fullName.trim();
    const cfg = getOtpConfig();

    const existing = await this.deps.auth.findUserByEmail(cleanEmail);
    if (existing) {
      if (existing.emailConfirmedAt) {
        return {
          status: 409,
          body: {
            error: 'An account with this email already exists. Please sign in instead.',
            code: 'USER_ALREADY_EXISTS',
          },
        };
      }

      const pendingToken = this.makePendingToken(existing.id, cleanEmail);
      const statusSummary = await this.deps.store.getStatusSummary(cleanEmail);
      return {
        status: 409,
        body: {
          error:
            'An account with this email is awaiting verification. Please enter your 6-digit code, request a new code, or change your email.',
          code: 'ACCOUNT_PENDING_VERIFICATION',
          email: cleanEmail,
          pendingToken,
          resendCooldownRemainingSeconds: statusSummary.resendCooldownRemainingSeconds,
        },
      };
    }

    if (this.usesDirectSmtp()) {
      const created = await this.deps.auth.createUnconfirmedUser({
        email: cleanEmail,
        password: params.password,
        fullName: cleanName,
      });
      if (!created.ok) {
        return {
          status: created.status,
          body: { error: created.error, code: created.code },
        };
      }

      const code = generateSixDigitOtp();
      const otpHash = this.computeHash(created.user.id, cleanEmail, code);
      const reservation = await this.deps.store.reserveOtp({
        userId: created.user.id,
        email: cleanEmail,
        otpHash,
        deliveryProvider: 'smtp',
        ttlSeconds: cfg.ttlSeconds,
        cooldownSeconds: cfg.cooldownSeconds,
        maxAttempts: cfg.maxAttempts,
        enforceCooldown: false,
      });

      if (!reservation.ok || !reservation.otpId) {
        return {
          status: 500,
          body: { error: 'Unable to initialize email verification.', code: reservation.code },
        };
      }

      try {
        await sendVerificationEmailSmtp(
          {
            to: cleanEmail,
            code,
            ttlMinutes: Math.round(cfg.ttlSeconds / 60),
            fullName: cleanName,
          },
          this.deps.emailTransport
        );
      } catch (err: any) {
        await this.deps.store.abortOtp(reservation.otpId, err?.message || 'SMTP delivery failed');
        const pendingToken = this.makePendingToken(created.user.id, cleanEmail);
        return {
          status: err instanceof EmailDeliveryError ? err.status : 502,
          body: {
            error:
              err?.message ||
              'Your account was created, but we could not send the verification email. Please try resending or change your email.',
            code: 'EMAIL_DELIVERY_FAILED',
            email: cleanEmail,
            pendingToken,
          },
        };
      }

      const activated = await this.deps.store.activateOtp(reservation.otpId, created.user.id);
      const pendingToken = this.makePendingToken(created.user.id, cleanEmail);

      return {
        status: 201,
        body: {
          success: true,
          autoConfirmed: false,
          message: 'We sent a 6-digit verification code to your email address.',
          email: cleanEmail,
          expiresAt: activated.expiresAt || reservation.expiresAt,
          resendAvailableAt: activated.cooldownUntil || reservation.cooldownUntil,
          resendCooldownSeconds: cfg.cooldownSeconds,
          otpValiditySeconds: cfg.ttlSeconds,
          maxAttempts: cfg.maxAttempts,
          pendingToken,
        },
      };
    }

    // Supabase-managed Gmail SMTP delivery fallback (when direct SMTP_PASS is not set in .env)
    const supaRes = await this.deps.auth.signUpWithSupabaseEmail({
      email: cleanEmail,
      password: params.password,
      fullName: cleanName,
    });
    if (!supaRes.ok) {
      return {
        status: supaRes.status,
        body: { error: supaRes.error, code: supaRes.code },
      };
    }

    if (supaRes.duplicate) {
      return {
        status: 409,
        body: {
          error: 'An account with this email already exists. Please sign in instead.',
          code: 'USER_ALREADY_EXISTS',
        },
      };
    }

    if (supaRes.session) {
      return {
        status: 201,
        body: {
          success: true,
          autoConfirmed: true,
          message: 'Account created and verified.',
          user: {
            email: supaRes.session.user.email,
            fullName: supaRes.session.user.fullName,
            verified: supaRes.session.user.verified,
          },
          token: supaRes.session.accessToken,
          refreshToken: supaRes.session.refreshToken,
        },
      };
    }

    const reservation = await this.deps.store.reserveOtp({
      userId: supaRes.user.id,
      email: cleanEmail,
      otpHash: null,
      deliveryProvider: 'supabase_auth',
      ttlSeconds: cfg.ttlSeconds,
      cooldownSeconds: cfg.cooldownSeconds,
      maxAttempts: cfg.maxAttempts,
      enforceCooldown: false,
    });
    if (reservation.ok && reservation.otpId) {
      await this.deps.store.activateOtp(reservation.otpId, supaRes.user.id);
    }

    const pendingToken = this.makePendingToken(supaRes.user.id, cleanEmail);
    return {
      status: 201,
      body: {
        success: true,
        autoConfirmed: false,
        message: 'We sent a 6-digit verification code to your email address.',
        email: cleanEmail,
        expiresAt: reservation.expiresAt,
        resendAvailableAt: reservation.cooldownUntil,
        resendCooldownSeconds: cfg.cooldownSeconds,
        otpValiditySeconds: cfg.ttlSeconds,
        maxAttempts: cfg.maxAttempts,
        pendingToken,
      },
    };
  }

  async resend(params: { email: string }): Promise<OtpServiceResponse> {
    const cleanEmail = params.email.trim().toLowerCase();
    const cfg = getOtpConfig();

    const user = await this.deps.auth.findUserByEmail(cleanEmail);
    if (!user) {
      return {
        status: 404,
        body: {
          error: 'No pending registration was found for this email address. Please sign up first.',
          code: 'OTP_USER_NOT_FOUND',
        },
      };
    }

    if (user.emailConfirmedAt) {
      return {
        status: 400,
        body: {
          error: 'This email address is already verified. Please sign in.',
          code: 'ALREADY_VERIFIED',
        },
      };
    }

    const useSmtp = this.usesDirectSmtp();
    const newCode = useSmtp ? generateSixDigitOtp() : null;
    const otpHash = useSmtp && newCode ? this.computeHash(user.id, cleanEmail, newCode) : null;

    // Reserve atomically under per-user advisory lock WITHOUT invalidating the existing valid code yet
    const reservation = await this.deps.store.reserveOtp({
      userId: user.id,
      email: cleanEmail,
      otpHash,
      deliveryProvider: useSmtp ? 'smtp' : 'supabase_auth',
      ttlSeconds: cfg.ttlSeconds,
      cooldownSeconds: cfg.cooldownSeconds,
      maxAttempts: cfg.maxAttempts,
      enforceCooldown: true,
    });

    if (!reservation.ok || !reservation.otpId) {
      const waitSeconds = reservation.retryAfterSeconds ?? cfg.cooldownSeconds;
      return {
        status: 429,
        body: {
          error: `Please wait ${waitSeconds} second${waitSeconds === 1 ? '' : 's'} before requesting a new verification code.`,
          code: reservation.code === 'RESEND_IN_PROGRESS' ? 'RESEND_IN_PROGRESS' : 'COOLDOWN_ACTIVE',
          retryAfterSeconds: waitSeconds,
          resendAvailableAt: reservation.cooldownUntil,
        },
      };
    }

    if (useSmtp && newCode) {
      try {
        await sendVerificationEmailSmtp(
          {
            to: cleanEmail,
            code: newCode,
            ttlMinutes: Math.round(cfg.ttlSeconds / 60),
            fullName: user.fullName,
          },
          this.deps.emailTransport
        );
      } catch (err: any) {
        // Abort reservation cleanly — previous valid OTP stays active!
        await this.deps.store.abortOtp(reservation.otpId, err?.message || 'SMTP delivery failed');
        return {
          status: err instanceof EmailDeliveryError ? err.status : 502,
          body: {
            error:
              err?.message ||
              'Failed to send the new verification email. Any previous unexpired code remains valid until delivery succeeds.',
            code: 'EMAIL_DELIVERY_FAILED',
          },
        };
      }
    } else {
      const supaResend = await this.deps.auth.resendSupabaseSignupEmail(cleanEmail);
      if (!supaResend.ok) {
        await this.deps.store.abortOtp(reservation.otpId, supaResend.error);
        return {
          status: supaResend.status,
          body: {
            error: supaResend.error,
            code: supaResend.code,
          },
        };
      }
    }

    // Delivery succeeded -> atomically activate new OTP and invalidate all previous active OTPs for user
    const activated = await this.deps.store.activateOtp(reservation.otpId, user.id);
    const pendingToken = this.makePendingToken(user.id, cleanEmail);

    logEvent('AuthOtp', 'OTP_RESENT', {
      emailDomain: cleanEmail.split('@')[1] || 'unknown',
      provider: useSmtp ? 'smtp' : 'supabase_auth',
    });

    return {
      status: 200,
      body: {
        success: true,
        message: 'A new 6-digit verification code has been sent to your email address.',
        email: cleanEmail,
        expiresAt: activated.expiresAt || reservation.expiresAt,
        resendAvailableAt: activated.cooldownUntil || reservation.cooldownUntil,
        resendCooldownSeconds: cfg.cooldownSeconds,
        otpValiditySeconds: cfg.ttlSeconds,
        maxAttempts: cfg.maxAttempts,
        pendingToken,
      },
    };
  }

  async verify(params: { email: string; code: string }): Promise<OtpServiceResponse> {
    const cleanEmail = params.email.trim().toLowerCase();
    const cleanCode = params.code.trim();

    if (!cleanEmail) {
      return {
        status: 400,
        body: { error: 'Email address is required.', code: 'EMAIL_REQUIRED' },
      };
    }

    if (!/^\d{6}$/.test(cleanCode)) {
      return {
        status: 400,
        body: {
          error: 'Please enter a valid 6-digit numeric verification code.',
          code: 'INVALID_OTP_FORMAT',
        },
      };
    }

    const user = await this.deps.auth.findUserByEmail(cleanEmail);

    if (this.usesDirectSmtp()) {
      const candidateHash = user ? this.computeHash(user.id, cleanEmail, cleanCode) : null;
      const attemptRes = await this.deps.store.verifyAttempt(cleanEmail, candidateHash, 'hash');

      if (!attemptRes.ok) {
        return this.mapVerifyFailure(attemptRes);
      }

      const targetUserId = attemptRes.userId || user?.id;
      if (!targetUserId) {
        return {
          status: 404,
          body: { error: 'User account not found.', code: 'OTP_MISSING' },
        };
      }

      const confirmed = await this.deps.auth.confirmUserAndMintSession(targetUserId, cleanEmail);
      if (!confirmed.ok) {
        return {
          status: confirmed.status,
          body: { error: confirmed.error, code: confirmed.code },
        };
      }

      return {
        status: 200,
        body: {
          success: true,
          message: 'Email verified successfully.',
          user: {
            email: confirmed.session.user.email,
            fullName: confirmed.session.user.fullName,
            verified: true,
          },
          token: confirmed.session.accessToken,
          refreshToken: confirmed.session.refreshToken,
        },
      };
    }

    // Supabase-managed OTP delivery mode (still guarded by PostgreSQL tracking when present)
    const precheck = await this.deps.store.verifyAttempt(cleanEmail, null, 'managed_precheck');
    if (!precheck.ok) {
      // Allow seamless transition for pre-migration unconfirmed accounts that do not yet have a ledger row
      const isLegacyUnconfirmed =
        precheck.code === 'OTP_MISSING' && user && !user.emailConfirmedAt;
      if (!isLegacyUnconfirmed) {
        return this.mapVerifyFailure(precheck);
      }
    }

    const supaVerify = await this.deps.auth.verifySupabaseSignupOtp(cleanEmail, cleanCode);
    if (supaVerify.ok) {
      if (precheck.ok && precheck.otpId) {
        await this.deps.store.completeManagedAttempt(precheck.otpId, cleanEmail, true);
      }
      return {
        status: 200,
        body: {
          success: true,
          message: 'Email verified successfully.',
          user: {
            email: supaVerify.session.user.email,
            fullName: supaVerify.session.user.fullName,
            verified: true,
          },
          token: supaVerify.session.accessToken,
          refreshToken: supaVerify.session.refreshToken,
        },
      };
    }

    // Record failure against server tracking row so remaining attempts and true expiry are accurate
    if (precheck.ok && precheck.otpId) {
      const failRes = await this.deps.store.completeManagedAttempt(precheck.otpId, cleanEmail, false);
      return this.mapVerifyFailure(failRes);
    }

    // Pre-migration legacy unconfirmed user failure — classify honestly using confirmationSentAt if available
    const cfg = getOtpConfig();
    if (user?.confirmationSentAt) {
      const sentMs = new Date(user.confirmationSentAt).getTime();
      if (Number.isFinite(sentMs) && Date.now() - sentMs > cfg.ttlSeconds * 1000) {
        return {
          status: 400,
          body: {
            error: 'Your verification code has expired. Please request a new 6-digit code.',
            code: 'OTP_EXPIRED',
          },
        };
      }
    }

    return {
      status: 400,
      body: {
        error: 'Incorrect 6-digit verification code. Please check the code or request a new 6-digit code.',
        code: 'OTP_INVALID',
      },
    };
  }

  private mapVerifyFailure(res: OtpVerifyAttemptResult): OtpServiceResponse {
    switch (res.code) {
      case 'OTP_EXPIRED':
        return {
          status: 400,
          body: {
            error: 'Your verification code has expired. Please request a new 6-digit code.',
            code: 'OTP_EXPIRED',
            expiresAt: res.expiresAt,
          },
        };
      case 'OTP_ALREADY_USED':
        return {
          status: 400,
          body: {
            error: 'This verification code has already been used. Please sign in or request a new code.',
            code: 'OTP_ALREADY_USED',
          },
        };
      case 'OTP_TOO_MANY_ATTEMPTS':
        return {
          status: 429,
          body: {
            error: `Too many incorrect verification attempts (${res.maxAttempts ?? 5}/${res.maxAttempts ?? 5}). Please request a new 6-digit code.`,
            code: 'OTP_TOO_MANY_ATTEMPTS',
            attempts: res.attempts,
            maxAttempts: res.maxAttempts,
            remainingAttempts: 0,
          },
        };
      case 'OTP_INVALIDATED':
        return {
          status: 400,
          body: {
            error: 'This verification code is no longer valid because a newer code was sent. Please enter your latest 6-digit code.',
            code: 'OTP_INVALIDATED',
          },
        };
      case 'OTP_MISSING':
        return {
          status: 400,
          body: {
            error: 'No active verification code was found for this email. Please request a new 6-digit code.',
            code: 'OTP_MISSING',
          },
        };
      default: {
        const rem = typeof res.remainingAttempts === 'number' ? res.remainingAttempts : null;
        return {
          status: 400,
          body: {
            error:
              rem !== null
                ? `Incorrect verification code. ${rem} attempt${rem === 1 ? '' : 's'} remaining.`
                : 'Incorrect verification code. Please check your 6-digit code and try again.',
            code: 'OTP_INVALID',
            attempts: res.attempts,
            maxAttempts: res.maxAttempts,
            remainingAttempts: rem ?? undefined,
          },
        };
      }
    }
  }

  async changePendingEmail(params: {
    currentEmail: string;
    newEmail: string;
    pendingToken?: string | null;
    password?: string | null;
  }): Promise<OtpServiceResponse> {
    const cleanOld = params.currentEmail.trim().toLowerCase();
    const cleanNew = params.newEmail.trim().toLowerCase();
    const cfg = getOtpConfig();

    if (cleanOld === cleanNew) {
      return {
        status: 400,
        body: {
          error: 'The new email address must be different from the current pending email.',
          code: 'SAME_EMAIL',
        },
      };
    }

    const existing = await this.deps.auth.findUserByEmail(cleanOld);
    if (!existing) {
      return {
        status: 404,
        body: {
          error: 'No pending registration was found for the current email address.',
          code: 'USER_NOT_FOUND',
        },
      };
    }

    // Guard against modifying already-verified accounts via unauthenticated pending flow
    if (existing.emailConfirmedAt) {
      return {
        status: 403,
        body: {
          error: 'This account is already verified. Please sign in to update your email settings.',
          code: 'ALREADY_VERIFIED',
        },
      };
    }

    // Verify ownership via either valid pendingToken OR valid account password
    const tokenCheck = this.checkPendingToken(params.pendingToken, cleanOld);
    const hasValidToken = tokenCheck.valid && tokenCheck.userId === existing.id;

    let hasValidPassword = false;
    if (!hasValidToken && params.password) {
      const pwCheck = await this.deps.auth.verifyUserPassword(cleanOld, params.password);
      hasValidPassword = pwCheck.ok;
    }

    if (!hasValidToken && !hasValidPassword) {
      return {
        status: 401,
        body: {
          error: 'Please enter your account password to confirm changing your pending email address.',
          code: 'PENDING_OWNERSHIP_REQUIRED',
        },
      };
    }

    const collision = await this.deps.auth.findUserByEmail(cleanNew);
    if (collision) {
      return {
        status: 409,
        body: {
          error: 'An account with this new email address already exists. Please use another email or sign in.',
          code: 'EMAIL_ALREADY_IN_USE',
        },
      };
    }

    // Invalidate all previous active/pending OTPs associated with the old email BEFORE switching
    await this.deps.store.invalidateUserOtps(existing.id);

    const updated = await this.deps.auth.updatePendingUserEmail(existing.id, cleanNew);
    if (!updated.ok) {
      return {
        status: updated.status,
        body: { error: updated.error, code: updated.code },
      };
    }

    await this.deps.auth.syncProfileEmail(existing.id, cleanNew);

    const useSmtp = this.usesDirectSmtp();
    const newCode = useSmtp ? generateSixDigitOtp() : null;
    const otpHash = useSmtp && newCode ? this.computeHash(existing.id, cleanNew, newCode) : null;

    const reservation = await this.deps.store.reserveOtp({
      userId: existing.id,
      email: cleanNew,
      otpHash,
      deliveryProvider: useSmtp ? 'smtp' : 'supabase_auth',
      ttlSeconds: cfg.ttlSeconds,
      cooldownSeconds: cfg.cooldownSeconds,
      maxAttempts: cfg.maxAttempts,
      enforceCooldown: false,
    });

    if (!reservation.ok || !reservation.otpId) {
      return {
        status: 500,
        body: { error: 'Updated email, but failed to create new verification challenge.', code: reservation.code },
      };
    }

    const nextPendingToken = this.makePendingToken(existing.id, cleanNew);

    if (useSmtp && newCode) {
      try {
        await sendVerificationEmailSmtp(
          {
            to: cleanNew,
            code: newCode,
            ttlMinutes: Math.round(cfg.ttlSeconds / 60),
            fullName: existing.fullName,
          },
          this.deps.emailTransport
        );
      } catch (err: any) {
        await this.deps.store.abortOtp(reservation.otpId, err?.message || 'SMTP delivery failed');
        return {
          status: err instanceof EmailDeliveryError ? err.status : 502,
          body: {
            error:
              err?.message ||
              'Pending email was updated, but sending the new verification code failed. Please retry Resend Code.',
            code: 'EMAIL_DELIVERY_FAILED',
            email: cleanNew,
            pendingToken: nextPendingToken,
          },
        };
      }
    } else {
      const supaResend = await this.deps.auth.resendSupabaseSignupEmail(cleanNew);
      if (!supaResend.ok) {
        await this.deps.store.abortOtp(reservation.otpId, supaResend.error);
        return {
          status: supaResend.status,
          body: {
            error: supaResend.error,
            code: supaResend.code,
            email: cleanNew,
            pendingToken: nextPendingToken,
          },
        };
      }
    }

    const activated = await this.deps.store.activateOtp(reservation.otpId, existing.id);

    logEvent('AuthOtp', 'PENDING_EMAIL_CHANGED', {
      oldDomain: cleanOld.split('@')[1] || 'unknown',
      newDomain: cleanNew.split('@')[1] || 'unknown',
    });

    return {
      status: 200,
      body: {
        success: true,
        message: `Email updated to ${cleanNew}. A fresh 6-digit verification code has been sent.`,
        email: cleanNew,
        expiresAt: activated.expiresAt || reservation.expiresAt,
        resendAvailableAt: activated.cooldownUntil || reservation.cooldownUntil,
        resendCooldownSeconds: cfg.cooldownSeconds,
        otpValiditySeconds: cfg.ttlSeconds,
        maxAttempts: cfg.maxAttempts,
        pendingToken: nextPendingToken,
      },
    };
  }

  async getStatus(email: string): Promise<OtpServiceResponse> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return {
        status: 400,
        body: { error: 'Email is required.', code: 'EMAIL_REQUIRED' },
      };
    }

    const summary = await this.deps.store.getStatusSummary(cleanEmail);
    return {
      status: 200,
      body: {
        success: true,
        email: cleanEmail,
        ...summary,
      },
    };
  }
}
