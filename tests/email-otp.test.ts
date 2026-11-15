import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import dotenv from 'dotenv';

dotenv.config();

import { app, resetRateLimitsForTesting, setEmailOtpServiceForTesting } from '../app.js';
import {
  EmailOtpService,
  OtpActivateResult,
  OtpReserveResult,
  OtpStatusSummary,
  OtpStoreAdapter,
  OtpVerifyAttemptResult,
  AuthProviderAdapter,
  AuthSessionResult,
  AuthUserRecord,
  SupabaseAuthProvider,
  SupabaseOtpStore,
  generateSixDigitOtp,
  hashEmailOtp,
  timingSafeEqualHex,
} from '../backend/emailOtp.js';
import { EmailDeliveryError, EmailSendTransport, buildVerificationEmailContent } from '../backend/email.js';
import { sanitizeMeta } from '../backend/logger.js';
import {
  getSupabaseAdminClient,
  getSupabaseAuthClient,
  getSupabasePublicClient,
  isSupabaseConfigured,
} from '../backend/supabase.js';

interface MockOtpRow {
  id: string;
  userId: string;
  email: string;
  otpHash: string | null;
  status: 'pending_delivery' | 'active' | 'used' | 'invalidated' | 'expired' | 'locked' | 'delivery_failed';
  attempts: number;
  maxAttempts: number;
  createdAtMs: number;
  expiresAtMs: number;
  resendAvailableAtMs: number;
  usedAtMs: number | null;
}

class InMemoryAtomicOtpStore implements OtpStoreAdapter {
  public rows: MockOtpRow[] = [];
  public nowMs: number = Date.now();

  advanceSeconds(seconds: number) {
    this.nowMs += seconds * 1000;
  }

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
    const cleanEmail = params.email.trim().toLowerCase();
    const inFlight = this.rows.find(
      (r) =>
        r.userId === params.userId &&
        r.status === 'pending_delivery' &&
        r.createdAtMs > this.nowMs - 15000
    );
    if (inFlight) {
      return {
        ok: false,
        code: 'RESEND_IN_PROGRESS',
        retryAfterSeconds: 5,
      };
    }

