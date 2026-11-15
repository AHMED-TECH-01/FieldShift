import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { app, resetRateLimitsForTesting } from '../app.js';
import { resetSupabaseClientsForTesting } from '../backend/supabase.js';

dotenv.config();

async function requestJson(
  baseUrl: string,
  method: string,
  route: string,
  body?: unknown,
  headers: Record<string, string> = {}
) {
  const res = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json, headers: res.headers };
}

test('FieldShift Direct Email/Password Auth Suite (Zero OTP, Zero Google OAuth)', async (t) => {
  resetRateLimitsForTesting();
  resetSupabaseClientsForTesting();

  await t.test('1. Frontend & backend source contain zero Google OAuth or OTP verification UI/handlers', () => {
    const authModalSrc = fs.readFileSync(path.resolve('src/components/auth/AuthModal.tsx'), 'utf8');
    assert.doesNotMatch(authModalSrc, /Continue with Google/i);
    assert.doesNotMatch(authModalSrc, /loginWithGoogle/i);
    assert.doesNotMatch(authModalSrc, /verify-otp|resend-otp|handleVerifyOtp|handleResendOtp|6-digit/i);

    const authServiceSrc = fs.readFileSync(path.resolve('src/services/authService.ts'), 'utf8');
    assert.doesNotMatch(authServiceSrc, /loginWithGoogle|signInWithOAuth|verifyOtp|resendOtp|changePendingEmail|getVerificationStatus/);

    const appSrc = fs.readFileSync(path.resolve('app.ts'), 'utf8');
    assert.doesNotMatch(appSrc, /verify-otp|resend-otp|change-email|verification-status|emailOtp|getSmtpConfigSummary/);
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  assert.ok(addr && typeof addr === 'object');
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const secretKey = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const adminClient =
    supabaseUrl && secretKey
      ? createClient(supabaseUrl, secretKey, { auth: { autoRefreshToken: false, persistSession: false } })
      : null;

  const createdUserIds: string[] = [];

  try {
    await t.test('2. Obsolete OTP endpoints all return 404 Not Found', async () => {
      const obsoleteRoutes: Array<[string, string, any?]> = [
        ['POST', '/api/auth/verify-otp', { email: 'a@b.com', code: '123456' }],
        ['POST', '/api/auth/resend-otp', { email: 'a@b.com' }],
        ['POST', '/api/auth/change-email', { currentEmail: 'a@b.com', newEmail: 'c@d.com' }],
        ['GET', '/api/auth/verification-status?email=a@b.com'],
      ];
      for (const [method, route, body] of obsoleteRoutes) {
        const res = await requestJson(baseUrl, method, route, body);
        assert.equal(res.status, 404, `${method} ${route} should return 404`);
      }
    });

    await t.test('3. Health endpoint omits obsolete emailDelivery/SMTP telemetry', async () => {
      const res = await requestJson(baseUrl, 'GET', '/api/health');
      assert.equal(res.status, 200);
      assert.equal('emailDelivery' in res.json, false);
    });

    if (!adminClient) {
      return;
    }

    await t.test('4. Live registration validates input, prevents duplicates, and issues immediate session without OTP', async () => {
      const invalidRes = await requestJson(baseUrl, 'POST', '/api/auth/register', {
        email: 'not-an-email',
        fullName: 'A',
        password: 'short',
      });
      assert.equal(invalidRes.status, 400);
      assert.equal(invalidRes.json.code, 'VALIDATION_ERROR');

      const testEmail = `nootp.reg.${Date.now()}@example.com`;
      const password = 'FieldShift_NoOtp_2026!';

      const regRes = await requestJson(baseUrl, 'POST', '/api/auth/register', {
        email: testEmail,
        fullName: 'Direct Signup Farmer',
        password,
      });
      assert.equal(regRes.status, 201);
      assert.equal(regRes.json.success, true);
      assert.ok(regRes.json.token, 'Registration must return access token immediately');
      assert.equal(regRes.json.user.email, testEmail);
      assert.match(regRes.headers.get('set-cookie') || '', /fieldshift_session=/);

      // Session works immediately for protected routes & profile creation
      const sessionRes = await requestJson(baseUrl, 'GET', '/api/auth/session', undefined, {
        Authorization: `Bearer ${regRes.json.token}`,
      });
      assert.equal(sessionRes.status, 200);
      assert.equal(sessionRes.json.user.email, testEmail);
      assert.ok(sessionRes.json.user.id);
      createdUserIds.push(sessionRes.json.user.id);

      const profileRes = await requestJson(baseUrl, 'GET', '/api/profile', undefined, {
        Authorization: `Bearer ${regRes.json.token}`,
      });
      assert.equal(profileRes.status, 200);

      // Duplicate signup is rejected with 409 USER_ALREADY_EXISTS without duplicating user
      const dupRes = await requestJson(baseUrl, 'POST', '/api/auth/register', {
        email: testEmail,
        fullName: 'Duplicate Attempt',
        password,
      });
      assert.equal(dupRes.status, 409);
      assert.equal(dupRes.json.code, 'USER_ALREADY_EXISTS');

      // Wrong password rejected with 401
      const wrongLogin = await requestJson(baseUrl, 'POST', '/api/auth/login', {
        email: testEmail,
        password: 'WrongPassword123!',
      });
      assert.equal(wrongLogin.status, 401);
      assert.equal(wrongLogin.json.code, 'INVALID_CREDENTIALS');

      // Correct password succeeds cleanly
      const okLogin = await requestJson(baseUrl, 'POST', '/api/auth/login', {
        email: testEmail,
        password,
      });
      assert.equal(okLogin.status, 200);
      assert.ok(okLogin.json.token);

      // Logout clears session cookie cleanly
      const logoutRes = await requestJson(baseUrl, 'POST', '/api/auth/logout', undefined, {
        Authorization: `Bearer ${okLogin.json.token}`,
      });
      assert.equal(logoutRes.status, 200);
      assert.match(logoutRes.headers.get('set-cookie') || '', /Max-Age=0/);
    });

    await t.test('5. Legacy unconfirmed account: wrong password fails with 401, right password succeeds safely without deleting/duplicating', async () => {
      const legacyEmail = `legacy.unconfirmed.${Date.now()}@example.com`;
      const legacyPw = 'LegacyPass_2026!';

      const { data: legacyUser, error } = await adminClient.auth.admin.createUser({
        email: legacyEmail,
        password: legacyPw,
        email_confirm: false,
        user_metadata: { full_name: 'Legacy Unconfirmed User' },
      });
      assert.ifError(error);
      assert.ok(legacyUser.user);
      createdUserIds.push(legacyUser.user.id);

      // Wrong password MUST still fail with 401 and must NOT confirm the account
      const badLogin = await requestJson(baseUrl, 'POST', '/api/auth/login', {
        email: legacyEmail,
        password: 'NotThePassword!',
      });
      assert.equal(badLogin.status, 401);
      assert.equal(badLogin.json.code, 'INVALID_CREDENTIALS');

      const { data: stillUnconfirmed } = await adminClient.auth.admin.getUserById(legacyUser.user.id);
      assert.ok(!stillUnconfirmed.user?.email_confirmed_at, 'Wrong password must never confirm legacy account');

      // Valid password MUST succeed cleanly and issue a working JWT for protected routes
      const goodLogin = await requestJson(baseUrl, 'POST', '/api/auth/login', {
        email: legacyEmail,
        password: legacyPw,
      });
      assert.equal(goodLogin.status, 200);
      assert.ok(goodLogin.json.token);
      assert.equal(goodLogin.json.user.email, legacyEmail);
      assert.match(goodLogin.headers.get('set-cookie') || '', /fieldshift_session=/);

      const farmsRes = await requestJson(baseUrl, 'GET', '/api/farms', undefined, {
        Authorization: `Bearer ${goodLogin.json.token}`,
      });
      assert.equal(farmsRes.status, 200);
    });

    await t.test('6. Password reset endpoint remains functional', async () => {
      const resetRes = await requestJson(baseUrl, 'POST', '/api/auth/password-reset', {
        email: 'nonexistent.reset.check@example.com',
      });
      assert.equal(resetRes.status, 200);
      assert.equal(resetRes.json.success, true);
    });
  } finally {
    for (const uid of createdUserIds) {
      await adminClient?.auth.admin.deleteUser(uid).catch(() => {});
    }
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