    if (params.enforceCooldown) {
      const latestCooldown = this.rows
        .filter((r) => r.userId === params.userId && r.status !== 'delivery_failed')
        .sort((a, b) => b.createdAtMs - a.createdAtMs)[0];

      if (latestCooldown && latestCooldown.resendAvailableAtMs > this.nowMs) {
        return {
          ok: false,
          code: 'COOLDOWN_ACTIVE',
          cooldownUntil: new Date(latestCooldown.resendAvailableAtMs).toISOString(),
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((latestCooldown.resendAvailableAtMs - this.nowMs) / 1000)
          ),
        };
      }
    }

    const otpId = crypto.randomUUID();
    const expiresAtMs = this.nowMs + params.ttlSeconds * 1000;
    const resendAvailableAtMs = this.nowMs + params.cooldownSeconds * 1000;

    this.rows.push({
      id: otpId,
      userId: params.userId,
      email: cleanEmail,
      otpHash: params.otpHash,
      status: 'pending_delivery',
      attempts: 0,
      maxAttempts: params.maxAttempts,
      createdAtMs: this.nowMs,
      expiresAtMs,
      resendAvailableAtMs,
      usedAtMs: null,
    });

    return {
      ok: true,
      code: 'RESERVED',
      otpId,
      expiresAt: new Date(expiresAtMs).toISOString(),
      cooldownUntil: new Date(resendAvailableAtMs).toISOString(),
    };
  }

  async activateOtp(otpId: string, userId: string): Promise<OtpActivateResult> {
    for (const r of this.rows) {
      if (r.userId === userId && r.id !== otpId && (r.status === 'active' || r.status === 'pending_delivery')) {
        r.status = 'invalidated';
      }
    }
    const target = this.rows.find((r) => r.id === otpId && r.userId === userId);
    if (!target) {
      return { ok: false, code: 'OTP_NOT_FOUND' };
    }
    target.status = 'active';
    return {
      ok: true,
      code: 'ACTIVATED',
      otpId: target.id,
      email: target.email,
      expiresAt: new Date(target.expiresAtMs).toISOString(),
      cooldownUntil: new Date(target.resendAvailableAtMs).toISOString(),
      maxAttempts: target.maxAttempts,
    };
  }

  async abortOtp(otpId: string): Promise<void> {
    const target = this.rows.find((r) => r.id === otpId && r.status === 'pending_delivery');
    if (target) {
      target.status = 'delivery_failed';
    }
  }

  async invalidateUserOtps(userId: string): Promise<number> {
    let count = 0;
    for (const r of this.rows) {
      if (r.userId === userId && (r.status === 'active' || r.status === 'pending_delivery')) {
        r.status = 'invalidated';
        count++;
      }
    }
    return count;
  }

  async verifyAttempt(
    email: string,
    otpHash: string | null,
    mode: 'hash' | 'managed_precheck'
  ): Promise<OtpVerifyAttemptResult> {
    const cleanEmail = email.trim().toLowerCase();
    const candidates = this.rows
      .filter((r) => r.email === cleanEmail && r.status !== 'pending_delivery' && r.status !== 'delivery_failed')
      .sort((a, b) => b.createdAtMs - a.createdAtMs);

    const active = candidates.find((r) => r.status === 'active');
    const latest = candidates[0];

    if (!active) {
      if (!latest) return { ok: false, code: 'OTP_MISSING' };
      if (latest.status === 'used') return { ok: false, code: 'OTP_ALREADY_USED' };
      if (latest.status === 'locked') {
        return {
          ok: false,
          code: 'OTP_TOO_MANY_ATTEMPTS',
          attempts: latest.attempts,
          maxAttempts: latest.maxAttempts,
          remainingAttempts: 0,
        };
      }
      if (latest.status === 'expired') {
        return {
          ok: false,
          code: 'OTP_EXPIRED',
          expiresAt: new Date(latest.expiresAtMs).toISOString(),
        };
      }
      if (latest.status === 'invalidated') return { ok: false, code: 'OTP_INVALIDATED' };
      return { ok: false, code: 'OTP_MISSING' };
    }

    if (active.expiresAtMs <= this.nowMs) {
      active.status = 'expired';
      return {
        ok: false,
        code: 'OTP_EXPIRED',
        otpId: active.id,
        expiresAt: new Date(active.expiresAtMs).toISOString(),
      };
    }

    if (active.attempts >= active.maxAttempts) {
      active.status = 'locked';
      return {
        ok: false,
        code: 'OTP_TOO_MANY_ATTEMPTS',
        otpId: active.id,
        attempts: active.attempts,
        maxAttempts: active.maxAttempts,
        remainingAttempts: 0,
      };
    }

    if (mode === 'managed_precheck') {
      return {
        ok: true,
        code: 'PRECHECK_OK',
        otpId: active.id,
        userId: active.userId,
        email: active.email,
        attempts: active.attempts,
        maxAttempts: active.maxAttempts,
      };
    }

    const nextAttempts = active.attempts + 1;
    if (!otpHash || !active.otpHash || !timingSafeEqualHex(otpHash, active.otpHash)) {
      active.attempts = nextAttempts;
      const locked = nextAttempts >= active.maxAttempts;
      if (locked) {
        active.status = 'locked';
      }
      return {
        ok: false,
        code: locked ? 'OTP_TOO_MANY_ATTEMPTS' : 'OTP_INVALID',
        otpId: active.id,
        attempts: nextAttempts,
        maxAttempts: active.maxAttempts,
        remainingAttempts: Math.max(0, active.maxAttempts - nextAttempts),
      };
    }

    active.attempts = nextAttempts;
    active.status = 'used';
    active.usedAtMs = this.nowMs;

    return {
      ok: true,
      code: 'OTP_VERIFIED',
      otpId: active.id,
      userId: active.userId,
      email: active.email,
      attempts: nextAttempts,
      maxAttempts: active.maxAttempts,
    };
  }

  async completeManagedAttempt(
    otpId: string,
    _email: string,
    success: boolean
  ): Promise<OtpVerifyAttemptResult> {
    const row = this.rows.find((r) => r.id === otpId);
    if (!row) return { ok: false, code: 'OTP_MISSING' };
    row.attempts += 1;
    if (success) {
      row.status = 'used';
      row.usedAtMs = this.nowMs;
      return { ok: true, code: 'OTP_VERIFIED', userId: row.userId, email: row.email };
    }
    const locked = row.attempts >= row.maxAttempts;
    if (locked) row.status = 'locked';
    return {
      ok: false,
      code: locked ? 'OTP_TOO_MANY_ATTEMPTS' : 'OTP_INVALID',
      attempts: row.attempts,
      maxAttempts: row.maxAttempts,
      remainingAttempts: Math.max(0, row.maxAttempts - row.attempts),
    };
  }

  async getStatusSummary(email: string): Promise<OtpStatusSummary> {
    const cleanEmail = email.trim().toLowerCase();
    const latest = this.rows
      .filter((r) => r.email === cleanEmail && r.status !== 'pending_delivery' && r.status !== 'delivery_failed')
      .sort((a, b) => b.createdAtMs - a.createdAtMs)[0];

    if (!latest) {
      return {
        hasActiveOtp: false,
        expired: false,
        lockedOut: false,
        remainingAttempts: 5,
        maxAttempts: 5,
        resendCooldownRemainingSeconds: 0,
        expiresAt: null,
        resendAvailableAt: null,
      };
    }

    const cooldownRem =
      latest.resendAvailableAtMs > this.nowMs
        ? Math.ceil((latest.resendAvailableAtMs - this.nowMs) / 1000)
        : 0;
    const isExpired = latest.status === 'expired' || (latest.status === 'active' && latest.expiresAtMs <= this.nowMs);
    const isLocked = latest.status === 'locked' || latest.attempts >= latest.maxAttempts;

    return {
      hasActiveOtp: latest.status === 'active' && !isExpired && !isLocked,
      expired: isExpired,
      lockedOut: isLocked,
      remainingAttempts: Math.max(0, latest.maxAttempts - latest.attempts),
      maxAttempts: latest.maxAttempts,
      resendCooldownRemainingSeconds: cooldownRem,
      expiresAt: new Date(latest.expiresAtMs).toISOString(),
      resendAvailableAt: new Date(latest.resendAvailableAtMs).toISOString(),
    };
  }
}

interface MockUser extends AuthUserRecord {
  password: string;
}

class InMemoryAuthProvider implements AuthProviderAdapter {
  public users = new Map<string, MockUser>();

  async findUserByEmail(email: string): Promise<MockUser | null> {
    const clean = email.trim().toLowerCase();
    for (const u of this.users.values()) {
      if (u.email === clean) return u;
    }
    return null;
  }

  async createUnconfirmedUser(params: {
    email: string;
    password: string;
    fullName: string;
  }): Promise<{ ok: true; user: AuthUserRecord } | { ok: false; status: number; code: string; error: string }> {
    const clean = params.email.trim().toLowerCase();
    const exists = await this.findUserByEmail(clean);
    if (exists) {
      return { ok: false, status: 409, code: 'USER_ALREADY_EXISTS', error: 'User already exists.' };
    }
    const id = crypto.randomUUID();
    const user: MockUser = {
      id,
      email: clean,
      fullName: params.fullName.trim(),
      password: params.password,
      emailConfirmedAt: null,
      confirmationSentAt: new Date().toISOString(),
    };
    this.users.set(id, user);
    return { ok: true, user };
  }

  async signUpWithSupabaseEmail(): Promise<any> {
    throw new Error('Not used in direct SMTP test mode');
  }

  async resendSupabaseSignupEmail(): Promise<any> {
    throw new Error('Not used in direct SMTP test mode');
  }

  async verifySupabaseSignupOtp(): Promise<any> {
    throw new Error('Not used in direct SMTP test mode');
  }

  async confirmUserAndMintSession(
    userId: string,
    email: string
  ): Promise<{ ok: true; session: AuthSessionResult } | { ok: false; status: number; code: string; error: string }> {
    const user = this.users.get(userId);
    if (!user || user.email !== email.trim().toLowerCase()) {
      return { ok: false, status: 404, code: 'USER_NOT_FOUND', error: 'User not found' };
    }
    user.emailConfirmedAt = new Date().toISOString();
    return {
      ok: true,
      session: {
        accessToken: `mock-jwt.${user.id}.${crypto.randomBytes(8).toString('hex')}`,
        refreshToken: `mock-refresh.${user.id}`,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          verified: true,
        },
      },
    };
  }

  async updatePendingUserEmail(
    userId: string,
    newEmail: string
  ): Promise<{ ok: true; user: AuthUserRecord } | { ok: false; status: number; code: string; error: string }> {
    const user = this.users.get(userId);
    if (!user) return { ok: false, status: 404, code: 'USER_NOT_FOUND', error: 'Not found' };
    const clean = newEmail.trim().toLowerCase();
    const collision = await this.findUserByEmail(clean);
    if (collision && collision.id !== userId) {
      return { ok: false, status: 409, code: 'EMAIL_ALREADY_IN_USE', error: 'Already exists' };
    }
    user.email = clean;
    user.emailConfirmedAt = null;
    return { ok: true, user };
  }

  async verifyUserPassword(email: string, password: string) {
    const user = await this.findUserByEmail(email);
    if (!user || user.password !== password) return { ok: false };
    return { ok: true, unconfirmed: !user.emailConfirmedAt };
  }

  async syncProfileEmail() {
    // no-op in unit mock
  }
}

interface CapturedEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  code: string | null;
}

function createMockTransport() {
  const sent: CapturedEmail[] = [];
  let failNext: Error | null = null;
  let rejectRecipient = false;
  let sendDelayMs = 0;

  const transport: EmailSendTransport = {
    async sendMail(mail) {
      if (sendDelayMs > 0) {
        await new Promise((r) => setTimeout(r, sendDelayMs));
      }
      if (failNext) {
        const err = failNext;
        failNext = null;
        throw err;
      }
      if (rejectRecipient) {
        rejectRecipient = false;
        return {
          messageId: '<rejected@fieldshift.test>',
          accepted: [],
          rejected: [mail.to],
        };
      }
      const match = mail.text.match(/\b(\d{6})\b/);
      sent.push({
        to: mail.to,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        code: match ? match[1] : null,
      });
      return {
        messageId: `<${crypto.randomUUID()}@fieldshift.test>`,
        accepted: [mail.to],
        rejected: [],
      };
    },
  };

  return {
    transport,
    sent,
    failNextWith(err: Error) {
      failNext = err;
    },
    rejectNextRecipient() {
      rejectRecipient = true;
    },
    setDelay(ms: number) {
      sendDelayMs = ms;
    },
  };
}

async function withTestHttpServer(
  run: (baseUrl: string, ctx: { store: InMemoryAtomicOtpStore; auth: InMemoryAuthProvider; mailer: ReturnType<typeof createMockTransport> }) => Promise<void>
) {
  const store = new InMemoryAtomicOtpStore();
  const auth = new InMemoryAuthProvider();
  const mailer = createMockTransport();
  const service = new EmailOtpService({
    store,
    auth,
    emailTransport: mailer.transport,
    hmacSecret: 'test-only-hmac-secret-do-not-use-in-prod-0123456789',
    forceSmtpMode: true,
  });

  resetRateLimitsForTesting();
  setEmailOtpServiceForTesting(service);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await run(baseUrl, { store, auth, mailer });
  } finally {
    setEmailOtpServiceForTesting(null);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function postJson(baseUrl: string, path: string, body: any) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  return { status: res.status, headers: res.headers, setCookie, json };
}

test('Cryptographic OTP generation, HMAC hashing, template security, and log redaction', () => {
  const codes = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const code = generateSixDigitOtp();
    assert.match(code, /^\d{6}$/, 'OTP must always be strictly 6 numeric digits');
    codes.add(code);
  }
  assert.ok(codes.size > 150, 'CSPRNG should produce well-distributed 6-digit codes');

  const hash = hashEmailOtp('user-1', 'ahmed.raza.bs.tech@gmail.com', '123456', 'secret-k');
  assert.equal(hash.length, 64);
  assert.ok(!hash.includes('123456'));

  const tpl = buildVerificationEmailContent({
    code: '482913',
    ttlMinutes: 10,
    fullName: 'Ahmed Raza',
  });
  assert.ok(tpl.html.includes('FieldShift'));
  assert.ok(tpl.html.includes('482913'));
  assert.ok(tpl.html.includes('10 minutes'));
  assert.ok(tpl.html.toLowerCase().includes('never share'));
  assert.ok(tpl.text.includes('482913'));

  const redacted = sanitizeMeta({
    email: 'test@example.com',
    otp: '482913',
    otpHash: hash,
    pendingToken: 'abc.def',
    smtpPass: 'supersecret',
  }) as Record<string, unknown>;
  assert.equal(redacted.email, 'test@example.com');
  assert.equal('otp' in redacted, false);
  assert.equal('otpHash' in redacted, false);
  assert.equal('pendingToken' in redacted, false);
  assert.equal('smtpPass' in redacted, false);
});

test('Scenario 1 & 15: Successful registration -> 6-digit OTP verification -> session cookie & JWT', async () => {
  await withTestHttpServer(async (baseUrl, { store, mailer }) => {
    const reg = await postJson(baseUrl, '/api/auth/register', {
      fullName: 'Ahmed Raza',
      email: 'ahmed.raza.bs.tech@gmail.com',
      password: 'Password123!',
    });

    assert.equal(reg.status, 201);
    assert.equal(reg.json.success, true);
    assert.equal(reg.json.autoConfirmed, false);
    assert.ok(reg.json.pendingToken);
    assert.equal(mailer.sent.length, 1);

    const sentCode = mailer.sent[0].code!;
    assert.match(sentCode, /^\d{6}$/);

    // Verify stored OTP is hashed, never plaintext
    assert.equal(store.rows.length, 1);
    assert.equal(store.rows[0].status, 'active');
    assert.ok(store.rows[0].otpHash && store.rows[0].otpHash !== sentCode);

    const verify = await postJson(baseUrl, '/api/auth/verify-otp', {
      email: 'ahmed.raza.bs.tech@gmail.com',
      code: sentCode,
    });

    assert.equal(verify.status, 200);
    assert.equal(verify.json.success, true);
    assert.equal(verify.json.user.verified, true);
    assert.ok(verify.json.token);

    const sessionCookieHeader = verify.setCookie.find((c) => c.startsWith('fieldshift_session='));
    assert.ok(sessionCookieHeader, 'HttpOnly session cookie must be set upon OTP verification');
    assert.ok(sessionCookieHeader!.includes('HttpOnly'));
    assert.ok(sessionCookieHeader!.includes('SameSite=Lax'));
  });
});

test('Scenario 2: Incorrect OTP increments attempts and NEVER misreports expired', async () => {
  await withTestHttpServer(async (baseUrl, { auth, mailer }) => {
    await postJson(baseUrl, '/api/auth/register', {
      fullName: 'Tester',
      email: 'wrongcode@example.com',
      password: 'Password123!',
    });
    const actualCode = mailer.sent[0].code!;
    const wrongCode = actualCode === '000000' ? '111111' : '000000';

    const res = await postJson(baseUrl, '/api/auth/verify-otp', {
      email: 'wrongcode@example.com',
      code: wrongCode,
    });

    assert.equal(res.status, 400);
    assert.equal(res.json.code, 'OTP_INVALID');
    assert.equal(res.json.remainingAttempts, 4);
    assert.ok(!/expired/i.test(res.json.error), 'Incorrect OTP must NOT say expired');

    const user = await auth.findUserByEmail('wrongcode@example.com');
    assert.equal(user?.emailConfirmedAt, null);
  });
});

test('Scenario 3: Expired OTP returns OTP_EXPIRED and keeps user unverified', async () => {
  await withTestHttpServer(async (baseUrl, { store, auth, mailer }) => {
    await postJson(baseUrl, '/api/auth/register', {
      fullName: 'Tester',
      email: 'expired@example.com',
      password: 'Password123!',
    });
    const sentCode = mailer.sent[0].code!;

    // Advance clock past 10-minute (600s) lifetime
    store.advanceSeconds(601);

    const res = await postJson(baseUrl, '/api/auth/verify-otp', {
      email: 'expired@example.com',
      code: sentCode,
    });

    assert.equal(res.status, 400);
    assert.equal(res.json.code, 'OTP_EXPIRED');
    assert.match(res.json.error, /expired/i);

    const user = await auth.findUserByEmail('expired@example.com');
    assert.equal(user?.emailConfirmedAt, null);
  });
});

test('Scenario 4, 5, 6, 7 & 8: Cooldown enforcement, resend invalidates old OTP, new OTP verifies, replay rejected', async () => {
  await withTestHttpServer(async (baseUrl, { store, mailer }) => {
    await postJson(baseUrl, '/api/auth/register', {
      fullName: 'Tester',
      email: 'resendflow@example.com',
      password: 'Password123!',
    });
    const firstCode = mailer.sent[0].code!;

    // Scenario 5: Resend before 60s cooldown must be blocked
    store.advanceSeconds(15);
    const earlyResend = await postJson(baseUrl, '/api/auth/resend-otp', {
      email: 'resendflow@example.com',
    });
    assert.equal(earlyResend.status, 429);
    assert.equal(earlyResend.json.code, 'COOLDOWN_ACTIVE');
    assert.ok(earlyResend.json.retryAfterSeconds >= 40);
    assert.ok(earlyResend.headers.get('retry-after'));
    assert.equal(mailer.sent.length, 1, 'No email should be sent during active cooldown');

    // Scenario 4: Advance past cooldown -> resend succeeds
    store.advanceSeconds(50);
    const resendOk = await postJson(baseUrl, '/api/auth/resend-otp', {
      email: 'resendflow@example.com',
    });
    assert.equal(resendOk.status, 200);
    assert.equal(resendOk.json.success, true);
    assert.equal(mailer.sent.length, 2);
    const secondCode = mailer.sent[1].code!;
    assert.match(secondCode, /^\d{6}$/);

    // Scenario 6: Old OTP must now fail (invalidated)
    const oldVerify = await postJson(baseUrl, '/api/auth/verify-otp', {
      email: 'resendflow@example.com',
      code: firstCode,
    });
    assert.equal(oldVerify.status, 400);
    assert.equal(oldVerify.json.code, 'OTP_INVALID');

    // Scenario 7: New OTP succeeds
    const newVerify = await postJson(baseUrl, '/api/auth/verify-otp', {
      email: 'resendflow@example.com',
      code: secondCode,
    });
    assert.equal(newVerify.status, 200);
    assert.equal(newVerify.json.user.verified, true);

    // Scenario 8: Already-used OTP replay must fail
    const replay = await postJson(baseUrl, '/api/auth/verify-otp', {
      email: 'resendflow@example.com',
      code: secondCode,
    });
    assert.equal(replay.status, 400);
    assert.equal(replay.json.code, 'OTP_ALREADY_USED');
  });
});

test('Scenario 9: Too many failed attempts (5 max) locks out OTP until a fresh resend', async () => {
  await withTestHttpServer(async (baseUrl, { store, mailer }) => {
    await postJson(baseUrl, '/api/auth/register', {
      fullName: 'Lockout User',
      email: 'lockout@example.com',
      password: 'Password123!',
    });
    const actualCode = mailer.sent[0].code!;
    const badCode = actualCode === '123456' ? '654321' : '123456';

    for (let attempt = 1; attempt <= 4; attempt++) {
      const r = await postJson(baseUrl, '/api/auth/verify-otp', {
        email: 'lockout@example.com',
        code: badCode,
      });
      assert.equal(r.status, 400);
      assert.equal(r.json.code, 'OTP_INVALID');
      assert.equal(r.json.remainingAttempts, 5 - attempt);
    }

    // 5th wrong attempt triggers lockout
    const fifth = await postJson(baseUrl, '/api/auth/verify-otp', {
      email: 'lockout@example.com',
      code: badCode,
    });
    assert.equal(fifth.status, 429);
    assert.equal(fifth.json.code, 'OTP_TOO_MANY_ATTEMPTS');

    // 6th attempt even with CORRECT code is blocked until resend
    const sixthWithRightCode = await postJson(baseUrl, '/api/auth/verify-otp', {
      email: 'lockout@example.com',
      code: actualCode,
    });
    assert.equal(sixthWithRightCode.status, 429);
    assert.equal(sixthWithRightCode.json.code, 'OTP_TOO_MANY_ATTEMPTS');

    // Resend after cooldown restores verification with fresh code
    store.advanceSeconds(65);
    const resend = await postJson(baseUrl, '/api/auth/resend-otp', { email: 'lockout@example.com' });
    assert.equal(resend.status, 200);
    const freshCode = mailer.sent[1].code!;
    const verified = await postJson(baseUrl, '/api/auth/verify-otp', {
      email: 'lockout@example.com',
      code: freshCode,
    });
    assert.equal(verified.status, 200);
    assert.equal(verified.json.user.verified, true);
  });
});

test('Scenario 10: Email delivery failure returns 502 and preserves existing active valid OTP', async () => {
  await withTestHttpServer(async (baseUrl, { store, mailer }) => {
    await postJson(baseUrl, '/api/auth/register', {
      fullName: 'Mailer Fail',
      email: 'mailfail@example.com',
      password: 'Password123!',
    });
    const firstCode = mailer.sent[0].code!;

    store.advanceSeconds(65);
    mailer.failNextWith(new EmailDeliveryError('SMTP 550 upstream temporary rejection', 'EMAIL_DELIVERY_FAILED', 502));

    const failedResend = await postJson(baseUrl, '/api/auth/resend-otp', {
      email: 'mailfail@example.com',
    });
    assert.equal(failedResend.status, 502);
    assert.equal(failedResend.json.code, 'EMAIL_DELIVERY_FAILED');

    // Existing valid OTP MUST still work!
    const verifyPrior = await postJson(baseUrl, '/api/auth/verify-otp', {
      email: 'mailfail@example.com',
      code: firstCode,
    });
    assert.equal(verifyPrior.status, 200);
    assert.equal(verifyPrior.json.user.verified, true);
  });
});

test('Scenario 11 & 12: Concurrent resend requests & concurrent verify requests prevent race replays', async () => {
  await withTestHttpServer(async (baseUrl, { store, mailer }) => {
    await postJson(baseUrl, '/api/auth/register', {
      fullName: 'Race Tester',
      email: 'race@example.com',
      password: 'Password123!',
    });
    store.advanceSeconds(65);

    // Scenario 11: 5 parallel resends -> strictly 1 succeeds, 4 rejected
    mailer.setDelay(30);
    const parallelResends = await Promise.all(
      Array.from({ length: 5 }, () => postJson(baseUrl, '/api/auth/resend-otp', { email: 'race@example.com' }))
    );
    mailer.setDelay(0);

    const resend200s = parallelResends.filter((r) => r.status === 200);
    const resend429s = parallelResends.filter((r) => r.status === 429);
    assert.equal(resend200s.length, 1, 'Exactly one concurrent resend should succeed');
    assert.equal(resend429s.length, 4, 'Remaining concurrent resends must be blocked with 429');
    assert.equal(store.rows.filter((r) => r.status === 'active').length, 1);

    const latestCode = mailer.sent[mailer.sent.length - 1].code!;

    // Scenario 12: 5 parallel verifies with the SAME valid code -> strictly 1 succeeds
    const parallelVerifies = await Promise.all(
      Array.from({ length: 5 }, () =>
        postJson(baseUrl, '/api/auth/verify-otp', { email: 'race@example.com', code: latestCode })
      )
    );

    const verify200s = parallelVerifies.filter((r) => r.status === 200);
    const verifyRejected = parallelVerifies.filter((r) => r.status === 400);
    assert.equal(verify200s.length, 1, 'Strictly one concurrent verify attempt may consume an OTP');
    assert.equal(verifyRejected.length, 4);
    assert.ok(verifyRejected.every((r) => r.json.code === 'OTP_ALREADY_USED'));
  });
});

test('Scenario 13 & 14: Change email ownership/security, old OTP invalidation, and invalid input/status rejections', async () => {
  await withTestHttpServer(async (baseUrl, { mailer }) => {
    const reg = await postJson(baseUrl, '/api/auth/register', {
      fullName: 'Email Changer',
      email: 'old.pending@example.com',
      password: 'Password123!',
    });
    const oldCode = mailer.sent[0].code!;
    const pendingToken = reg.json.pendingToken as string;

    // Missing both pendingToken and password must fail 401
    const unauthChange = await postJson(baseUrl, '/api/auth/change-email', {
      currentEmail: 'old.pending@example.com',
      newEmail: 'new.pending@example.com',
    });
    assert.equal(unauthChange.status, 401);
    assert.equal(unauthChange.json.code, 'PENDING_OWNERSHIP_REQUIRED');

    // Authorized change with pendingToken succeeds
    const okChange = await postJson(baseUrl, '/api/auth/change-email', {
      currentEmail: 'old.pending@example.com',
      newEmail: 'new.pending@example.com',
      pendingToken,
    });
    assert.equal(okChange.status, 200);
    assert.equal(okChange.json.email, 'new.pending@example.com');
    const newCode = mailer.sent[1].code!;

    // Old OTP on old email rejected
    const verifyOld = await postJson(baseUrl, '/api/auth/verify-otp', {
      email: 'old.pending@example.com',
      code: oldCode,
    });
    assert.equal(verifyOld.status, 400);

    // Malformed / missing OTP rejected
    const malformed = await postJson(baseUrl, '/api/auth/verify-otp', {
      email: 'new.pending@example.com',
      code: '12AB',
    });
    assert.equal(malformed.status, 400);
    assert.equal(malformed.json.code, 'INVALID_OTP_FORMAT');

    // New OTP on new email verifies cleanly
    const verifyNew = await postJson(baseUrl, '/api/auth/verify-otp', {
      email: 'new.pending@example.com',
      code: newCode,
    });
    assert.equal(verifyNew.status, 200);
    assert.equal(verifyNew.json.user.email, 'new.pending@example.com');
    assert.equal(verifyNew.json.user.verified, true);

    // Already-verified account cannot use change-email pending flow (403)
    const verifiedChange = await postJson(baseUrl, '/api/auth/change-email', {
      currentEmail: 'new.pending@example.com',
      newEmail: 'another@example.com',
      password: 'Password123!',
    });
    assert.equal(verifiedChange.status, 403);
    assert.equal(verifiedChange.json.code, 'ALREADY_VERIFIED');
  });
});

test('Scenario 14 & 16 (Live Supabase & PostgreSQL RPCs): RLS, advisory-locked RPCs, login gate, and full verification E2E', async (t) => {
  if (!isSupabaseConfigured()) {
    t.skip('Supabase credentials not present in environment');
    return;
  }
  const supaAdmin = getSupabaseAdminClient();
  const supaAuth = getSupabaseAuthClient();
  const supaPub = getSupabasePublicClient();
  if (!supaAdmin || !supaAuth || !supaPub) {
    t.skip('Supabase clients unavailable');
    return;
  }

  // 1. Confirm RLS blocks direct anon table queries
  const { error: rlsErr } = await supaPub.from('email_verification_otps').select('id').limit(1);
  assert.ok(rlsErr, 'Anon client must be denied direct reads on email_verification_otps');

  const testEmail = `qa.otp.${Date.now()}@example.com`;
  const changedEmail = `qa.otp.changed.${Date.now()}@example.com`;
  const testPassword = 'QaPassword!2026';
  let createdUserId: string | null = null;

  const mailer = createMockTransport();
  const liveService = new EmailOtpService({
    store: new SupabaseOtpStore(supaAdmin),
    auth: new SupabaseAuthProvider(supaAuth, supaAdmin),
    emailTransport: mailer.transport,
    forceSmtpMode: true,
  });

  resetRateLimitsForTesting();
  setEmailOtpServiceForTesting(liveService);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    // 2. Register unconfirmed user through live Express + Supabase
    const reg = await postJson(baseUrl, '/api/auth/register', {
      fullName: 'Live QA User',
      email: testEmail,
      password: testPassword,
    });
    assert.equal(reg.status, 201);
    assert.equal(mailer.sent.length, 1);

    const authProv = new SupabaseAuthProvider(supaAuth, supaAdmin);
    const createdUser = await authProv.findUserByEmail(testEmail);
    assert.ok(createdUser, 'User should exist in auth.users');
    createdUserId = createdUser!.id;
    assert.equal(createdUser!.emailConfirmedAt, null, 'User must start unconfirmed');

    // 3. Scenario 14: Unconfirmed login attempt MUST be blocked with 403 EMAIL_NOT_CONFIRMED
    const blockedLogin = await postJson(baseUrl, '/api/auth/login', {
      email: testEmail,
      password: testPassword,
    });
    assert.equal(blockedLogin.status, 403);
    assert.equal(blockedLogin.json.code, 'EMAIL_NOT_CONFIRMED');
    assert.ok(blockedLogin.json.pendingToken);

    // 4. Test change-email against live Supabase Auth + profiles + PostgreSQL invalidation
    const changeRes = await postJson(baseUrl, '/api/auth/change-email', {
      currentEmail: testEmail,
      newEmail: changedEmail,
      pendingToken: blockedLogin.json.pendingToken,
    });
    assert.equal(changeRes.status, 200);
    assert.equal(changeRes.json.email, changedEmail);
    const latestCode = mailer.sent[mailer.sent.length - 1].code!;
    assert.match(latestCode, /^\d{6}$/);

    // 5. Wrong code on live PostgreSQL RPC returns 400 OTP_INVALID with 4 remaining
    const wrongCode = latestCode === '999999' ? '888888' : '999999';
    const wrongVerify = await postJson(baseUrl, '/api/auth/verify-otp', {
      email: changedEmail,
      code: wrongCode,
    });
    assert.equal(wrongVerify.status, 400);
    assert.equal(wrongVerify.json.code, 'OTP_INVALID');
    assert.equal(wrongVerify.json.remainingAttempts, 4);

    // 6. Concurrent verify replay against real PostgreSQL pg_advisory_xact_lock
    const concurrentVerifies = await Promise.all([
      postJson(baseUrl, '/api/auth/verify-otp', { email: changedEmail, code: latestCode }),
      postJson(baseUrl, '/api/auth/verify-otp', { email: changedEmail, code: latestCode }),
    ]);
    const okCount = concurrentVerifies.filter((r) => r.status === 200).length;
    const replayCount = concurrentVerifies.filter((r) => r.status === 400 && r.json.code === 'OTP_ALREADY_USED').length;
    assert.equal(okCount, 1, 'Live PostgreSQL advisory lock must allow strictly 1 verification');
    assert.equal(replayCount, 1, 'Second concurrent call must receive OTP_ALREADY_USED');

    const okVerify = concurrentVerifies.find((r) => r.status === 200)!;
    assert.ok(okVerify.json.token, 'Verified response must include real Supabase access JWT');

    // 7. Scenario 15: Verify /api/auth/session accepts BOTH Bearer JWT and HttpOnly cookie
    const sessionViaBearer = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { Authorization: `Bearer ${okVerify.json.token}` },
    });
    assert.equal(sessionViaBearer.status, 200);
    const sessionJson = await sessionViaBearer.json();
    assert.equal(sessionJson.user.email, changedEmail);
    assert.equal(sessionJson.user.verified, true);

    const cookiePair = okVerify.setCookie
      .find((c) => c.startsWith('fieldshift_session='))!
      .split(';')[0];
    const sessionViaCookie = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { Cookie: cookiePair },
    });
    assert.equal(sessionViaCookie.status, 200);

    // 8. Post-verification password login succeeds
    const okLogin = await postJson(baseUrl, '/api/auth/login', {
      email: changedEmail,
      password: testPassword,
    });
    assert.equal(okLogin.status, 200);
    assert.equal(okLogin.json.success, true);
    assert.equal(okLogin.json.user.verified, true);
  } finally {
    setEmailOtpServiceForTesting(null);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (createdUserId) {
      await supaAdmin.from('email_verification_otps').delete().eq('user_id', createdUserId);
      await supaAdmin.auth.admin.deleteUser(createdUserId);
    }
  }
});
